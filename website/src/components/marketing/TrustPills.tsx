export function TrustPills({ items }: { items: readonly string[] }) {
  return (
    <ul className="trust-pills" aria-label="Trust guarantees">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}
