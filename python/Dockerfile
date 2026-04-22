# Slim cold-path image: parity goldens + budget check (no Node on hot path).
# Build from **repository root**: docker build -f python/Dockerfile .
FROM python:3.12-slim

WORKDIR /app
COPY python/pyproject.toml python/README.md ./
COPY python/src ./src
COPY python/tests ./tests
COPY python/scripts ./scripts
COPY examples/partner-quickstart ./examples/partner-quickstart
COPY schemas ./schemas

ENV AGENTSKEPTIC_REPO_ROOT=/app

RUN pip install --no-cache-dir -e ".[dev]" \
    && python scripts/timed_first_verify.py
