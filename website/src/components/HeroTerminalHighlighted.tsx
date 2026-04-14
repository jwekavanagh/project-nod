import type { ReactNode } from "react";

const HIGHLIGHT_RE =
  /(ROW_ABSENT|workflow_status:\s*inconsistent|"status":\s*"inconsistent"|"status":\s*"missing"|reference_code:\s*ROW_ABSENT)/gi;

type Props = { text: string };

/** Highlights failure signals in the bundled demo excerpt (server-rendered). */
export function HeroTerminalHighlighted({ text }: Props) {
  const parts: ReactNode[] = [];
  let last = 0;
  const re = new RegExp(HIGHLIGHT_RE.source, HIGHLIGHT_RE.flags);
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      parts.push(text.slice(last, m.index));
    }
    parts.push(
      <span key={`${m.index}-${k++}`} className="home-hero-terminal-hit">
        {m[0]}
      </span>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    parts.push(text.slice(last));
  }
  return <>{parts}</>;
}
