"use client";

export function LiveStatus({
  mode,
  children,
}: {
  mode: "polite" | "assertive";
  children: React.ReactNode;
}) {
  if (children == null || children === false) return null;
  if (mode === "assertive") {
    return <div role="alert">{children}</div>;
  }
  return (
    <div aria-live="polite" aria-atomic="true">
      {children}
    </div>
  );
}
