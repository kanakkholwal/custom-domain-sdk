import { DomainNotFoundError } from "../errors/errors";
import { Domain } from "./domain.types";
import { DomainStore } from "./store.adapter";

export class InMemoryDomainStore implements DomainStore {
    private readonly domains = new Map<string, Domain>();

    async getByHostname(hostname: string): Promise<Domain | null> {
        const key = normalizeHostname(hostname);
        const domain = this.domains.get(key);
        return domain ? clone(domain) : null;
    }

    async create(domain: Domain): Promise<Domain> {
        const key = normalizeHostname(domain.hostname);
        const stored = clone(domain);
        this.domains.set(key, stored);
        return clone(stored);
    }

    async update(domain: Domain): Promise<Domain> {
        const key = normalizeHostname(domain.hostname);

        if (!this.domains.has(key)) {
            throw new DomainNotFoundError(domain.hostname);
        }

        const stored = clone(domain);
        this.domains.set(key, stored);
        return clone(stored);
    }
}



function normalizeHostname(hostname: string): string {
    return hostname.trim().toLowerCase();
}

function clone<T>(value: T): T {
    return structuredClone(value);
}
