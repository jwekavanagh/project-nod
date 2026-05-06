"""Pydantic v2 models mirroring `components.schemas` in `schemas/openapi-commercial-v1.yaml` (hand-written, not generated)."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

PlanName = Literal["starter", "individual", "team", "business", "enterprise"]

EvidenceGapPrimary = Literal[
    "none",
    "preview_lane",
    "ingest_empty",
    "ingest_unstructured",
    "registry_unknown_tool",
    "registry_resolution",
    "database_access",
    "timing_or_window",
    "witness_unavailable",
    "state_mismatch",
    "verification_incomplete",
    "event_sequence",
    "control_flow_context",
    "unclassified",
]


class ProblemDetails(BaseModel):
    type: str
    title: str
    status: int
    detail: str
    instance: str | None = None
    code: str | None = None


class ReserveRequest(BaseModel):
    run_id: str = Field(max_length=256)
    issued_at: str
    intent: Literal["verify", "enforce"] | None = "verify"


class ReserveAllowed(BaseModel):
    model_config = ConfigDict(extra="forbid")
    allowed: Literal[True] = True
    plan: PlanName
    limit: int
    used: int
    included_monthly: int | None
    overage_count: int


class ReserveError(ProblemDetails):
    allowed: Literal[False] = False
    code: str
    message: str
    upgrade_url: str | None = None


class UsageCurrentV1(BaseModel):
    model_config = ConfigDict(extra="forbid")
    schema_version: Literal[1] = 1
    plan: PlanName
    year_month: str
    period_start_utc: str
    period_end_utc: str
    used_total: int
    included_monthly: int | None
    allow_overage: bool
    overage_count: int
    quota_state: Literal["ok", "notice", "warning", "in_overage", "at_cap"]
    allowed_next: bool
    estimated_overage_usd: str


class EnforcementEvidenceRequestV3(BaseModel):
    schema_version: Literal[3] = 3
    run_id: str
    workflow_id: str
    outcome_certificate: dict[str, Any]
    material_truth_sha256: str
    certificate_sha256: str


class EnforcementFsmEnvelopeV2(BaseModel):
    """Hosted enforcement response (POST /check | /baselines | /accept); extra fields vary by route."""

    model_config = ConfigDict(extra="allow")

    schema_version: Literal[2] = 2
    code: str
    quota_enforced_via_reserve: bool | None = None


class EnforcementAcceptEvidenceRequestV3(EnforcementEvidenceRequestV3):
    expected_projection_hash: str
    lifecycle_state_version: int


class EnforcementHistoryResponse(BaseModel):
    schema_version: Literal[1] = 1
    workflow_id: str
    events: list[dict[str, Any]]


class GovernanceExportCorruptedEvidenceRow(BaseModel):
    """GET /api/v1/governance/export 500 JSON (OpenAPI `GovernanceExportCorruptedEvidenceRow`)."""

    model_config = ConfigDict(extra="forbid")

    code: Literal["CORRUPTED_EVIDENCE_ROW"]
    evidence_id: str
    message: str


class GovernanceEvidenceFingerprints(BaseModel):
    model_config = ConfigDict(extra="forbid")

    certificateSha256: str
    materialTruthSha256: str


class HostedEvidenceExitDecisionV1(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schemaVersion: Literal[1] = 1
    exitCode: int
    cliConvention: Literal["outcome_certificate_v2"]


class HostedDecisionEvidenceCompletenessArtifacts(BaseModel):
    model_config = ConfigDict(extra="forbid")

    a4Present: bool
    a5Present: bool
    a5Required: bool


class HostedDecisionEvidenceCompleteness(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Literal["complete", "partial", "invalid"]
    artifacts: HostedDecisionEvidenceCompletenessArtifacts


class HostedEvidenceSliceV1(BaseModel):
    """Keyed value in GovernanceAuditBundleV3.evidenceSlices (OpenAPI `HostedEvidenceSliceV1`)."""

    model_config = ConfigDict(extra="forbid")

    runId: str
    outcomeCertificate: dict[str, Any]
    fingerprints: GovernanceEvidenceFingerprints
    hostedExit: HostedEvidenceExitDecisionV1
    decisionCompleteness: HostedDecisionEvidenceCompleteness
    truthCheckVerdict: str


class GovernanceBaselineAcceptedEvidenceV3(BaseModel):
    model_config = ConfigDict(extra="forbid")

    evidenceSliceKey: str
    runId: str
    fingerprints: GovernanceEvidenceFingerprints
    runKind: str


class GovernanceAuditBundleV1(BaseModel):
    schemaVersion: Literal[1] = 1
    generatedAt: str
    userId: str
    workflowId: str
    baseline: dict[str, Any] | None
    events: list[dict[str, Any]]
    window: dict[str, str] | None = None


class GovernanceAuditBundleV3(BaseModel):
    """GET /api/v1/governance/export body (OpenAPI `GovernanceAuditBundleV3`)."""

    model_config = ConfigDict(extra="forbid")

    schemaVersion: Literal[3] = 3
    generatedAt: str
    userId: str
    workflowId: str
    window: dict[str, Any]
    lifecycle: dict[str, Any] | None
    fsmTransitions: list[dict[str, Any]]
    verificationDecisions: list[dict[str, Any]]
    baseline: dict[str, Any] | None
    events: list[dict[str, Any]]
    evidenceSlices: dict[str, HostedEvidenceSliceV1]
    baselineAcceptedEvidence: GovernanceBaselineAcceptedEvidenceV3 | None


class VerifyOutcomeRequestV3(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: Literal[3] = 3
    run_id: str = Field(max_length=256)
    workflow_id: str = Field(max_length=512)
    trust_decision: Literal["safe", "unsafe", "unknown"]
    evidence_gap_primary: EvidenceGapPrimary
    reason_codes: list[str] = Field(max_length=8)
    terminal_status: Literal["complete", "inconsistent", "incomplete"]
    workload_class: Literal["bundled_examples", "non_bundled"]
    subcommand: Literal["batch_verify", "quick_verify", "verify_integrator_owned", "activate"]
    activation: dict[str, Any] | None = None


class OssClaimTicketRequest(BaseModel):
    model_config = ConfigDict(extra="allow")


class OssClaimTicketHandoffResponse(BaseModel):
    schema_version: Literal[2] = 2
    handoff_url: str


class OssClaimRedeemRequest(BaseModel):
    model_config = ConfigDict(extra="allow")
    claim_secret: str | None = Field(default=None, pattern=r"^[0-9a-f]{64}$")


class OssClaimRedeemOk(BaseModel):
    schema_version: Literal[1] = 1
    run_id: str
    terminal_status: str
    workload_class: str
    subcommand: str
    build_profile: str
    claimed_at: str


class OssClaimContinuationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    claim_secret: str = Field(pattern=r"^[0-9a-f]{64}$")


class PublicVerificationReportCreate(BaseModel):
    model_config = ConfigDict(extra="allow")


class PublicVerificationReportCreated(BaseModel):
    model_config = ConfigDict(extra="forbid")
    schemaVersion: Literal[3] = 3
    id: str
    url: str


class PublicPlan(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)
    includedMonthly: int | None = None
    monthlyUsdCents: int | None = None
    yearlyUsdCents: int | None = None
    displayPrice: str | None = None
    displayPriceYearly: str | None = None
    overageMicrousdPerVerification: int | None = None
    allowOverage: bool | None = None
    overageDisplayLabel: str | None = None
    marketingHeadline: str | None = None
    audience: str | None = None
    valueUnlock: str | None = None


class CommercialPlansResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)
    schemaVersion: int
    plans: dict[str, PublicPlan]


class TrustDecisionRoutingV1(BaseModel):
    """`routing` on **`TrustDecisionRecordRequestV1`** (OpenAPI-aligned)."""

    model_config = ConfigDict(extra="forbid")
    routing_key: str = Field(max_length=512)
    team: str | None = Field(default=None, max_length=256)
    owner_slug: str | None = Field(default=None, max_length=256)


class TrustCertificateFirstProblemRequestV1(BaseModel):
    model_config = ConfigDict(extra="forbid")
    seq: int = Field(ge=0)
    tool_id: str
    observed_trunc: str = Field(max_length=512)
    expected_trunc: str = Field(max_length=512)


class TrustCertificateSnapshotRequestV1(BaseModel):
    model_config = ConfigDict(extra="forbid")
    schema_version: Literal[1] = 1
    workflow_id: str = Field(max_length=512)
    run_kind: Literal["contract_sql", "contract_sql_langgraph_checkpoint_trust", "quick_preview"]
    state_relation: Literal["matches_expectations", "does_not_match", "not_established"]
    high_stakes_reliance: Literal["permitted", "prohibited"]
    reason_codes: list[str] = Field(max_length=24)
    first_problem: TrustCertificateFirstProblemRequestV1 | None = None


class TrustDecisionRecordRequestV1(BaseModel):
    model_config = ConfigDict(extra="forbid")
    schema_version: Literal[1] = 1
    trust_decision: Literal["safe", "unsafe", "unknown"]
    gate_kind: Literal["contract_sql_irreversible", "langgraph_checkpoint_terminal"]
    routing: TrustDecisionRoutingV1
    certificate_snapshot: TrustCertificateSnapshotRequestV1
    human_blocker_lines: list[str] = Field(min_length=1, max_length=48)
