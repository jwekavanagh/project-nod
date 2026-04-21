/**
 * Syncs fenced buyer summaries from normative docs into website/content/surfaces/guides/buyer-*.md
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function extractFence(fileRel, beginMarker, endMarker) {
  const p = join(root, fileRel);
  const body = readFileSync(p, "utf8");
  const i = body.indexOf(beginMarker);
  const j = body.indexOf(endMarker);
  if (i < 0 || j < 0 || j <= i) {
    throw new Error(`sync-buyer-authority-surfaces: missing fence in ${fileRel}`);
  }
  return body.slice(i + beginMarker.length, j).replace(/^\r?\n/, "").replace(/\r?\n$/, "").trim();
}

const whatToDoNext = `## What to do next

- Follow the mechanical path on [\`/integrate\`](/integrate) with your prepared database.
- Browse adjacent guides on [\`/guides\`](/guides) when you need deeper scenarios.
- Compare bundled outcomes at [\`/examples/wf-complete\`](/examples/wf-complete) and [\`/examples/wf-missing\`](/examples/wf-missing).
- Read the acquisition narrative at [\`/database-truth-vs-traces\`](/database-truth-vs-traces) when traces are not enough as proof for buyers.
- Review [\`/pricing\`](/pricing) for metering, API keys, and plan caps before widening production use.
- Review [\`/security\`](/security) before you grant database credentials to verification.`;

const surfaces = [
  {
    doc: "docs/commercial-ssot.md",
    begin: "<!-- buyer-surface-commercial-boundary:begin -->",
    end: "<!-- buyer-surface-commercial-boundary:end -->",
    slug: "buyer-commercial-boundary",
    frontmatter: `---
surfaceKind: guide
guideJob: problem
title: Buyer — commercial boundary and evaluation path — AgentSkeptic
description: On-site summary of OSS versus paid CLI boundaries and where to run /integrate before upgrading at /pricing.
intent: Buyers who need one page for commercial gating facts and the evaluation spine without reading the full commercial SSOT.
valueProposition: You see which commands require reserve metering, how Starter behaves, and which canonical site paths to follow next.
primaryCta: pricing
route: /guides/buyer-commercial-boundary
evaluatorLens: false
---`,
  },
  {
    doc: "docs/ci-enforcement.md",
    begin: "<!-- buyer-surface-ci-enforcement-metering:begin -->",
    end: "<!-- buyer-surface-ci-enforcement-metering:end -->",
    slug: "buyer-ci-enforcement-metering",
    frontmatter: `---
surfaceKind: guide
guideJob: problem
title: Buyer — CI enforcement and metering — AgentSkeptic
description: On-site summary of lock pinning, enforce gating, and reserve metering for CI pipelines using AgentSkeptic.
intent: Teams wiring CI who need the same metering facts as docs/ci-enforcement.md without leaving the marketing site.
valueProposition: You see how output-lock and expect-lock relate to OSS versus commercial builds and the license reserve API.
primaryCta: integrate
route: /guides/buyer-ci-enforcement-metering
evaluatorLens: false
---`,
  },
  {
    doc: "docs/verification-product-ssot.md",
    begin: "<!-- buyer-surface-trust-production-implications:begin -->",
    end: "<!-- buyer-surface-trust-production-implications:end -->",
    slug: "buyer-trust-production-implications",
    frontmatter: `---
surfaceKind: guide
guideJob: problem
title: Buyer — trust and production implications — AgentSkeptic
description: On-site summary of what a green verdict means for production decisions and where normative certificate semantics live.
intent: Security and platform buyers who need trust boundaries without reading the full verification product SSOT first.
valueProposition: You see the limits of quick mode versus contract certificates and pointers to the normative outcome certificate docs.
primaryCta: integrate
route: /guides/buyer-trust-production-implications
evaluatorLens: false
---`,
  },
];

const outDir = join(root, "website", "content", "surfaces", "guides");
mkdirSync(outDir, { recursive: true });

for (const s of surfaces) {
  const fenceBody = extractFence(s.doc, s.begin, s.end);
  const md = `${s.frontmatter}\n\n${fenceBody}\n\n${whatToDoNext}\n`;
  const outPath = join(outDir, `${s.slug}.md`);
  writeFileSync(outPath, md, "utf8");
  console.log(`Wrote ${outPath}`);
}
