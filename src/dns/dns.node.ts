import { Resolver } from "node:dns/promises";
import { DnsResolver } from "./dns.resolver";

export class NodeDnsResolver implements DnsResolver {
    private resolver: Resolver;

    constructor(nameservers?: string[]) {
        this.resolver = new Resolver();

        // Optional: force authoritative resolvers (recommended)
        if (nameservers && nameservers.length > 0) {
            this.resolver.setServers(nameservers);
        }
    }

    async resolveTxt(hostname: string): Promise<string[]> {
        try {
            const records = await this.resolver.resolveTxt(hostname);

            // TXT records come as string[][]
            return records.flat().map(v => v.trim());
        } catch (err: any) {
            if (isDnsNotFound(err)) return [];
            throw err;
        }
    }

    async resolveCname(hostname: string): Promise<string[]> {
        try {
            const records = await this.resolver.resolveCname(hostname);
            return records.map(v => normalizeHostname(v));
        } catch (err: any) {
            if (isDnsNotFound(err)) return [];
            throw err;
        }
    }

    async resolveA(hostname: string): Promise<string[]> {
        try {
            return await this.resolver.resolve4(hostname);
        } catch (err: any) {
            if (isDnsNotFound(err)) return [];
            throw err;
        }
    }
}

// helpers 
function isDnsNotFound(err: any): boolean {
    return (
        err?.code === "ENOTFOUND" ||
        err?.code === "ENODATA" ||
        err?.code === "NXDOMAIN"
    );
}

function normalizeHostname(hostname: string): string {
    return hostname.toLowerCase().replace(/\.$/, "");
}
