# agentskeptic (Python)

First-party Python verification kernel and `agentskeptic.verify()` integration surface.

Authoritative integrator narrative: [../docs/integrator-verification.md](../docs/integrator-verification.md).

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

PyPI releases: push a git tag matching `py-v*` to run trusted publishing (see `.github/workflows/python-verify.yml`).
