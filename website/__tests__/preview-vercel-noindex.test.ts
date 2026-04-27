import { describe, expect, it, afterEach } from "vitest";
import {
  PREVIEW_X_ROBOTS_NOINDEX,
  xRobotsTagValueForVercelPreview,
} from "@/lib/previewVercelNoindexHeader";

describe("preview Vercel noindex (X-Robots-Tag source of truth)", () => {
  const saved = process.env.VERCEL_ENV;

  afterEach(() => {
    if (saved === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = saved;
  });

  it("returns the noindex tag when VERCEL_ENV is preview", () => {
    process.env.VERCEL_ENV = "preview";
    expect(xRobotsTagValueForVercelPreview()).toBe(PREVIEW_X_ROBOTS_NOINDEX);
  });

  it("returns null when VERCEL_ENV is not preview", () => {
    delete process.env.VERCEL_ENV;
    expect(xRobotsTagValueForVercelPreview()).toBeNull();
    process.env.VERCEL_ENV = "production";
    expect(xRobotsTagValueForVercelPreview()).toBeNull();
  });
});
