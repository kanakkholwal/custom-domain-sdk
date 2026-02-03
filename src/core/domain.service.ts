import { randomBytes, randomUUID } from "node:crypto";
import { CloudflareAdapter } from "../adapters/cloudflare.adapter.js";
import { DnsResolver } from "../adapters/dns.adapter.js";
import { DomainStore } from "../adapters/store.adapter.js";
import {
    CloudflareApiError,
    DnsVerificationFailedError,
    DomainNotFoundError,
} from "../errors/errors.js";
import { assertTransition } from "./domain.machine.js";
import { Domain, DomainInstructions, DomainStatus } from "./domain.types.js";

export interface SDKConfig {
    store: DomainStore;
    dns: DnsResolver;
    cloudflare: CloudflareAdapter;
    cnameTarget: string;
}

const verificationKey = "_cdl-tenancy-verification";

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
            return this.transition(domain, "verified");
        }

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

        // Verify DNS points to us before calling Cloudflare
        const cnames = await this.config.dns.resolveCname(domain.hostname);
        if (!cnames.includes(this.config.cnameTarget)) {
            throw new CloudflareApiError(`DNS CNAME for ${domain.hostname} does not point to ${this.config.cnameTarget}`);
        }

        try {
            const cfId = await this.config.cloudflare.createCustomHostname(domain.hostname);
            domain.cloudflareHostnameId = cfId;
            return this.transition(domain, "provisioning_ssl");
        } catch (err) {
            await this.transition(domain, "failed", (err as Error).message);
            throw err;
        }
    }

    async syncStatus(hostname: string): Promise<DomainInstructions> {
        const domain = await this.getDomainOrThrow(hostname);

        if (!domain.cloudflareHostnameId) {
            if (domain.status === "active") return this.getInstructions(domain);
            throw new CloudflareApiError("No Cloudflare Hostname ID found for domain");
        }

        try {
            const cfStatus = await this.config.cloudflare.getCustomHostnameStatus(domain.cloudflareHostnameId);

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

    // --- Private Helpers ---

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
        return `vc-token-${randomBytes(16).toString("hex")}`;
    }
}
