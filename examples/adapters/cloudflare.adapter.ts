import { AdapterInterface } from "./interface";

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
    private apiToken: string;
    private accountId: string;
    private zoneId: string;
    private baseUrl = "https://api.cloudflare.com/client/v4";

    constructor(accountId: string, apiToken: string, zoneId?: string) {
        this.accountId = accountId;
        if (!this.accountId) {
            throw new Error("Cloudflare account ID is required");
        }

        this.apiToken = apiToken;
        if (!this.apiToken) {
            throw new Error("Cloudflare API token is required");
        }

        // Zone ID is required for custom hostnames
        // If not provided in constructor, it should be set separately or fetched
        this.zoneId = zoneId || "";
    }

    /**
     * Set the zone ID for custom hostname operations
     */
    setZoneId(zoneId: string): void {
        this.zoneId = zoneId;
    }

    /**
     * Make an authenticated request to the Cloudflare API
     */
    private async makeRequest<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<T> {
        const url = `${this.baseUrl}${endpoint}`;

        const response = await fetch(url, {
            ...options,
            headers: {
                "Authorization": `Bearer ${this.apiToken}`,
                "Content-Type": "application/json",
                ...options.headers,
            },
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            console.error("Cloudflare API response error:", data);
            const errors = data.errors?.map((e: any) => e.message).join(", ") || "Unknown error";
            throw new Error(`Cloudflare API error: ${errors}`);
        }

        return data.result;
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

        const endpoint = `/zones/${this.zoneId}/custom_hostnames`;

        const result = await this.makeRequest<any>(endpoint, {
            method: "POST",
            body: JSON.stringify({
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
            }),
        });

        return this.mapCloudflareResponse(result);
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

        const endpoint = `/zones/${this.zoneId}/custom_hostnames/${id}`;
        const result = await this.makeRequest<any>(endpoint, {
            method: "GET",
        });

        return this.mapCloudflareResponse(result);
    }

    /**
     * Delete a custom hostname from Cloudflare
     * @param id - The custom hostname ID to delete
     */
    async deleteCustomHostname(id: string): Promise<void> {
        if (!this.zoneId) {
            throw new Error("Zone ID must be set before deleting custom hostnames");
        }

        const endpoint = `/zones/${this.zoneId}/custom_hostnames/${id}`;

        await this.makeRequest<any>(endpoint, {
            method: "DELETE",
        });
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

        const endpoint = `/zones/${this.zoneId}/custom_hostnames?page=${page}&per_page=${perPage}`;
        const result = await this.makeRequest<any[]>(endpoint, {
            method: "GET",
        });

        return result.map(this.mapCloudflareResponse);
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