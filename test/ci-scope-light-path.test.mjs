/**
 * Contract: scripts/ci-scope-light.mjs keeps CI scope rules aligned with `.github/workflows/ci.yml`.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shouldUseLightCiPath } from "../scripts/ci-scope-light.mjs";

describe("ci-scope-light path classification", () => {
  it("pull_request is never light", () => {
    assert.equal(
      shouldUseLightCiPath({ eventName: "pull_request", ref: "refs/heads/main", head_commit: { message: "chore(release): 1.0.0" } }),
      false,
    );
  });

  it("push to SemVer-ish tag refs is light", () => {
    assert.equal(shouldUseLightCiPath({ eventName: "push", ref: "refs/tags/v1.2.3", head_commit: null }), true);
    assert.equal(shouldUseLightCiPath({ eventName: "push", ref: "refs/tags/v0.1.0-rc.1", head_commit: { message: "" } }), true);
  });

  it("push to chore(release): on main is light", () => {
    assert.equal(
      shouldUseLightCiPath({
        eventName: "push",
        ref: "refs/heads/main",
        head_commit: { message: "chore(release): 1.0.0\n\nblah" },
      }),
      true,
    );
    assert.equal(
      shouldUseLightCiPath({
        eventName: "push",
        ref: "refs/heads/main",
        head_commit: { message: "feat!: things\nmore" },
      }),
      false,
    );
  });

  it("push to feature branch stays full CI", () => {
    assert.equal(
      shouldUseLightCiPath({
        eventName: "push",
        ref: "refs/heads/fix/foo",
        head_commit: { message: "chore(release): 1.0.0\n" },
      }),
      false,
    );
  });

  it("push to main missing head_commit stays full CI", () => {
    assert.equal(shouldUseLightCiPath({ eventName: "push", ref: "refs/heads/main", head_commit: null }), false);
  });
});
