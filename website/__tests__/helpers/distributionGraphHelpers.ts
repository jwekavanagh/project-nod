import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);

export type PublicProductAnchors = {
  identityOneLiner: string;
  productionCanonicalOrigin: string;
  gitRepositoryUrl: string;
  gitRepositoryGitUrl: string;
  npmPackageUrl: string;
  bugsUrl: string;
  keywords: string[];
};

export function getRepoRoot(): string {
  return join(fileURLToPath(new URL(".", import.meta.url)), "../../..");
}

export function loadAnchors(): PublicProductAnchors {
  const p = join(getRepoRoot(), "config", "primary-marketing.json");
  return JSON.parse(readFileSync(p, "utf8")) as PublicProductAnchors;
}

export function loadDiscoveryAcquisitionPageDescription(): string {
  const p = join(getRepoRoot(), "config", "primary-marketing.json");
  const raw = JSON.parse(readFileSync(p, "utf8")) as { pageMetadata: { description: string } };
  return raw.pageMetadata.description;
}

export function loadDiscoveryAcquisitionSlug(): string {
  const p = join(getRepoRoot(), "config", "primary-marketing.json");
  const raw = JSON.parse(readFileSync(p, "utf8")) as { slug: string };
  return raw.slug;
}

export function expectedNpmPackageJsonFields(anchors: PublicProductAnchors) {
  const { normalize } = require("../../../scripts/public-product-anchors.cjs") as {
    normalize: (s: string) => string;
  };
  return {
    description: loadDiscoveryAcquisitionPageDescription(),
    homepage: normalize(anchors.productionCanonicalOrigin) + loadDiscoveryAcquisitionSlug(),
    repository: { type: "git", url: anchors.gitRepositoryGitUrl },
    bugs: { url: anchors.bugsUrl },
    keywords: anchors.keywords,
  };
}
