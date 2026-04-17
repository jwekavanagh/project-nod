# After copying from https://agentskeptic.com/integrate: export AGENTSKEPTIC_FUNNEL_ANON_ID and AGENTSKEPTIC_VERIFICATION_HYPOTHESIS in this shell when you want attributed telemetry.
set -euo pipefail
git clone --depth 1 https://github.com/jwekavanagh/agentskeptic.git
cd agentskeptic
npm install
npm run build
npm start
npm run first-run-verify
