import { integrateActivation } from "@/content/productCopy";

export function IntegrateCrossingCommands() {
  const c = integrateActivation;
  return (
    <div data-testid="integrate-crossing-commands">
      <p className="muted small">{c.crossingBootstrapLedLabel}</p>
      <pre data-testid="integrate-crossing-bootstrap-pre">
        <code>{c.crossingBootstrapLedBlock}</code>
      </pre>
      <p className="muted small">{c.crossingPackLedLabel}</p>
      <pre data-testid="integrate-crossing-pack-pre">
        <code>{c.crossingPackLedBlock}</code>
      </pre>
    </div>
  );
}
