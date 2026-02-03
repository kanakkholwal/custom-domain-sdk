import { beforeEach, describe, expect, it, mock } from "bun:test";
import { AdapterInterface } from "../src/adapters/interface";
import { DomainService } from "../src/core/domain.service";
import { InMemoryDomainStore } from "../src/core/store.memory";
import { DnsResolver } from "../src/dns/dns.resolver";
import {
    DnsVerificationFailedError,
    DomainNotFoundError
} from "../src/errors/errors";

describe("DomainService", () => {
    let service: DomainService;
    let store: InMemoryDomainStore;
    let mockDns: DnsResolver;
    let mockAdapter: AdapterInterface<any>;

    const CNAME_TARGET = "edge.example.com";

    beforeEach(() => {
        store = new InMemoryDomainStore();
        mockDns = {
            resolveTxt: mock(async () => []),
            resolveCname: mock(async () => []),
            resolveA: mock(async () => []),
        };
        mockAdapter = {
            createCustomHostname: mock(async () => "adapter-123"),
            getCustomHostnameStatus: mock(async (id: string) => ({ id, status: "pending" as const })),
            deleteCustomHostname: mock(async () => { }),
        };

        service = new DomainService({
            store,
            dns: mockDns,
            adapter: mockAdapter,
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
            expect(createRes.verification).toBeDefined();

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
            mockAdapter.getCustomHostnameStatus = mock(async (id: string) => ({
                id,
                status: "active" as const
            }));
            const syncRes = await service.syncStatus(hostname);
            expect(syncRes.status).toBe("active");
        });

        it("should fail verification if TXT record doesn't match", async () => {
            const hostname = getRandHostname("fail-verify");
            await service.createDomain(hostname);
            mockDns.resolveTxt = mock(async () => ["wrong-token"]);

            await expect(service.checkVerification(hostname)).rejects.toThrow(DnsVerificationFailedError);
        });

        it("should fail provisioning if CNAME doesn't point to target", async () => {
            const hostname = getRandHostname("fail-dns");
            await service.createDomain(hostname);

            const domain = await store.getByHostname(hostname);
            if (domain) await store.update({ ...domain, status: "pending_dns" });

            mockDns.resolveCname = mock(async () => ["wrong.target.com"]);
            mockDns.resolveA = mock(async () => []);

            await expect(service.provisionDomain(hostname)).rejects.toThrow(DnsVerificationFailedError);
        });

        it("should transition to failed if Adapter API fails during provisioning", async () => {
            const hostname = getRandHostname("fail-adapter");
            await service.createDomain(hostname);

            const domain = await store.getByHostname(hostname);
            if (domain) await store.update({ ...domain, status: "pending_dns" });

            mockDns.resolveCname = mock(async () => [CNAME_TARGET]);
            mockAdapter.createCustomHostname = mock(async () => { throw new Error("Adapter API Down"); });

            await expect(service.provisionDomain(hostname)).rejects.toThrow("Adapter API Down");

            const status = await service.getStatus(hostname);
            expect(status.status).toBe("failed");
        });

        it("should transition to failed if adapter reports failure during sync", async () => {
            const hostname = getRandHostname("fail-sync");
            await service.createDomain(hostname);

            const domain = await store.getByHostname(hostname);
            if (domain) await store.update({
                ...domain,
                status: "provisioning_ssl",
                adapterHostnameId: "adapter-123"
            });

            mockAdapter.getCustomHostnameStatus = mock(async () => ({
                status: "failed",
                verificationErrors: ["SSL resolution failed"]
            }));

            const syncRes = await service.syncStatus(hostname);
            expect(syncRes.status).toBe("failed");

            const finalDomain = await store.getByHostname(hostname);
            expect(finalDomain?.error).toBe("SSL resolution failed");
        });
    });

    describe("Error Handling", () => {
        it("should throw DomainNotFoundError for unknown domains", async () => {
            await expect(service.getStatus("unknown.com")).rejects.toThrow(DomainNotFoundError);
        });
    });
});
