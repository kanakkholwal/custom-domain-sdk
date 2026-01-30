export type DomainStatus =
    | "created"
    | "pending_verification"
    | "verified"
    | "pending_dns"
    | "provisioning_ssl"
    | "active"
    | "failed";

export interface Domain {
    id: string;
    hostname: string;
    status: DomainStatus;
    verificationToken: string;
    cloudflareHostnameId?: string;
    error?: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface DnsInstruction {
    type: "TXT" | "CNAME" | "A";
    name: string;
    value: string;
    description: string;
}

export interface DomainInstructions {
    hostname: string;
    status: DomainStatus;
    verification?: DnsInstruction;
    provisioning?: DnsInstruction[];
    nextStep: string;
}
