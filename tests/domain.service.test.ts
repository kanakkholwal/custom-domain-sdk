import { beforeEach, describe, expect, it, mock } from "bun:test";
import { CloudflareAdapter } from "../src/adapters/cloudflare.adapter.js";
import { DnsResolver } from "../src/adapters/dns.adapter.js";
import { InMemoryDomainStore } from "../src/adapters/store.memory.js";
import { DomainService } from "../src/core/domain.service.js";
import {
    CloudflareApiError,
    DnsVerificationFailedError,
    DomainNotFoundError
} from "../src/errors/errors.js";

describe("DomainService", () => {
    let service: DomainService;
    let store: InMemoryDomainStore;
    let mockDns: DnsResolver;
    let mockCf: CloudflareAdapter;

    const CNAME_TARGET = "edge.example.com";

    beforeEach(() => {
        store = new InMemoryDomainStore();
        mockDns = {
            resolveTxt: mock(async () => []),
            resolveCname: mock(async () => []),
            resolveA: mock(async () => []),
        };
        mockCf = {
            createCustomHostname: mock(async () => "cdl-123"),
            getCustomHostnameStatus: mock(async (id: string) => ({ id, status: "pending" as const, sslStatus: "pending" })),
            deleteCustomHostname: mock(async () => { }),
        };

        service = new DomainService({
            store,
            dns: mockDns,
            cloudflare: mockCf,
            cnameTarget: CNAME_TARGET,
        });
    });

    const getRandHostname = (prefix: string) => `${prefix}-${Math.random().toString(36).substring(7)}.com`;

    describe("Full Lifecycle", () => {
        it("should complete the full domain lifecycle", async () => {
            const hostname = getRandHostname("full");

            // 1. Create
            const createRes = await service.createDomain(hostname);
            expect(createRes.status).toBe("pending_verification");

            // 2. Verify
            mockDns.resolveTxt = mock(async () => [createRes.verification!.value]);
            const verifyRes = await service.checkVerification(hostname);
            expect(verifyRes.status).toBe("verified");

            // 3. DNS Instructions
            const dnsRes = await service.getDnsInstructions(hostname);
            expect(dnsRes.status).toBe("pending_dns");

            // 4. Provision
            mockDns.resolveCname = mock(async () => [CNAME_TARGET]);
            const provisionRes = await service.provisionDomain(hostname);
            expect(provisionRes.status).toBe("provisioning_ssl");

            // 5. Sync
            mockCf.getCustomHostnameStatus = mock(async (id: string) => ({ id, status: "active" as const, sslStatus: "active" }));
            const syncRes = await service.syncStatus(hostname);
            expect(syncRes.status).toBe("active");
        });

        it("should fail verification if TXT record doesn't match", async () => {
            const hostname = getRandHostname("fail-verify");
            await service.createDomain(hostname);
            mockDns.resolveTxt = mock(async () => ["wrong-token"]);

            expect(service.checkVerification(hostname)).rejects.toThrow(DnsVerificationFailedError);
        });

        it("should fail provisioning if CNAME doesn't point to target", async () => {
            const hostname = getRandHostname("fail-dns");
            await service.createDomain(hostname);

            const domain = await store.getByHostname(hostname);
            if (domain) await store.update({ ...domain, status: "verified" });

            await service.getDnsInstructions(hostname);
            mockDns.resolveCname = mock(async () => ["wrong.target.com"]);

            await expect(service.provisionDomain(hostname)).rejects.toThrow(CloudflareApiError);
        });

        it("should transition to failed if Cloudflare API fails during provisioning", async () => {
            const hostname = getRandHostname("fail-cf");
            await service.createDomain(hostname);

            const domain = await store.getByHostname(hostname);
            if (domain) await store.update({ ...domain, status: "verified" });

            await service.getDnsInstructions(hostname);

            mockDns.resolveCname = mock(async () => [CNAME_TARGET]);
            mockCf.createCustomHostname = mock(async () => { throw new Error("CF API Down"); });

            await expect(service.provisionDomain(hostname)).rejects.toThrow("CF API Down");

            const status = await service.getStatus(hostname);
            expect(status.status).toBe("failed");
        });
    });

    describe("Error Handling", () => {
        it("should throw DomainNotFoundError for unknown domains", async () => {
            await expect(service.getStatus("unknown.com")).rejects.toThrow(DomainNotFoundError);
        });
    });
});
