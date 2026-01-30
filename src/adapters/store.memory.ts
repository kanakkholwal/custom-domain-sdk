import { Domain } from "../core/domain.types.js";
import { DomainStore } from "./store.adapter.js";

export class MemoryDomainStore implements DomainStore {
    private store = new Map<string, Domain>();

    async getByHostname(hostname: string): Promise<Domain | null> {
        return this.store.get(hostname) || null;
    }

    async create(domain: Domain): Promise<Domain> {
        this.store.set(domain.hostname, domain);
        return domain;
    }

    async update(domain: Domain): Promise<Domain> {
        this.store.set(domain.hostname, domain);
        return domain;
    }
}
