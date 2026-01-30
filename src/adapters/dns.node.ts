import { Resolver } from "node:dns/promises";
import { DnsResolver } from "./dns.adapter.js";

export class NodeDnsResolver implements DnsResolver {
    private res = new Resolver();

    async resolveTxt(hostname: string): Promise<string[]> {
        try {
            const records = await this.res.resolveTxt(hostname);
            return records.flat();
        } catch (err) {
            return [];
        }
    }

    async resolveCname(hostname: string): Promise<string[]> {
        try {
            return await this.res.resolveCname(hostname);
        } catch (err) {
            return [];
        }
    }

    async resolveA(hostname: string): Promise<string[]> {
        try {
            return await this.res.resolve4(hostname);
        } catch (err) {
            return [];
        }
    }
}
