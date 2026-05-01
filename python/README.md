# agentskeptic (Python)

First-party Python verification kernel and `agentskeptic.verify()` integration surface.

Authoritative integrator narrative: [../docs/integrator-verification.md](../docs/integrator-verification.md).

LM-assisted **`tools.json` drafting** from OpenAI/bootstrap inputs ships as **`POST /api/integrator/registry-draft`** on the canonical website (**DraftEngine** in **`website/src/lib/registry-draft/`**) — see [../docs/registry-draft.md](../docs/registry-draft.md). The small `emit_tools_json` helper in this package is template-only, not a second draft stack.

```bash
pip install -e ".[dev]"
pytest
```

Parity vectors live under `tests/parity_vectors/`; regenerate with Node (after `npm run build`):

```bash
node ../scripts/emit-python-parity-goldens.mjs
```

Cold-path smoke (from **repository root**; copies partner fixtures + `schemas/` into the image):

```bash
docker build -f python/Dockerfile -t agentskeptic-py-verify .
```

PyPI releases: the repository version is the single source of truth; **`release.yml`** runs **semantic-release** (tag + npm), then **`.github/workflows/release-package.yml`** publishes the wheel on **`v*.*.*` tag pushes** with Trusted Publishing (see root `CONTRIBUTING.md`).
