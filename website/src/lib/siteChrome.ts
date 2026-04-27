import { publicProductAnchors } from "./publicProductAnchors";

export type SiteChromeLink = { key: string; href: string; label: string; external: boolean };

export type SiteChromeAnchors = {
  gitRepositoryUrl: string;
  npmPackageUrl: string;
  bugsUrl: string;
};

function isLoopbackOrigin(raw: string): boolean {
  try {
    const u = new URL(/^[a-zA-Z][a-zA-Z+\-.]*:/.test(raw) ? raw : `https://${raw}`);
    const h = u.hostname.toLowerCase();
    return h === "localhost" || h === "127.0.0.1" || h === "::1" || h === "[::1]";
  } catch {
    return false;
  }
}

/**
 * Absolute OpenAPI URL for server-rendered chrome. Non-loopback `NEXT_PUBLIC_APP_URL` wins so
 * preview deploys can self-reference; loopback or empty falls back to `productionCanonicalOrigin`
 * so `next build` + `next start` HTML matches distribution tests without pinning local `.env`.
 */
export function openapiHrefFromProcessEnv(): string {
  const envBase = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "").trim();
  const anchorBase = publicProductAnchors.productionCanonicalOrigin.replace(/\/$/, "");
  if (envBase.length > 0 && !isLoopbackOrigin(envBase)) {
    return `${envBase}/openapi-commercial-v1.yaml`;
  }
  return `${anchorBase}/openapi-commercial-v1.yaml`;
}

export function buildSiteHeaderPrimaryLinks(args: {
  anchors: SiteChromeAnchors;
  acquisitionHref: string;
  acquisitionLabel: string;
}): readonly SiteChromeLink[] {
  const { anchors, acquisitionHref, acquisitionLabel } = args;
  return [
    { key: "acquisition", href: acquisitionHref, label: acquisitionLabel, external: false },
    { key: "integrate", href: "/integrate", label: "Run first verification", external: false },
    { key: "pricing", href: "/pricing", label: "Pricing", external: false },
    {
      key: "cli",
      href: `${anchors.gitRepositoryUrl}#try-it-about-one-minute`,
      label: "CLI",
      external: true,
    },
  ] as const;
}

export function buildSiteFooterProductLinks(args: {
  anchors: SiteChromeAnchors;
  openapiHref: string;
}): readonly SiteChromeLink[] {
  const { anchors, openapiHref } = args;
  return [
    { key: "github", href: anchors.gitRepositoryUrl, label: "GitHub", external: true },
    { key: "npm", href: anchors.npmPackageUrl, label: "npm", external: true },
    { key: "openapi", href: openapiHref, label: "OpenAPI", external: false },
    { key: "issues", href: anchors.bugsUrl, label: "GitHub issues", external: true },
    { key: "support", href: "/support", label: "Support", external: false },
  ] as const;
}

export function buildSiteFooterLegalLinks(): readonly SiteChromeLink[] {
  return [
    { key: "security", href: "/security", label: "Security & Trust", external: false },
    { key: "privacy", href: "/privacy", label: "Privacy", external: false },
    { key: "terms", href: "/terms", label: "Terms", external: false },
  ] as const;
}

export function buildHomeTrustStripLinks(args: {
  anchors: SiteChromeAnchors;
  openapiHref: string;
}): readonly SiteChromeLink[] {
  const { anchors, openapiHref } = args;
  return [
    { key: "integrate", href: "/integrate", label: "Run first verification", external: false },
    { key: "openapi", href: openapiHref, label: "OpenAPI (commercial v1)", external: false },
    { key: "npm", href: anchors.npmPackageUrl, label: "npm package", external: true },
    { key: "github", href: anchors.gitRepositoryUrl, label: "Source repository", external: true },
  ] as const;
}
