"""Pydantic v2 models mirroring `components.schemas` in `schemas/openapi-commercial-v1.yaml` (hand-written, not generated)."""

from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

PlanName = Literal["starter", "individual", "team", "business", "enterprise"]


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


class EnforcementEvidenceRequestV2(BaseModel):
    schema_version: Literal[2] = 2
    run_id: str
    workflow_id: str
    outcome_certificate_v1: dict[str, Any]
    material_truth_sha256: str
    certificate_sha256: str


class EnforcementFsmEnvelopeV2(BaseModel):
    """Hosted enforcement response (POST /check | /baselines | /accept); extra fields vary by route."""

    model_config = ConfigDict(extra="allow")

    schema_version: Literal[2] = 2
    code: str
    quota_enforced_via_reserve: bool | None = None


class EnforcementAcceptEvidenceRequestV2(EnforcementEvidenceRequestV2):
    expected_projection_hash: str
    lifecycle_state_version: int


class EnforcementHistoryResponse(BaseModel):
    schema_version: Literal[1] = 1
    workflow_id: str
    events: list[dict[str, Any]]


class GovernanceAuditBundleV1(BaseModel):
    schemaVersion: Literal[1] = 1
    generatedAt: str
    userId: str
    workflowId: str
    baseline: dict[str, Any] | None
    events: list[dict[str, Any]]
    window: dict[str, str] | None = None


class GovernanceAuditBundleV2(BaseModel):
    model_config = ConfigDict(extra="allow")

    schemaVersion: Literal[2] = 2
    generatedAt: str
    userId: str
    workflowId: str
    baseline: dict[str, Any] | None
    events: list[dict[str, Any]]
    window: dict[str, str] | None = None
    lifecycle: dict[str, Any] | None = None
    fsmTransitions: list[dict[str, Any]] | None = None
    verificationDecisions: list[dict[str, Any]] | None = None
    decisionEvidenceExport: dict[str, Any] | None = None


class VerifyOutcomeRequestV2(BaseModel):
    schema_version: Literal[2] = 2
    run_id: str = Field(max_length=256)
    workflow_id: str = Field(max_length=512)
    trust_decision: Literal["safe", "unsafe", "unknown"]
    reason_codes: list[str] = Field(max_length=8)
    terminal_status: Literal["complete", "inconsistent", "incomplete"]
    workload_class: Literal["bundled_examples", "non_bundled"]
    subcommand: Literal["batch_verify", "quick_verify", "verify_integrator_owned"]


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
    schemaVersion: Literal[2] = 2
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
    human_blocker_lines: list[str] = Field(min_length=6, max_length=6)
