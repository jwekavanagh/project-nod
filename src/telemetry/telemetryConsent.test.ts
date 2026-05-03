import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resetCliInstallIdModuleStateForTests } from "./cliInstallId.js";
import {
  hasPersistedTelemetryPreference,
  isProductActivationTelemetryEnabled,
  readPersistedTelemetryBoolean,
  tryPersistTelemetryPreference,
} from "./telemetryConsent.js";

function sandboxHome(home: string): void {
  process.env.HOME = home;
  if (process.platform === "win32") {
    process.env.USERPROFILE = home;
  }
}

describe("telemetryConsent", () => {
  let prevHome: string | undefined;
  let prevUserProfile: string | undefined;
  let prevTelemetry: string | undefined;

  beforeEach(() => {
    prevHome = process.env.HOME;
    prevUserProfile = process.env.USERPROFILE;
    prevTelemetry = process.env.AGENTSKEPTIC_TELEMETRY;
    resetCliInstallIdModuleStateForTests();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    if (prevHome === undefined) delete process.env.HOME;
    else process.env.HOME = prevHome;
    if (process.platform === "win32") {
      if (prevUserProfile === undefined) delete process.env.USERPROFILE;
      else process.env.USERPROFILE = prevUserProfile;
    }
    if (prevTelemetry === undefined) delete process.env.AGENTSKEPTIC_TELEMETRY;
    else process.env.AGENTSKEPTIC_TELEMETRY = prevTelemetry;
    resetCliInstallIdModuleStateForTests();
  });

  it("default unset env and no config → disabled", () => {
    const home = join(tmpdir(), `as-tc-off-${Date.now()}`);
    mkdirSync(home, { recursive: true });
    try {
      sandboxHome(home);
      delete process.env.AGENTSKEPTIC_TELEMETRY;
      expect(isProductActivationTelemetryEnabled()).toBe(false);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("AGENTSKEPTIC_TELEMETRY=0 → disabled even when config true", () => {
    const home = join(tmpdir(), `as-tc-env0-${Date.now()}`);
    mkdirSync(join(home, ".agentskeptic"), { recursive: true });
    writeFileSync(join(home, ".agentskeptic", "config.json"), JSON.stringify({ telemetry: true }), "utf8");
    try {
      sandboxHome(home);
      process.env.AGENTSKEPTIC_TELEMETRY = "0";
      expect(isProductActivationTelemetryEnabled()).toBe(false);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("AGENTSKEPTIC_TELEMETRY=1 → enabled even when config false", () => {
    const home = join(tmpdir(), `as-tc-env1-${Date.now()}`);
    mkdirSync(join(home, ".agentskeptic"), { recursive: true });
    writeFileSync(join(home, ".agentskeptic", "config.json"), JSON.stringify({ telemetry: false }), "utf8");
    try {
      sandboxHome(home);
      process.env.AGENTSKEPTIC_TELEMETRY = "1";
      expect(isProductActivationTelemetryEnabled()).toBe(true);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("non-1 non-empty env → disabled; config true still applies when env cleared", () => {
    const home = join(tmpdir(), `as-tc-badenv-${Date.now()}`);
    mkdirSync(join(home, ".agentskeptic"), { recursive: true });
    writeFileSync(join(home, ".agentskeptic", "config.json"), JSON.stringify({ telemetry: true }), "utf8");
    try {
      sandboxHome(home);
      process.env.AGENTSKEPTIC_TELEMETRY = "yes";
      expect(isProductActivationTelemetryEnabled()).toBe(false);
      delete process.env.AGENTSKEPTIC_TELEMETRY;
      expect(isProductActivationTelemetryEnabled()).toBe(true);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("persisted telemetry true enables when env unset", () => {
    const home = join(tmpdir(), `as-tc-cfg-${Date.now()}`);
    mkdirSync(join(home, ".agentskeptic"), { recursive: true });
    writeFileSync(join(home, ".agentskeptic", "config.json"), JSON.stringify({ telemetry: true }), "utf8");
    try {
      sandboxHome(home);
      delete process.env.AGENTSKEPTIC_TELEMETRY;
      expect(isProductActivationTelemetryEnabled()).toBe(true);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("persisted telemetry false disables when env unset", () => {
    const home = join(tmpdir(), `as-tc-cfgf-${Date.now()}`);
    mkdirSync(join(home, ".agentskeptic"), { recursive: true });
    writeFileSync(join(home, ".agentskeptic", "config.json"), JSON.stringify({ telemetry: false }), "utf8");
    try {
      sandboxHome(home);
      delete process.env.AGENTSKEPTIC_TELEMETRY;
      expect(isProductActivationTelemetryEnabled()).toBe(false);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("malformed config → readPersistedTelemetryBoolean null; disabled", () => {
    const home = join(tmpdir(), `as-tc-bad-${Date.now()}`);
    mkdirSync(join(home, ".agentskeptic"), { recursive: true });
    writeFileSync(join(home, ".agentskeptic", "config.json"), "{ not json", "utf8");
    try {
      sandboxHome(home);
      delete process.env.AGENTSKEPTIC_TELEMETRY;
      expect(readPersistedTelemetryBoolean()).toBe(null);
      expect(hasPersistedTelemetryPreference()).toBe(false);
      expect(isProductActivationTelemetryEnabled()).toBe(false);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("telemetry string in config → not a boolean preference", () => {
    const home = join(tmpdir(), `as-tc-str-${Date.now()}`);
    mkdirSync(join(home, ".agentskeptic"), { recursive: true });
    writeFileSync(join(home, ".agentskeptic", "config.json"), JSON.stringify({ telemetry: "true" }), "utf8");
    try {
      sandboxHome(home);
      delete process.env.AGENTSKEPTIC_TELEMETRY;
      expect(readPersistedTelemetryBoolean()).toBe(null);
      expect(hasPersistedTelemetryPreference()).toBe(false);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("tryPersistTelemetryPreference merges unknown keys", () => {
    const home = join(tmpdir(), `as-tc-merge-${Date.now()}`);
    mkdirSync(join(home, ".agentskeptic"), { recursive: true });
    writeFileSync(
      join(home, ".agentskeptic", "config.json"),
      JSON.stringify({ custom_key: 42, install_id: "00000000-0000-4000-8000-000000000001" }),
      "utf8",
    );
    try {
      sandboxHome(home);
      expect(tryPersistTelemetryPreference(false)).toBe(true);
      const disk = JSON.parse(readFileSync(join(home, ".agentskeptic", "config.json"), "utf8")) as Record<
        string,
        unknown
      >;
      expect(disk.telemetry).toBe(false);
      expect(disk.custom_key).toBe(42);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});
