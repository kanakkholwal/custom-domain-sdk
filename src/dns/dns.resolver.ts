export interface DnsResolver {
    resolveTxt(hostname: string): Promise<string[]>;
    resolveCname(hostname: string): Promise<string[]>;
    resolveA(hostname: string): Promise<string[]>;
}
