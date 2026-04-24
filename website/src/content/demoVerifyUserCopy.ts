import { DEMO_ERROR_CODES } from "@/lib/demoVerifyErrorCodes";

export type DemoVerifyErrorUserCopy = { title: string; body: string };

const TABLE: Record<string, DemoVerifyErrorUserCopy> = {
  [DEMO_ERROR_CODES.UNSUPPORTED_MEDIA_TYPE]: {
    title: "We could not run that request",
    body: "The demo only accepts JSON. Refresh the page and try again.",
  },
  [DEMO_ERROR_CODES.INVALID_JSON]: {
    title: "We could not read the request",
    body: "Refresh the page and try again.",
  },
  [DEMO_ERROR_CODES.VALIDATION_FAILED]: {
    title: "Invalid scenario",
    body: "Choose a scenario from the list, then run again.",
  },
  [DEMO_ERROR_CODES.FIXTURES_MISSING]: {
    title: "Demo data is missing on the server",
    body: "Example files are not available. Try again later, or clone the repository and run the CLI locally.",
  },
  [DEMO_ERROR_CODES.UNAVAILABLE]: {
    title: "Demo is temporarily unavailable",
    body: "The service is in a maintenance window. Try again shortly.",
  },
  [DEMO_ERROR_CODES.ENGINE_FAILED]: {
    title: "Verification did not complete",
    body: "The engine failed while running this bundled scenario. If it keeps happening, share the Request ID below with support.",
  },
  [DEMO_ERROR_CODES.RESULT_SCHEMA_MISMATCH]: {
    title: "Internal validation error",
    body: "The engine produced an unexpected certificate shape. Share the Request ID below with support.",
  },
  [DEMO_ERROR_CODES.METHOD_NOT_ALLOWED]: {
    title: "Wrong HTTP method",
    body: "This action is not available. Refresh the page.",
  },
};

const FALLBACK: DemoVerifyErrorUserCopy = {
  title: "Something went wrong",
  body: "Try again. If the problem continues, share the Request ID below with support.",
};

/** Maps stable wire `error` strings from the demo API to user-facing copy. */
export function getDemoVerifyErrorCopy(errorCode: string): DemoVerifyErrorUserCopy {
  return TABLE[errorCode] ?? FALLBACK;
}

export const demoVerifyNonJsonResponseCopy: DemoVerifyErrorUserCopy = {
  title: "Unexpected response",
  body: "The demo did not return JSON. Refresh the page.",
};

/** HTTP 200 but body does not match the demo success contract (e.g. legacy shape). */
export const demoVerifyUnexpectedSuccessResponseCopy: DemoVerifyErrorUserCopy = {
  title: "Unexpected response",
  body: "The demo returned data this page cannot display. Refresh the page.",
};

export const demoVerifyNetworkErrorCopy: DemoVerifyErrorUserCopy = {
  title: "Network error",
  body: "Check your connection and try again.",
};

export const shareReportInvalidResponseCopy: DemoVerifyErrorUserCopy = FALLBACK;

export const shareReportPublicOffCopy = {
  announcement:
    "Public report sharing is off in this environment. A shareable JSON envelope (schema v2) is on your clipboard.",
} as const;

export const shareReportClipboardErrorCopy: DemoVerifyErrorUserCopy = {
  title: "Could not copy to clipboard",
  body: "Open “Show raw verification JSON” and copy it manually.",
};
