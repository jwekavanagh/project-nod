import Link from "next/link";
import { readFileSync } from "node:fs";
import path from "node:path";
import { loadLegalMetadata } from "@/lib/plans";

export default function TermsPage() {
  const meta = loadLegalMetadata();
  const mdPath = path.join(process.cwd(), "content", "legal", "terms.md");
  let body = readFileSync(mdPath, "utf8");
  body = body
    .replace(/\{\{EFFECTIVE_DATE\}\}/g, meta.effectiveDate)
    .replace(/\{\{TERMS_VERSION\}\}/g, meta.termsVersion);
  return (
    <main>
      <p>
        <Link href="/">Home</Link>
      </p>
      <article style={{ whiteSpace: "pre-wrap" }}>{body}</article>
    </main>
  );
}
