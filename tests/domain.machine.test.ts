import { describe, expect, it } from "bun:test";
import { assertTransition, canTransition } from "../src/core/domain.machine";
import { InvalidStateTransitionError } from "../src/errors/errors";

describe("DomainMachine", () => {
    describe("canTransition", () => {
        it("should allow valid transitions", () => {
            expect(canTransition("created", "pending_verification")).toBe(true);
            expect(canTransition("pending_verification", "verified")).toBe(true);
            expect(canTransition("pending_verification", "failed")).toBe(true);
            expect(canTransition("verified", "pending_dns")).toBe(true);
            expect(canTransition("pending_dns", "provisioning_ssl")).toBe(true);
            expect(canTransition("provisioning_ssl", "active")).toBe(true);
            expect(canTransition("provisioning_ssl", "failed")).toBe(true);
        });

        it("should disallow invalid transitions", () => {
            expect(canTransition("created", "verified")).toBe(false);
            expect(canTransition("active", "created")).toBe(false);
            expect(canTransition("failed", "active")).toBe(false);
            expect(canTransition("pending_dns", "active")).toBe(false);
        });

        it("should not allow transitions from terminal states", () => {
            expect(canTransition("active", "failed")).toBe(false);
            expect(canTransition("failed", "pending_verification")).toBe(false);
        });
    });

    describe("assertTransition", () => {
        it("should not throw for valid transitions", () => {
            expect(() => assertTransition("created", "pending_verification")).not.toThrow();
        });

        it("should throw InvalidStateTransitionError for invalid transitions", () => {
            expect(() => assertTransition("created", "active")).toThrow(InvalidStateTransitionError);
        });
    });
});
