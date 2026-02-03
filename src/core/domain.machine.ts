// DO NOT MODIFY WITHOUT A MIGRATION PLAN
import { InvalidStateTransitionError } from "../errors/errors";
import { DomainStatus } from "./domain.types";

/**
 * Explicit, single-step, forward-only transitions.
 * No retries. No magic. Deterministic.
 */
const STATE_TRANSITIONS: Record<DomainStatus, DomainStatus[]> = {
    created: ["pending_verification"],
    pending_verification: ["verified", "failed"],
    verified: ["pending_dns"],
    pending_dns: ["provisioning_ssl", "failed"],
    provisioning_ssl: ["active", "failed"],
    active: [],
    failed: [],
};

export function canTransition(
    from: DomainStatus,
    to: DomainStatus
): boolean {
    return STATE_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(
    from: DomainStatus,
    to: DomainStatus
): void {
    if (!canTransition(from, to)) {
        throw new InvalidStateTransitionError(from, to);
    }
}
