/** @vitest-environment node */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AccountServerAboveFold } from "@/app/account/AccountServerAboveFold";
import { API_KEY_ISSUED_PATTERN } from "@/lib/apiKeyCrypto";

describe("AccountServerAboveFold SSR key surface (§12)", () => {
  it("does not emit a full issued key in static markup", () => {
    const html = renderToStaticMarkup(
      <AccountServerAboveFold
        email="user@example.com"
        maskedKeySummary="wf_sk_live_****… (created)"
        showIntro={true}
      />,
    );
    expect(API_KEY_ISSUED_PATTERN.test(html)).toBe(false);
  });
});
