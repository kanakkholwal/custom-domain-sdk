import { InvalidStateTransitionError } from "../errors/errors.js";
import { DomainStatus } from "./domain.types.js";

export class DomainMachine {
    private static transitions: Record<DomainStatus, DomainStatus[]> = {
        created: ["pending_verification", "failed"],
        pending_verification: ["verified", "failed"],
        verified: ["pending_dns", "failed"],
        pending_dns: ["provisioning_ssl", "failed"],
        provisioning_ssl: ["active", "failed"],
        active: ["failed"], // Can move to failed if sync fails later
        failed: ["pending_verification"], // Allow retry from start of verification
    };

    /**
     * Validates if a transition from current to next is allowed.
     * Throws InvalidStateTransitionError if not allowed.
     */
    static validateTransition(current: DomainStatus, next: DomainStatus): void {
        const allowed = this.transitions[current];
        if (!allowed.includes(next)) {
            throw new InvalidStateTransitionError(current, next);
        }
    }
}
