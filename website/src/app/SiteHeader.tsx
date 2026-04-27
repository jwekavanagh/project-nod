import { auth } from "@/auth";
import { conversionSpine, productCopy } from "@/content/productCopy";
import marketing from "@/lib/marketing";
import { publicProductAnchors } from "@/lib/publicProductAnchors";
import { buildSiteHeaderPrimaryLinks } from "@/lib/siteChrome";
import { BrandLockup } from "@/components/BrandLockup";
import Link from "next/link";
import { SignOutButton } from "./SignOutButton";

function renderTopLevelLink(
  link: { key: string; href: string; label: string; external: boolean },
) {
  if (link.key === "acquisition") {
    return (
      <Link key={link.key} href={productCopy.homepageAcquisitionCta.href}>
        {marketing.homepageAcquisitionCtaLabel}
      </Link>
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
  const [acq, started, price, cli] = primaryLinks;

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <BrandLockup />
        <nav className="site-nav" aria-label="Primary">
          {renderTopLevelLink(acq)}
          {renderTopLevelLink(started)}
          <Link href="/guides">Learn</Link>
          <Link href="/problems">Problems</Link>
          <Link href="/compare">{productCopy.homeCommercialCompareApproachesLabel}</Link>
          {renderTopLevelLink(price)}
          {renderTopLevelLink(cli)}
          {signedIn ? (
            <>
              <Link href="/account">Account</Link>
              <SignOutButton variant="nav" />
            </>
          ) : (
            <Link href="/auth/signin?callbackUrl=%2Faccount" data-cta-priority={conversionSpine.ctaPrioritySecondaryValue}>
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
