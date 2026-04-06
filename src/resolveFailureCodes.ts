/**
 * Every `code` returned on `{ ok: false }` from resolveVerificationRequest / resolveSqlRowSpec
 * in resolveExpectation.ts. Re-exported as a Set for failureOriginCatalog.
 */
import { REGISTRY_RESOLVER_CODE } from "./wireReasonCodes.js";

export const RESOLVE_FAILURE_CODES: ReadonlySet<string> = new Set(Object.values(REGISTRY_RESOLVER_CODE));
