import { siteMetadata } from "@/content/siteMetadata";
import { COMMERCIAL_SITE_CSP_NONCE_HEADER } from "@/lib/httpSecurityHeaders";
import marketing from "@/lib/marketing";
import { publicProductAnchors } from "@/lib/publicProductAnchors";
import { Analytics } from "@vercel/analytics/react";
import { Inter } from "next/font/google";
import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import { FirstFiveMinutesAfterMain, SiteFunnelBeacon } from "@/components/SiteFunnelLayoutParts";
import { Providers } from "./providers";
import { SkipToMainContent } from "@/components/SkipToMainContent";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const productJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "AgentSkeptic",
  description: marketing.siteDefaultMetadata.description,
  url: publicProductAnchors.productionCanonicalOrigin,
  sameAs: [publicProductAnchors.gitRepositoryUrl, publicProductAnchors.npmPackageUrl],
};

export const metadata: Metadata = {
  metadataBase: new URL(publicProductAnchors.productionCanonicalOrigin),
  title: {
    default: marketing.siteDefaultMetadata.title,
    template: "%s — AgentSkeptic",
  },
  description: marketing.siteDefaultMetadata.description,
  openGraph: {
    title: marketing.siteDefaultMetadata.title,
    description: marketing.siteDefaultMetadata.description,
    type: "website",
    images: [
      {
        url: siteMetadata.openGraphImage.path,
        width: siteMetadata.openGraphImage.width,
        height: siteMetadata.openGraphImage.height,
        alt: siteMetadata.openGraphImage.alt,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: marketing.siteDefaultMetadata.title,
    description: marketing.siteDefaultMetadata.description,
    images: [siteMetadata.openGraphImage.path],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = (await headers()).get(COMMERCIAL_SITE_CSP_NONCE_HEADER) ?? "";
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <script
          type="application/ld+json"
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
        />
        <SkipToMainContent />
        <SiteHeader />
        <Providers>
          <SiteFunnelBeacon />
          <div id="site-main" className="site-main" tabIndex={-1}>
            {children}
          </div>
          <div className="site-callout-wrap">
            <FirstFiveMinutesAfterMain />
          </div>
        </Providers>
        <SiteFooter />
        <Analytics />
      </body>
    </html>
  );
}
