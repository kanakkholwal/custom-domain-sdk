export abstract class DomainError extends Error {
    constructor(message: string) {
        super(message);
        this.name = this.constructor.name;
    }
}

export class DomainNotFoundError extends DomainError {
    constructor(hostname: string) {
        super(`Domain not found: ${hostname}`);
    }
}

export class InvalidStateTransitionError extends DomainError {
    constructor(from: string, to: string) {
        super(`Invalid state transition from ${from} to ${to}`);
    }
}

export class DnsVerificationFailedError extends DomainError {
    constructor(hostname: string, expected: string, actual: string) {
        super(`DNS verification failed for ${hostname}. Expected TXT record "${expected}", but found "${actual}"`);
    }
}



export class ConfigurationError extends DomainError {
    constructor(message: string) {
        super(`Configuration error: ${message}`);
    }
}
