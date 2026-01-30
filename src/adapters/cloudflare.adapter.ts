export type CloudflareHostnameStatus = "pending" | "active" | "failed" | "moved";

export interface CloudflareHostnameResponse {
    id: string;
    status: CloudflareHostnameStatus;
    sslStatus: string;
    verificationErrors?: string[];
}

export interface CloudflareAdapter {
    createCustomHostname(hostname: string): Promise<string>;
    getCustomHostnameStatus(id: string): Promise<CloudflareHostnameResponse>;
    deleteCustomHostname(id: string): Promise<void>;
}
