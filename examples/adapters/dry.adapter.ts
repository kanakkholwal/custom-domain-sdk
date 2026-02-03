import { AdapterInterface } from "./interface";

export class DryRunCloudflareAdapter implements AdapterInterface<{
    status: "pending" | "active" | "failed";
    verificationErrors?: string[];
}> {
    async createCustomHostname(hostname: string): Promise<{
        status: "pending" | "active" | "failed";
        verificationErrors?: string[];
    }> {
        console.info("[DRY-RUN] createCustomHostname", {
            hostname,
            endpoint: "POST /zones/:zone_id/custom_hostnames",
        });

        // Simulate pending status
        return { status: "pending" };
    }

    async getCustomHostnameStatus(id: string): Promise<{
        status: "pending" | "active" | "failed";
        verificationErrors?: string[];
    }> {
        console.info("[DRY-RUN] getCustomHostnameStatus", {
            id,
            endpoint: "GET /zones/:zone_id/custom_hostnames/:id",
        });

        // Simulate eventual success
        return { status: "active" };
    }
    async deleteCustomHostname(id: string): Promise<void> {
        console.info("[DRY-RUN] deleteCustomHostname", {
            id,
            endpoint: "DELETE /zones/:zone_id/custom_hostnames/:id",
        });
        // No return value
    }
}
