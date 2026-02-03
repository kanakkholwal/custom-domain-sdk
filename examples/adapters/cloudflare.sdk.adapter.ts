import Cloudflare from "cloudflare";
import { AdapterInterface } from "../../src/adapters/interface";

export type CloudflareHostnameStatus = "pending" | "active" | "failed" | "moved";

export interface CloudflareHostnameResponse {
    id: string;
    status: CloudflareHostnameStatus;
    sslStatus: string;
    verificationErrors?: string[];
}

export interface CloudflareAdapterInterface extends AdapterInterface<CloudflareHostnameResponse> {

    setZoneId(zoneId: string): void;
    createCustomHostname(hostname: string): Promise<CloudflareHostnameResponse>;
    getCustomHostnameStatus(id: string): Promise<CloudflareHostnameResponse>;
    deleteCustomHostname(id: string): Promise<void>;
    listCustomHostnames(page?: number, perPage?: number): Promise<CloudflareHostnameResponse[]>;


}

export class CloudflareAdapter implements CloudflareAdapterInterface {
    private client: Cloudflare;
    private zoneId: string;

    constructor(accountId: string, apiToken: string, zoneId?: string) {
        if (!accountId) {
            throw new Error("Cloudflare account ID is required");
        }

        if (!apiToken) {
            throw new Error("Cloudflare API token is required");
        }

        // Initialize the Cloudflare SDK client
        this.client = new Cloudflare({
            apiToken: apiToken,
        });

        // Zone ID is required for custom hostnames
        // If not provided in constructor, it should be set separately
        this.zoneId = zoneId || "";
    }

    /**
     * Set the zone ID for custom hostname operations
     */
    setZoneId(zoneId: string): void {
        this.zoneId = zoneId;
    }

    /**
     * Create a custom hostname in Cloudflare
     * @param hostname - The custom hostname to create (e.g., "app.customer.com")
     * @returns CloudflareHostnameResponse with hostname ID and status
     */
    async createCustomHostname(hostname: string): Promise<CloudflareHostnameResponse> {
        if (!this.zoneId) {
            throw new Error("Zone ID must be set before creating custom hostnames");
        }

        try {
            const result = await this.client.customHostnames.create({
                zone_id: this.zoneId,
                hostname,
                ssl: {
                    method: "http",
                    type: "dv",
                    settings: {
                        http2: "on",
                        min_tls_version: "1.2",
                        tls_1_3: "on",
                    },
                },
            });

            return this.mapCloudflareResponse(result);
        } catch (error) {
            console.error("[createCustomHostname] Error creating hostname:", hostname, "Error:", error);
            throw new Error(`Failed to create custom hostname: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Get the status of a custom hostname
     * @param id - The custom hostname ID
     * @returns CloudflareHostnameResponse with current status
     */
    async getCustomHostnameStatus(id: string): Promise<CloudflareHostnameResponse> {
        if (!this.zoneId) {
            throw new Error("Zone ID must be set before getting custom hostname status");
        }

        try {
            const result = await this.client.customHostnames.get(id, {
                zone_id: this.zoneId,
            });

            return this.mapCloudflareResponse(result);
        } catch (error) {
            console.error("[getCustomHostnameStatus] Error fetching status for ID:", id, "Error:", error);
            throw new Error(`Failed to get custom hostname status: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Delete a custom hostname from Cloudflare
     * @param id - The custom hostname ID to delete
     */
    async deleteCustomHostname(id: string): Promise<void> {
        if (!this.zoneId) {
            throw new Error("Zone ID must be set before deleting custom hostnames");
        }

        try {
            await this.client.customHostnames.delete(id, {
                zone_id: this.zoneId,
            });
        } catch (error) {
            console.info("[deleteCustomHostname] Error deleting hostname with ID:", id, "Error:", error);
            throw new Error(`Failed to delete custom hostname: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * List all custom hostnames for the zone
     * @param page - Page number for pagination (default: 1)
     * @param perPage - Number of results per page (default: 50)
     * @returns Array of CloudflareHostnameResponse
     */
    async listCustomHostnames(
        page: number = 1,
        perPage: number = 50
    ): Promise<CloudflareHostnameResponse[]> {
        if (!this.zoneId) {
            throw new Error("Zone ID must be set before listing custom hostnames");
        }

        try {
            const result = await this.client.customHostnames.list({
                zone_id: this.zoneId,
                page,
                per_page: perPage,
            });

            // The SDK returns a paginated response
            return result.result.map((hostname) => this.mapCloudflareResponse(hostname));
        } catch (error) {
            throw new Error(`Failed to list custom hostnames: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Map Cloudflare API response to our interface
     */
    private mapCloudflareResponse(cfResponse: any): CloudflareHostnameResponse {
        return {
            id: cfResponse.id,
            status: this.mapStatus(cfResponse.status),
            sslStatus: cfResponse.ssl?.status || "unknown",
            verificationErrors: cfResponse.verification_errors?.length
                ? cfResponse.verification_errors
                : undefined,
        };
    }

    /**
     * Map Cloudflare status to our status type
     */
    private mapStatus(cfStatus: string): CloudflareHostnameStatus {
        switch (cfStatus) {
            case "pending":
            case "pending_validation":
            case "pending_deployment":
                return "pending";
            case "active":
                return "active";
            case "blocked":
            case "deleted":
                return "failed";
            case "moved":
                return "moved";
            default:
                return "pending";
        }
    }
}