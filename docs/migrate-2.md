# Migrating to AgentSkeptic v4

## Breaking change summary

Starting with **npm [`agentskeptic`](https://www.npmjs.com/package/agentskeptic) `4.0`**, the package root export surface no longer includes legacy standalone functions such as **`createDecisionGate`**, **`verifyWorkflow`**, **`verifyAgentskeptic`**, **`runQuickVerify`**, or **`runQuickVerifyToValidatedReport`**.

Use **`import { AgentSkeptic, AgentSkepticError } from "agentskeptic"`**, then **`new AgentSkeptic(options)`**.

## Symbol mapping

| Removed root export | Replacement |
|---------------------|-------------|
| `createDecisionGate({ workflowId, registryPath, databaseUrl, … })` | `new AgentSkeptic({ registryPath, databaseUrl, … }).gate({ workflowId })` |
| `verifyWorkflow({ … })` | `new AgentSkeptic({ registryPath, databaseUrl, … }).verify({ … })` (same options object) |
| `verifyAgentskeptic({ workflowId, databaseUrl, projectRoot })` | `new AgentSkeptic({ registryPath: "agentskeptic/tools.json", databaseUrl, projectRoot }).replayFromFile({ workflowId })` |
| `runQuickVerify(opts)` | `new AgentSkeptic({ … }).quick(opts)` |
| LangGraph helpers unchanged at root where still exported | Refer to **`src/index.ts`** / **`dist/index.d.ts`** |

**Errors:** Prefer **`AgentSkepticError`** for typed handling where applicable; **`TruthLayerError`** remains available from the barrel for backward-compatible `instanceof` checks.

## Automation

```bash
agentskeptic migrate .            # report legacy call sites (conservative textual scan)
agentskeptic migrate . --write    # append one-time markers where supported
```

```bash
python -m agentskeptic migrate    # pointer only today; apply this guide for edits
```

## Support window

The **3.x** npm line receives **security** patches as documented in the repo release policy; active feature work ships on **4.x**.
