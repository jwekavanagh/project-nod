# Distribution product requirement

Normative stakeholder requirements for **public distribution** and the **cross-repository consumer proof** path. Engineering contracts, failure codes, and traceability live in [`public-distribution-ssot.md`](public-distribution-ssot.md).

### REQ-DIST-001

The **consumer repository** used for distribution smoke must exist, use **`main`** as the default branch, and keep **GitHub Actions** enabled so dispatched workflows can run after publish.

### REQ-DIST-002

The **primary** repository publishes a generated **`foreign-smoke.yml`** workflow to the consumer (create or update) using the same bytes the pipeline verified locally; drift between local fixture and remote file after `PUT` must fail the gate.

### REQ-DIST-003

After publish, the pipeline must observe **GitHub indexing and permissions**: the workflow must be visible to the CLI (`gh workflow view`), and Actions must remain enabled on the consumer before dispatch.

### REQ-DIST-004

Correlation and proof must be recoverable **without** reading workflow dispatch **`inputs`** from the API. The consumer workflow must expose a single listable **`run-name`**, upload one artifact named **`distribution-proof`** containing **`proof.json`**, and that JSON must include **`foreign_smoke_fixture_sha256`** consistent with the strip-hash contract.

### REQ-DIST-005

The **verifier** repository’s merge gate must run **after** other blocking CI and execute the **distribution consumer pipeline** (including post-publish gate, dispatch, poll, artifact download, and field-level proof checks) so a green result is not claimed without a successful proof path.

### REQ-DIST-006

Operator-facing documentation must point integrators at the **SSOT** for anchors, sync, and distribution contracts without duplicating normative field catalogs in multiple places.
