# AGENTS

Normative **public distribution** and anchor sync: [`docs/public-distribution.md`](docs/public-distribution.md) (same content as https://github.com/jwekavanagh/agentskeptic/blob/main/docs/public-distribution.md).

## Machine-readable product entrypoints

- Committed `llms.txt` at repo root (same bytes as site `/llms.txt` after prebuild sync).
- Raw GitHub `llms.txt`: https://raw.githubusercontent.com/jwekavanagh/agentskeptic/refs/heads/main/llms.txt
- OpenAPI YAML (repo raw): https://raw.githubusercontent.com/jwekavanagh/agentskeptic/refs/heads/main/schemas/openapi-commercial-v1.yaml
- Verification Contract Manifest (canonical): https://agentskeptic.com/contract/v1.json
- Verification Contract Manifest (repo raw): https://raw.githubusercontent.com/jwekavanagh/agentskeptic/refs/heads/main/schemas/contract/v1.json
- Acquisition page (canonical): https://agentskeptic.com/database-truth-vs-traces
- CI regeneration + drift pathspecs: [`schemas/ci/verification-truth.manifest.json`](schemas/ci/verification-truth.manifest.json) (validated by [`test/verification-truth.closed-drift.contract.test.mjs`](test/verification-truth.closed-drift.contract.test.mjs))
