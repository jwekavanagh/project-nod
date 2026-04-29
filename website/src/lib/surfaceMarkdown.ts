import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { z } from "zod";

export const SURFACE_SEGMENTS = ["guides", "examples", "compare"] as const;
export type SurfaceSegment = (typeof SURFACE_SEGMENTS)[number];

const primaryCtaSchema = z.enum(["integrate", "demo", "pricing"]);

const surfaceFrontmatterSchema = z
  .object({
    surfaceKind: z.enum(["guide", "scenario", "example", "comparison"]),
    title: z.string().min(1),
    description: z.string().min(1),
    intent: z.string().min(10),
    valueProposition: z.string().min(10),
    primaryCta: primaryCtaSchema,
    route: z.string().regex(/^\/(guides|examples|compare)\/[a-z0-9-]+$/),
    evaluatorLens: z.boolean(),
    guideJob: z.enum(["problem", "implementation"]).optional(),
    symptomLead: z.string().optional(),
    embedKey: z.enum(["wf_complete", "wf_missing", "langgraph_checkpoint_trust"]).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.surfaceKind === "comparison") {
      if (data.evaluatorLens !== true) {
        ctx.addIssue({ code: "custom", message: "comparison requires evaluatorLens: true" });
      }
      if (!/\bvs\.?\b|\bversus\b|\bcompared to\b/i.test(data.title)) {
        ctx.addIssue({ code: "custom", message: "comparison title must include vs / versus / compared to" });
      }
      if (data.guideJob !== undefined) {
        ctx.addIssue({ code: "custom", message: "comparison must not set guideJob" });
      }
      if (data.symptomLead !== undefined) {
        ctx.addIssue({ code: "custom", message: "comparison must not set symptomLead" });
      }
      if (data.embedKey !== undefined) {
        ctx.addIssue({ code: "custom", message: "comparison must not set embedKey" });
      }
      return;
    }
    if (data.surfaceKind === "example") {
      if (data.evaluatorLens !== false) {
        ctx.addIssue({ code: "custom", message: "example requires evaluatorLens: false" });
      }
      if (data.embedKey === undefined) {
        ctx.addIssue({ code: "custom", message: "example requires embedKey" });
      }
      if (data.guideJob !== undefined) {
        ctx.addIssue({ code: "custom", message: "example must not set guideJob" });
      }
      if (data.symptomLead !== undefined) {
        ctx.addIssue({ code: "custom", message: "example must not set symptomLead" });
      }
      return;
    }
    if (data.surfaceKind === "guide" || data.surfaceKind === "scenario") {
      if (data.evaluatorLens !== false) {
        ctx.addIssue({ code: "custom", message: "guide/scenario requires evaluatorLens: false" });
      }
      if (data.embedKey !== undefined) {
        ctx.addIssue({ code: "custom", message: "guide/scenario must not set embedKey" });
      }
      if (data.guideJob === undefined) {
        ctx.addIssue({ code: "custom", message: "guide/scenario requires guideJob" });
      }
      if (data.surfaceKind === "scenario") {
        if (data.guideJob !== "problem") {
          ctx.addIssue({ code: "custom", message: "scenario requires guideJob: problem" });
        }
        const sl = data.symptomLead;
        if (!sl || sl.length < 20) {
          ctx.addIssue({ code: "custom", message: "scenario requires symptomLead (min 20 chars)" });
        } else if (!/^(When|After|If)\b/.test(sl)) {
          ctx.addIssue({ code: "custom", message: "symptomLead must start with When, After, or If" });
        }
      }
    }
  });

export type SurfaceFrontmatter = z.infer<typeof surfaceFrontmatterSchema>;

export type ParsedSurfaceFile = SurfaceFrontmatter & {
  body: string;
  segment: SurfaceSegment;
  slug: string;
};

export function surfacesContentRoot(): string {
  return join(process.cwd(), "content", "surfaces");
}

export function expectedRouteForFile(segment: SurfaceSegment, slug: string): string {
  return `/${segment}/${slug}`;
}

export function splitFrontmatter(raw: string): { yaml: string; body: string } {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!m) {
    throw new Error("surface markdown: expected leading --- YAML --- body");
  }
  return { yaml: m[1], body: m[2] };
}

export function parseSurfaceMarkdownRaw(raw: string, segment: SurfaceSegment, slug: string): ParsedSurfaceFile {
  const { yaml, body } = splitFrontmatter(raw);
  const fm = surfaceFrontmatterSchema.parse(parseYaml(yaml));
  const expected = expectedRouteForFile(segment, slug);
  if (fm.route !== expected) {
    throw new Error(`surface markdown: route must be ${expected}, got ${fm.route}`);
  }
  if (!body.includes("## What to do next")) {
    throw new Error("surface markdown: body must include ## What to do next");
  }
  const widx = body.indexOf("## What to do next");
  const afterWhat = body.slice(widx);
  const linkRe =
    /\]\((\/integrate|\/pricing|\/database-truth-vs-traces|\/guides|\/examples\/wf-complete|\/examples\/wf-missing|\/security|\/verify)\)/g;
  const linkMatches = [...afterWhat.matchAll(linkRe)];
  if (linkMatches.length < 2) {
    throw new Error("surface markdown: ## What to do next must include at least two allowlisted markdown links");
  }
  if (fm.surfaceKind === "scenario" && fm.symptomLead) {
    const first = firstBodyParagraph(body);
    if (!first.includes(fm.symptomLead)) {
      throw new Error("surface markdown: scenario first paragraph must contain symptomLead verbatim");
    }
  }
  if (fm.surfaceKind === "comparison") {
    if (!body.includes("/pricing") || !body.includes("/integrate")) {
      throw new Error("surface markdown: comparison body must contain /pricing and /integrate");
    }
  }
  return { ...fm, body, segment, slug };
}

export function readSurfaceFile(segment: SurfaceSegment, slug: string): ParsedSurfaceFile {
  const p = join(surfacesContentRoot(), segment, `${slug}.md`);
  if (!existsSync(p)) {
    throw new Error(`surface markdown: missing file ${p}`);
  }
  return parseSurfaceMarkdownRaw(readFileSync(p, "utf8"), segment, slug);
}

export function listSlugsForSegment(segment: SurfaceSegment): string[] {
  const dir = join(surfacesContentRoot(), segment);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.replace(/\.md$/, ""))
    .sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
}

export type ListedSurface = ParsedSurfaceFile;

export function listAllSurfaces(): ListedSurface[] {
  const out: ListedSurface[] = [];
  for (const segment of SURFACE_SEGMENTS) {
    for (const slug of listSlugsForSegment(segment)) {
      out.push(readSurfaceFile(segment, slug));
    }
  }
  const routes = out.map((s) => s.route);
  const uniq = new Set(routes);
  if (uniq.size !== routes.length) {
    throw new Error(`surface markdown: duplicate route in content/surfaces: ${routes.join(", ")}`);
  }
  let impl = 0;
  for (const s of out) {
    if (s.guideJob === "implementation") impl += 1;
  }
  if (impl !== 1) {
    throw new Error(`surface markdown: expected exactly one guideJob: implementation, found ${impl}`);
  }
  const implFile = out.find((s) => s.guideJob === "implementation");
  if (!implFile || implFile.route !== "/guides/first-run-verification") {
    throw new Error("surface markdown: implementation-led guide must be /guides/first-run-verification");
  }
  return out.sort((a, b) => a.route.localeCompare(b.route, "en", { sensitivity: "base" }));
}

export function listDiscoveryRoutes(): string[] {
  return listAllSurfaces().map((s) => s.route);
}

/** First non-empty prose paragraph of markdown body (before first `##`), skipping a leading `#` heading block. */
export function firstBodyParagraph(body: string): string {
  const trimmed = body.trim();
  const idx = trimmed.search(/^##\s/m);
  const head = idx === -1 ? trimmed : trimmed.slice(0, idx);
  const paras = head
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\n+/g, " ").trim())
    .filter(Boolean)
    .filter((p) => !/^#\s/.test(p));
  return paras[0] ?? "";
}
