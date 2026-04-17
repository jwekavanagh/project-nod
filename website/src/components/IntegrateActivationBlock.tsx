"use client";

import { integrateActivation } from "@/content/productCopy";
import { INTEGRATE_ACTIVATION_SHELL_BODY } from "@/generated/integrateActivationShellStatic";
import {
  isValidVerificationHypothesisWireValue,
  normalizeVerificationHypothesisInput,
} from "agentskeptic/verificationHypothesisContract";
import { useEffect, useMemo, useState } from "react";

const STORAGE_FUNNEL = "agentskeptic_funnel_anon_id";
const STORAGE_HYP = "agentskeptic_verification_hypothesis";

/**
 * Hypothesis field + Copy (disabled until valid) + `<pre>` with funnel export, optional hypothesis export, then locked shell body.
 */
export function IntegrateActivationBlock() {
  const a = integrateActivation;
  const [hypothesisInput, setHypothesisInput] = useState("");
  const [dirty, setDirty] = useState(false);
  const [funnelId, setFunnelId] = useState<string | null>(null);

  useEffect(() => {
    setHypothesisInput(window.localStorage?.getItem(STORAGE_HYP) ?? "");
  }, []);

  useEffect(() => {
    const readFunnel = () => {
      const id = window.localStorage?.getItem(STORAGE_FUNNEL)?.trim();
      setFunnelId(id && id.length > 0 ? id : null);
    };
    readFunnel();
    const t0 = window.setTimeout(readFunnel, 0);
    const t1 = window.setTimeout(readFunnel, 500);
    return () => {
      window.clearTimeout(t0);
      window.clearTimeout(t1);
    };
  }, [hypothesisInput]);

  const normalizedHyp = normalizeVerificationHypothesisInput(hypothesisInput);
  const hypothesisOk = isValidVerificationHypothesisWireValue(normalizedHyp);

  useEffect(() => {
    if (hypothesisOk) {
      window.localStorage?.setItem(STORAGE_HYP, normalizedHyp);
    } else if (hypothesisInput.length === 0) {
      window.localStorage?.removeItem(STORAGE_HYP);
    }
  }, [hypothesisInput.length, hypothesisOk, normalizedHyp]);

  const preText = useMemo(() => {
    const lines: string[] = [];
    if (funnelId) {
      lines.push(`export AGENTSKEPTIC_FUNNEL_ANON_ID=${funnelId}`);
    }
    if (hypothesisOk) {
      lines.push(`export AGENTSKEPTIC_VERIFICATION_HYPOTHESIS='${normalizedHyp}'`);
    }
    if (lines.length > 0) {
      lines.push("");
    }
    lines.push(INTEGRATE_ACTIVATION_SHELL_BODY);
    return lines.join("\n");
  }, [funnelId, hypothesisOk, normalizedHyp]);

  const showError = dirty && !hypothesisOk;

  return (
    <div data-testid="integrate-activation-block">
      <div className="integrate-hypothesis-field">
        <label htmlFor="integrate-verification-hypothesis">{a.hypothesisLabel}</label>
        <p className="muted small">{a.hypothesisHelper}</p>
        <input
          id="integrate-verification-hypothesis"
          type="text"
          autoComplete="off"
          spellCheck={false}
          value={hypothesisInput}
          onChange={(e) => {
            setDirty(true);
            setHypothesisInput(e.target.value);
          }}
          data-testid="integrate-hypothesis-input"
        />
        {showError ? (
          <p
            role="alert"
            className="integrate-hypothesis-error muted"
            data-testid="integrate-hypothesis-error"
          >
            {a.hypothesisInvalid}
          </p>
        ) : null}
      </div>
      <p>
        <button
          type="button"
          disabled={!hypothesisOk}
          data-testid="integrate-copy-activation-block"
          onClick={() => {
            void navigator.clipboard.writeText(preText);
          }}
        >
          {a.copyActivationBlockLabel}
        </button>
      </p>
      <pre data-testid="integrate-activation-pre">
        <code>{preText}</code>
      </pre>
    </div>
  );
}
