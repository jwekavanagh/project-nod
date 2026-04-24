import { randomUUID } from "node:crypto";

/** One `x-request-id` per commercial activation run (reserve + verify-outcome beacons). */
export function newActivationHttpCorrelationId(): string {
  return randomUUID();
}
