/** Contract §15: server-only markup above the client island. */
export function AccountServerAboveFold({
  email,
  maskedKeySummary,
}: {
  email: string;
  maskedKeySummary: string | null;
}) {
  return (
    <>
      <p>
        Signed in as <strong>{email}</strong>
      </p>
      {maskedKeySummary !== null ? <p>API key: {maskedKeySummary}</p> : null}
    </>
  );
}
