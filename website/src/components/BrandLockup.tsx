import Image from "next/image";
import Link from "next/link";

export function BrandLockup() {
  return (
    <Link href="/" className="site-logo" data-testid="brand-lockup" aria-label="AgentSkeptic home">
      <span className="brand-lockup-inner">
        <Image
          className="brand-mark"
          src="/brand/mark.png"
          width={40}
          height={40}
          alt=""
          decoding="async"
          priority
        />
        <span className="brand-lockup-text">
          <span className="brand-lockup-wordmark">
            <span className="brand-wordmark-agent">Agent</span>
            <span className="brand-wordmark-skeptic">Skeptic</span>
          </span>
          <span className="brand-tagline">TRUST REALITY, NOT TRACES.</span>
        </span>
      </span>
    </Link>
  );
}
