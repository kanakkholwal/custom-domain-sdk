import { beforeEach, describe, expect, it } from "bun:test";
import { InMemoryDomainStore } from "../src/adapters/store.memory.js";
import { Domain } from "../src/core/domain.types.js";
import { DomainNotFoundError } from "../src/errors/errors.js";

describe("InMemoryDomainStore", () => {
    let store: InMemoryDomainStore;

    beforeEach(() => {
        store = new InMemoryDomainStore();
    });

    const mockDomain: Domain = {
        id: "1",
        hostname: "test.com",
        status: "created",
        verificationToken: "token-1",
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    it("should create and retrieve a domain", async () => {
        await store.create(mockDomain);
        const result = await store.getByHostname("test.com");
        expect(result).toEqual(mockDomain);
        expect(result).not.toBe(mockDomain); // Should be a clone
    });

    it("should return null for non-existent domain", async () => {
        const result = await store.getByHostname("none.com");
        expect(result).toBeNull();
    });

    it("should normalize hostnames on retrieval", async () => {
        await store.create(mockDomain);
        const result = await store.getByHostname(" TEST.com ");
        expect(result?.hostname).toBe("test.com");
    });

    it("should update an existing domain", async () => {
        await store.create(mockDomain);
        const updated = { ...mockDomain, status: "verified" as const };
        const result = await store.update(updated);
        expect(result.status).toBe("verified");

        const retrieved = await store.getByHostname("test.com");
        expect(retrieved?.status).toBe("verified");
    });

    it("should throw DomainNotFoundError when updating non-existent domain", async () => {
        expect(store.update(mockDomain)).rejects.toThrow(DomainNotFoundError);
    });
});
