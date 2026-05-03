import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resetCliInstallIdModuleStateForTests } from "./cliInstallId.js";
import { resetTelemetryStatusLineForTests } from "./telemetryStatusLine.js";
import { maybePromptTelemetryAfterFirstOfflineSuccess } from "./telemetryOfflineConsentPrompt.js";

function sandboxHome(home: string): void {
  process.env.HOME = home;
  if (process.platform === "win32") {
    process.env.USERPROFILE = home;
  }
}

describe("telemetryOfflineConsentPrompt", () => {
  let prevHome: string | undefined;
  let prevUserProfile: string | undefined;
  let prevTelemetry: string | undefined;
  let prevCi: string | undefined;
  let prevIsTTYin: boolean;
  let prevIsTTYout: boolean;
  let prevIsTTYerr: boolean;

  beforeEach(() => {
    prevHome = process.env.HOME;
    prevUserProfile = process.env.USERPROFILE;
    prevTelemetry = process.env.AGENTSKEPTIC_TELEMETRY;
    prevCi = process.env.CI;
    prevIsTTYin = process.stdin.isTTY;
    prevIsTTYout = process.stdout.isTTY;
    prevIsTTYerr = process.stderr.isTTY;
    resetCliInstallIdModuleStateForTests();
    resetTelemetryStatusLineForTests();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(process.stdin, "isTTY", { value: prevIsTTYin, configurable: true });
    Object.defineProperty(process.stdout, "isTTY", { value: prevIsTTYout, configurable: true });
    Object.defineProperty(process.stderr, "isTTY", { value: prevIsTTYerr, configurable: true });
    if (prevHome === undefined) delete process.env.HOME;
    else process.env.HOME = prevHome;
    if (process.platform === "win32") {
      if (prevUserProfile === undefined) delete process.env.USERPROFILE;
      else process.env.USERPROFILE = prevUserProfile;
    }
    if (prevTelemetry === undefined) delete process.env.AGENTSKEPTIC_TELEMETRY;
    else process.env.AGENTSKEPTIC_TELEMETRY = prevTelemetry;
    if (prevCi === undefined) delete process.env.CI;
    else process.env.CI = prevCi;
    resetCliInstallIdModuleStateForTests();
    resetTelemetryStatusLineForTests();
  });

  it("CI=true skips prompt and does not write config", async () => {
    const home = join(tmpdir(), `as-prompt-ci-${Date.now()}`);
    mkdirSync(home, { recursive: true });
    try {
      sandboxHome(home);
      delete process.env.AGENTSKEPTIC_TELEMETRY;
      process.env.CI = "true";
      Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true });
      Object.defineProperty(process.stderr, "isTTY", { value: true, configurable: true });
      await maybePromptTelemetryAfterFirstOfflineSuccess(
        {
          verificationUsedOnlyLocalSqliteFile: true,
          shareReportOriginUsed: false,
          verifySucceeded: true,
        },
        { readAnswerLine: async () => "y" },
      );
      expect(existsSync(join(home, ".agentskeptic", "config.json"))).toBe(false);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("non-interactive stdin skips prompt", async () => {
    const home = join(tmpdir(), `as-prompt-nitty-${Date.now()}`);
    mkdirSync(home, { recursive: true });
    try {
      sandboxHome(home);
      delete process.env.AGENTSKEPTIC_TELEMETRY;
      delete process.env.CI;
      Object.defineProperty(process.stdin, "isTTY", { value: false, configurable: true });
      Object.defineProperty(process.stderr, "isTTY", { value: true, configurable: true });
      await maybePromptTelemetryAfterFirstOfflineSuccess(
        {
          verificationUsedOnlyLocalSqliteFile: true,
          shareReportOriginUsed: false,
          verifySucceeded: true,
        },
        { readAnswerLine: async () => "y" },
      );
      expect(existsSync(join(home, ".agentskeptic", "config.json"))).toBe(false);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("opt-in persists telemetry true", async () => {
    const home = join(tmpdir(), `as-prompt-y-${Date.now()}`);
    mkdirSync(home, { recursive: true });
    try {
      sandboxHome(home);
      delete process.env.AGENTSKEPTIC_TELEMETRY;
      delete process.env.CI;
      Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true });
      Object.defineProperty(process.stderr, "isTTY", { value: true, configurable: true });
      await maybePromptTelemetryAfterFirstOfflineSuccess(
        {
          verificationUsedOnlyLocalSqliteFile: true,
          shareReportOriginUsed: false,
          verifySucceeded: true,
        },
        { readAnswerLine: async () => "yes" },
      );
      const cfg = JSON.parse(readFileSync(join(home, ".agentskeptic", "config.json"), "utf8"));
      expect(cfg.telemetry).toBe(true);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("opt-out persists telemetry false", async () => {
    const home = join(tmpdir(), `as-prompt-n-${Date.now()}`);
    mkdirSync(home, { recursive: true });
    try {
      sandboxHome(home);
      delete process.env.AGENTSKEPTIC_TELEMETRY;
      delete process.env.CI;
      Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true });
      Object.defineProperty(process.stderr, "isTTY", { value: true, configurable: true });
      await maybePromptTelemetryAfterFirstOfflineSuccess(
        {
          verificationUsedOnlyLocalSqliteFile: true,
          shareReportOriginUsed: false,
          verifySucceeded: true,
        },
        { readAnswerLine: async () => "n" },
      );
      const cfg = JSON.parse(readFileSync(join(home, ".agentskeptic", "config.json"), "utf8"));
      expect(cfg.telemetry).toBe(false);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("skips when shareReportOriginUsed", async () => {
    const home = join(tmpdir(), `as-prompt-share-${Date.now()}`);
    mkdirSync(home, { recursive: true });
    try {
      sandboxHome(home);
      delete process.env.AGENTSKEPTIC_TELEMETRY;
      Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true });
      Object.defineProperty(process.stderr, "isTTY", { value: true, configurable: true });
      await maybePromptTelemetryAfterFirstOfflineSuccess(
        {
          verificationUsedOnlyLocalSqliteFile: true,
          shareReportOriginUsed: true,
          verifySucceeded: true,
        },
        { readAnswerLine: async () => "y" },
      );
      expect(existsSync(join(home, ".agentskeptic", "config.json"))).toBe(false);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("skips when postgres verification path", async () => {
    const home = join(tmpdir(), `as-prompt-pg-${Date.now()}`);
    mkdirSync(home, { recursive: true });
    try {
      sandboxHome(home);
      delete process.env.AGENTSKEPTIC_TELEMETRY;
      Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true });
      Object.defineProperty(process.stderr, "isTTY", { value: true, configurable: true });
      await maybePromptTelemetryAfterFirstOfflineSuccess(
        {
          verificationUsedOnlyLocalSqliteFile: false,
          shareReportOriginUsed: false,
          verifySucceeded: true,
        },
        { readAnswerLine: async () => "y" },
      );
      expect(existsSync(join(home, ".agentskeptic", "config.json"))).toBe(false);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("skips when persisted preference exists", async () => {
    const home = join(tmpdir(), `as-prompt-exists-${Date.now()}`);
    mkdirSync(join(home, ".agentskeptic"), { recursive: true });
    writeFileSync(join(home, ".agentskeptic", "config.json"), JSON.stringify({ telemetry: false }), "utf8");
    try {
      sandboxHome(home);
      delete process.env.AGENTSKEPTIC_TELEMETRY;
      Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true });
      Object.defineProperty(process.stderr, "isTTY", { value: true, configurable: true });
      await maybePromptTelemetryAfterFirstOfflineSuccess(
        {
          verificationUsedOnlyLocalSqliteFile: true,
          shareReportOriginUsed: false,
          verifySucceeded: true,
        },
        { readAnswerLine: async () => "y" },
      );
      const cfg = JSON.parse(readFileSync(join(home, ".agentskeptic", "config.json"), "utf8"));
      expect(cfg.telemetry).toBe(false);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});
