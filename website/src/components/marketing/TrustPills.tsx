export type TrustPillItem =
  | string
  | Readonly<{
      title: string;
      supporting: string;
    }>;

export function TrustPills({ items }: { items: readonly TrustPillItem[] }) {
  return (
    <ul className="trust-pills" aria-label="Trust guarantees">
      {items.map((item) =>
        typeof item === "string" ? (
          <li key={item}>{item}</li>
        ) : (
          <li key={item.title} className="trust-pill-stack">
            <span className="trust-pill-headline">{item.title}</span>
            <span className="trust-pill-supporting muted">{item.supporting}</span>
          </li>
        ),
      )}
    </ul>
  );
}
