import sitemap from "@/app/sitemap";
import { statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { publicProductAnchors } from "@/lib/publicProductAnchors";
import { lastModifiedForSitemapPath } from "@/lib/sitemapPathLastModified";
import { listSlugsForSegment } from "@/lib/surfaceMarkdown";

const cwd = process.cwd();

describe("sitemap lastModified (content-derived)", () => {
  it("uses home page source mtime for /", () => {
    const path = "src/app/page.tsx";
    const fromHelper = lastModifiedForSitemapPath("/", cwd);
    const fromDisk = statSync(join(cwd, path)).mtime;
    expect(fromHelper).toBeInstanceOf(Date);
    expect((fromHelper as Date).getTime()).toBe(fromDisk.getTime());
  });

  it("uses markdown mtime for a discovery guide route", () => {
    const slugs = listSlugsForSegment("guides");
    expect(slugs.length).toBeGreaterThan(0);
    const slug = slugs[0];
    const route = `/guides/${slug}`;
    const fromHelper = lastModifiedForSitemapPath(route, cwd);
    const fromDisk = statSync(join(cwd, "content", "surfaces", "guides", `${slug}.md`)).mtime;
    expect(fromHelper).toBeInstanceOf(Date);
    expect((fromHelper as Date).getTime()).toBe(fromDisk.getTime());
  });

  it("sitemap / entry lastModified matches stat of home page source", () => {
    const entries = sitemap();
    const base = publicProductAnchors.productionCanonicalOrigin.replace(/\/$/, "");
    const home = entries.find((e) => e.url === `${base}/`);
    expect(home?.lastModified).toBeInstanceOf(Date);
    const expected = statSync(join(cwd, "src/app/page.tsx")).mtime.getTime();
    expect((home?.lastModified as Date).getTime()).toBe(expected);
  });

  it("sitemap includes lastModified for home and a guide path", () => {
    const entries = sitemap();
    const base = publicProductAnchors.productionCanonicalOrigin.replace(/\/$/, "");
    const home = entries.find((e) => e.url === `${base}/`);
    const slug = listSlugsForSegment("guides")[0];
    const guide = entries.find((e) => e.url === `${base}/guides/${slug}`);
    expect(home?.lastModified).toBeInstanceOf(Date);
    expect(guide?.lastModified).toBeInstanceOf(Date);
  });
});

describe("sitemap lastModified (llms route)", () => {
  it("uses llms.txt route file mtime", () => {
    const p = "src/app/llms.txt/route.ts";
    const fromHelper = lastModifiedForSitemapPath("/llms.txt", cwd);
    const fromDisk = statSync(join(cwd, p)).mtime.getTime();
    expect(fromHelper).toBeInstanceOf(Date);
    expect((fromHelper as Date).getTime()).toBe(fromDisk);
  });
});
