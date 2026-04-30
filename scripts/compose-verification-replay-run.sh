#!/usr/bin/env bash
# Used by compose.verification-replay.yml verifier service. Mirrors CI prerequisites,
# exports CHROME_PATH for Lighthouse CI (@lhci/cli healthcheckChrome).
set -euo pipefail
cd /workspace

git config --global --add safe.directory /workspace
git config --global --add safe.directory /workspace/.git
npm ci
npx playwright install-deps chromium
npx playwright install chromium

CHROME_PATH="$(node /workspace/scripts/resolve-playwright-chrome.mjs)"
export CHROME_PATH
exec npm run verification:truth
