import { randomBytes, randomUUID } from "node:crypto";
import { AdapterInterface } from "../adapters/interface";
import { DnsResolver } from "../dns/dns.resolver";
import {
    DnsVerificationFailedError,
    DomainNotFoundError
} from "../errors/errors";
import { assertTransition } from "./domain.machine";
import { Domain, DomainInstructions, DomainStatus, verificationKey } from "./domain.types";
import { DomainStore } from "./store.adapter";

export interface SDKConfig {
    store: DomainStore;
    dns: DnsResolver;
    adapter: AdapterInterface<any>;
    cnameTarget: string;
}


export class DomainService {
    constructor(private config: SDKConfig) { }

    async createDomain(hostname: string): Promise<DomainInstructions> {
        const existing = await this.config.store.getByHostname(hostname);
        if (existing) {
            return this.getInstructions(existing);
        }

        const domain: Domain = {
            id: randomUUID(),
            hostname: this.normalizeHostname(hostname),
            status: "created",
            verificationToken: this.generateToken(),
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        assertTransition("created", "pending_verification");

        domain.status = "pending_verification";
        await this.config.store.create(domain);

        return this.getInstructions(domain);

    }

    async checkVerification(hostname: string): Promise<DomainInstructions> {
        const domain = await this.getDomainOrThrow(hostname);

        if (domain.status === "verified") {
            return this.getInstructions(domain);
        }
        assertTransition(domain.status, "verified");

        const txtRecords = await this.config.dns.resolveTxt(`${verificationKey}.${domain.hostname}`);
        if (txtRecords.includes(domain.verificationToken)) {
            console.info("[checkVerification]:" + hostname, "Fetched TXT records:", txtRecords);
            return this.transition(domain, "verified");
        }
        console.warn("[checkVerification]:" + hostname, "Verification token not found in DNS TXT records");

        throw new DnsVerificationFailedError(
            domain.hostname,
            domain.verificationToken,
            txtRecords.join(", ") || "none found"
        );
    }

    async getDnsInstructions(hostname: string): Promise<DomainInstructions> {
        const domain = await this.getDomainOrThrow(hostname);

        if (domain.status === "pending_dns") {
            return this.getInstructions(domain);
        }

        assertTransition(domain.status, "pending_dns");

        return this.transition(domain, "pending_dns");
    }

    async provisionDomain(hostname: string): Promise<DomainInstructions> {
        const domain = await this.getDomainOrThrow(hostname);

        if (domain.status === "provisioning_ssl") {
            return this.getInstructions(domain);
        }

        assertTransition(domain.status, "provisioning_ssl");

        // Verify DNS points to us before calling adapter API : e.g. Cloudflare, etc.
        const c_names = await this.config.dns.resolveCname(domain.hostname);
        const aRecords = await this.config.dns.resolveA(domain.hostname);

        if (
            !c_names.includes(this.config.cnameTarget) &&
            aRecords.length === 0
        ) {
            throw new DnsVerificationFailedError(
                domain.hostname,
                this.config.cnameTarget,
                [...c_names, ...aRecords].join(", ") || "none"
            );
        }

        // Call adapter to create custom hostname
        try {
            const adapterId = await this.config.adapter.createCustomHostname(domain.hostname);
            domain.adapterHostnameId = adapterId;
            return this.transition(domain, "provisioning_ssl");
        } catch (err) {
            await this.transition(domain, "failed", (err as Error).message);
            throw err;
        }
    }

    async syncStatus(hostname: string): Promise<DomainInstructions> {
        const domain = await this.getDomainOrThrow(hostname);
        if (domain.status === "active") return this.getInstructions(domain);

        if (!domain.adapterHostnameId) {
            throw Error("No adapterHostnameId found for domain");
        }

        try {
            const cfStatus = await this.config.adapter.getCustomHostnameStatus(domain.adapterHostnameId);

            if (cfStatus.status === "active") {
                return this.transition(domain, "active");
            } else if (cfStatus.status === "failed") {
                return this.transition(domain, "failed", cfStatus.verificationErrors?.join(", "));
            }

            return this.getInstructions(domain);
        } catch (err) {
            // unacceptable to fail here
            // return this.getInstructions(domain); 
            throw err;

        }
    }

    async getStatus(hostname: string): Promise<DomainInstructions> {
        const domain = await this.getDomainOrThrow(hostname);
        return this.getInstructions(domain);
    }

    // Private Helpers

    private async getDomainOrThrow(hostname: string): Promise<Domain> {
        const domain = await this.config.store.getByHostname(hostname);
        if (!domain) {
            throw new DomainNotFoundError(hostname);
        }
        return domain;
    }

    private async transition(domain: Domain, next: DomainStatus, error?: string): Promise<DomainInstructions> {
        assertTransition(domain.status, next);

        domain.status = next;
        domain.updatedAt = new Date();
        if (error) domain.error = error;

        const updated = await this.config.store.update(domain);
        return this.getInstructions(updated);
    }

    private getInstructions(domain: Domain): DomainInstructions {
        const instructions: DomainInstructions = {
            hostname: domain.hostname,
            status: domain.status,
            nextStep: this.getNextStepMessage(domain.status),
        };

        if (domain.status === "pending_verification") {
            instructions.verification = {
                type: "TXT",
                name: `${verificationKey}.${domain.hostname}`,
                value: domain.verificationToken,
                description: "Add this TXT record to verify ownership of the domain.",
            };
        }

        if (domain.status === "pending_dns" || domain.status === "provisioning_ssl") {
            instructions.provisioning = [{
                type: "CNAME",
                name: domain.hostname,
                value: this.config.cnameTarget,
                description: `Point your domain to our edge network.`,
            }];
        }

        return instructions;
    }

    private getNextStepMessage(status: DomainStatus): string {
        switch (status) {
            case "created": return "Initializing domain...";
            case "pending_verification": return "Add the TXT record to your DNS provider.";
            case "verified": return "DNS verified. You can now get DNS instructions for provisioning.";
            case "pending_dns": return "Point your CNAME record to our edge.";
            case "provisioning_ssl": return "SSL is being provisioned. This may take a few minutes.";
            case "active": return "Domain is active and ready.";
            case "failed": return "Process failed. Check logs and retry.";
            default: return "Unknown state.";
        }
    }

    private normalizeHostname(hostname: string): string {
        return hostname.toLowerCase().trim().replace(/\/$/, "");
    }

    private generateToken(): string {
        // TODO: Replace with random token generation in production
        // return `vc-token-5dbb2367f71952045de56834a1730c9d`;
        return `vc-token-${randomBytes(16).toString("hex")}`;
    }
}
