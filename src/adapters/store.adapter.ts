import { Domain } from "../core/domain.types.js";

export interface DomainStore {
    getByHostname(hostname: string): Promise<Domain | null>;
    create(domain: Domain): Promise<Domain>;
    update(domain: Domain): Promise<Domain>;
}
