import { auth } from "@/auth";
import { productCopy } from "@/content/productCopy";
import marketing from "@/lib/marketing";
import { publicProductAnchors } from "@/lib/publicProductAnchors";
import { buildSiteHeaderPrimaryLinks, SITE_HEADER_LEARN_FLYOUT_LINKS } from "@/lib/siteChrome";
import { BrandLockup } from "@/components/BrandLockup";
import Link from "next/link";
import { SignOutButton } from "./SignOutButton";

function renderTopLevelLink(
  link: { key: string; href: string; label: string; external: boolean },
  cliQuickstartHref: string,
) {
  if (link.key === "acquisition") {
    return (
      <Link key={link.key} href={productCopy.homepageAcquisitionCta.href}>
        {marketing.homepageAcquisitionCtaLabel}
      </Link>
    );
  }
  if (link.key === "cli") {
    return (
      <a key={link.key} href={cliQuickstartHref} rel="noreferrer">
        {link.label}
      </a>
    );
  }
  if (link.external) {
    return (
      <a key={link.key} href={link.href} rel="noreferrer">
        {link.label}
      </a>
    );
  }
  return (
    <Link key={link.key} href={link.href}>
      {link.label}
    </Link>
  );
}

export async function SiteHeader() {
  const session = await auth();
  const signedIn = Boolean(session?.user);

  const anchors = {
    gitRepositoryUrl: publicProductAnchors.gitRepositoryUrl,
    npmPackageUrl: publicProductAnchors.npmPackageUrl,
    bugsUrl: publicProductAnchors.bugsUrl,
  };

  const primaryLinks = buildSiteHeaderPrimaryLinks({
    anchors,
    acquisitionHref: productCopy.homepageAcquisitionCta.href,
    acquisitionLabel: marketing.homepageAcquisitionCtaLabel,
  });
  const cliQuickstart = productCopy.links.cliQuickstart;
  const [acq, started, price, cli] = primaryLinks;

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <BrandLockup />
        <nav className="site-nav" aria-label="Primary">
          {renderTopLevelLink(acq, cliQuickstart)}
          {renderTopLevelLink(started, cliQuickstart)}
          <div className="site-nav-learn">
            <Link href="/guides" className="site-nav-learn-primary">
              Learn
            </Link>
            <div
              className="site-nav-learn-flyout"
              role="group"
              aria-label="Problems and compare"
            >
              {SITE_HEADER_LEARN_FLYOUT_LINKS.map((s) => (
                <Link key={s.key} href={s.href}>
                  {s.label}
                </Link>
              ))}
            </div>
          </div>
          {renderTopLevelLink(price, cliQuickstart)}
          {renderTopLevelLink(cli, cliQuickstart)}
          {signedIn ? (
            <>
              <Link href="/account">Account</Link>
              <SignOutButton variant="nav" />
            </>
          ) : (
            <Link href="/auth/signin?callbackUrl=%2Faccount">Sign in</Link>
          )}
        </nav>
      </div>
    </header>
  );
}
