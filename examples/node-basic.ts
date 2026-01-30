import {
    CloudflareAdapter,
    CloudflareHostnameResponse,
    DomainService,
    MemoryDomainStore,
    NodeDnsResolver
} from "../src/index";

/**
 * A mock Cloudflare adapter for demonstration purposes.
 */
class MockCloudflareAdapter implements CloudflareAdapter {
    async createCustomHostname(hostname: string): Promise<string> {
        console.log(`[Cloudflare] Creating custom hostname for ${hostname}`);
        return "cf_host_12345";
    }

    async getCustomHostnameStatus(id: string): Promise<CloudflareHostnameResponse> {
        console.log(`[Cloudflare] Checking status for ${id}`);
        return {
            id,
            status: "active",
            sslStatus: "active"
        };
    }

    async deleteCustomHostname(id: string): Promise<void> {
        console.log(`[Cloudflare] Deleting ${id}`);
    }
}

async function run() {
    const store = new MemoryDomainStore();
    const dns = new NodeDnsResolver();
    const cloudflare = new MockCloudflareAdapter();

    const sdk = new DomainService({
        store,
        dns,
        cloudflare,
        cnameTarget: "edge.yourapp.com"
    });

    const hostname = "app.test-customer.com";

    console.log("--- 1. Creating Domain ---");
    const step1 = await sdk.createDomain(hostname);
    console.log(JSON.stringify(step1, null, 2));

    console.log("\n--- 2. Checking Verification (Expected to fail if records not set) ---");
    try {
        await sdk.checkVerification(hostname);
    } catch (err) {
        console.log("Verification failed as expected:", (err as Error).message);
    }

    // To simulate verification success in real code, you'd add the TXT record to your DNS provider.
    // In a test, you might mock the DNS resolver.
}

run().catch(console.error);
