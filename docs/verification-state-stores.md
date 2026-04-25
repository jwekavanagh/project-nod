# Verification: databases and external state stores (SSOT)

This document is the **single normative reference** for verification beyond SQLite file mode: which **`tools.json`** `verification.kind` values exist, how they resolve, which **`databaseUrl`** schemes apply to SQL-shaped verification, required **environment variables**, and how **reason codes** map to outcomes.

For the shared verification kernel (policy, step statuses, event replay), see [`agentskeptic.md`](agentskeptic.md) and [`decision-gate.md`](decision-gate.md). For relational SQL check authoring, see [`relational-verification.md`](relational-verification.md).

---

## 1. Registry verification kinds

| `verification.kind` | Purpose | Remote / SQLite file mode |
| --- | --- | --- |
| `sql_row`, `sql_row_absent`, `sql_effects` | Row-level SQL truth | **SQLite file** and **remote** SQL URLs (see §2). |
| `sql_relational` | Multi-check relational SQL | **SQLite file**, **Postgres**, **MySQL**, **SQL Server**. **Not** supported for **BigQuery** in v1 (resolve-time error; see §3). |
| `vector_document` | Read-only check against a vector index (Pinecone, Weaviate, Chroma) | **Remote async** only. **SQLite file mode** → `incomplete_verification` / `STATE_WITNESS_UNAVAILABLE_IN_SQLITE_FILE_MODE`. |
| `object_storage_object` | S3-compatible **HeadObject** (+ bounded **GetObject** when SHA-256 is required) | **Remote async** only. Same SQLite limitation as vector. |
| `http_witness` | **GET**/**POST** `fetch` witness: HTTP status + optional JSON pointer assertions | **Remote async** only. Same SQLite limitation. |
| `mongo_document` | **`findOne`** against a collection with **scalar** `requiredFields` | **Remote async** only. Same SQLite limitation. |

**Quick verify** (`agentskeptic quick`) remains **SQL-inference only**; it does not implement these witness kinds.

---

## 2. `databaseUrl` schemes (SQL-shaped engines)

Passed as **`--db`** (CLI) or `databaseUrl` / `database` in the API. Parsed centrally into `VerificationDatabase`:

| Prefix / form | `VerificationDatabase.kind` |
| --- | --- |
| `postgres://`, `postgresql://` | `postgres` |
| `mysql://`, `mysql2://` | `mysql` |
| `bigquery://` | `bigquery` |
| `sqlserver://`, `mssql://` | `sqlserver` |
| Any other string (relative or absolute path) | `sqlite` (path resolved under the configured project root when relative) |

**Normative dialect boundary (v1):**

- **BigQuery:** **`sql_row`**, **`sql_row_absent`**, **`sql_effects`** supported. **`sql_relational`** is **rejected at resolve time** with resolver code **`RELATIONAL_UNSUPPORTED_DIALECT`** (message names BigQuery / row-only mode). Do not rely on silent skip.
- **MySQL / SQL Server / Postgres:** Row checks and relational checks use dialect-specific parameterized SQL builders.

---

## 3. Environment variables (process env only)

Secrets and endpoints are read from the **process environment** (not from `tools.json`).

### 3.1 Vector (`vector_document`)

| Provider | Variables |
| --- | --- |
| **Pinecone** | `PINECONE_API_KEY`; host: registry `host` string spec **or** `PINECONE_INDEX_HOST` |
| **Weaviate** | `WEAVIATE_API_KEY`; host: registry **or** `WEAVIATE_HOST` |
| **Chroma** | `CHROMA_TENANT_AUTH_TOKEN` **or** `CHROMA_API_KEY`; host: registry **or** `CHROMA_HOST` |

Missing host or key → **`incomplete_verification`** / `STATE_WITNESS_SETUP_ERROR` (or provider-specific incomplete codes where HTTP fails before a verdict).

`expectPayloadSha256` in the registry is currently rejected at witness execution with a setup message (use **`metadataEq`** / metadata subset instead).

### 3.2 Object storage (`object_storage_object`)

Uses **`@aws-sdk/client-s3`** with default credential resolution: **`AWS_ACCESS_KEY_ID`**, **`AWS_SECRET_ACCESS_KEY`**, **`AWS_REGION`** (or instance metadata where the runtime supports it—operators should prefer explicit keys in CI). Optional registry **`endpoint`** for S3-compatible APIs (forces path-style).

Typical path: **HeadObject** for existence, **Content-Length**, **ETag**, and selected metadata checks. **SHA-256** verification performs a **bounded** body read; objects larger than the internal cap return **`OBJECT_TOO_LARGE_FOR_HASH`** (explicit) rather than pretending a full hash ran.

Adapter enforces a **short wall-clock deadline** on the head path (product expectation: common cases complete quickly).

### 3.3 HTTP witness (`http_witness`)

Uses **`fetch`** with an **AbortController** deadline. Network / TLS / abort errors → **`incomplete_verification`** / **`HTTP_WITNESS_NETWORK_ERROR`**. Status mismatch → **`inconsistent`** / **`HTTP_WITNESS_STATUS_MISMATCH`**. JSON pointer assertion mismatch → **`inconsistent`** / **`HTTP_WITNESS_ASSERTION_MISMATCH`**.

### 3.4 MongoDB (`mongo_document`)

Connection URI: **`AGENTSKEPTIC_MONGO_URL`** or **`MONGODB_URI`**. Missing URI → setup incomplete. **`findOne`** with the resolved filter; **`requiredFields`** are compared with the same scalar equality rules as SQL field checks.

### 3.5 SQL connectors

| Engine | Driver / notes |
| --- | --- |
| Postgres | `pg` (existing) |
| MySQL | `mysql2/promise` |
| SQL Server | `mssql` |
| BigQuery | `@google-cloud/bigquery` (row reads; relational not in v1) |

---

## 4. Reason codes (witness + dialect)

Stable string codes are defined in `src/wireReasonCodes.ts` (`SQL_VERIFICATION_OUTCOME_CODE` and `REGISTRY_RESOLVER_CODE`). User-facing phrases live in `src/verificationUserPhrases.ts`.

**SQLite file mode blocking:** `STATE_WITNESS_UNAVAILABLE_IN_SQLITE_FILE_MODE` — vector, object storage, HTTP witness, and Mongo steps **must not** report `verified` in file mode.

**Relational on BigQuery:** `RELATIONAL_UNSUPPORTED_DIALECT` at **registry resolution** (`resolveVerificationRequest`), not as a silent SQL runtime failure.

**S3 integrity:** `OBJECT_MISSING`, `OBJECT_DIGEST_MISMATCH`, `OBJECT_SIZE_MISMATCH`, `OBJECT_METADATA_MISMATCH`, `OBJECT_TOO_LARGE_FOR_HASH`.

**HTTP:** `HTTP_WITNESS_STATUS_MISMATCH`, `HTTP_WITNESS_ASSERTION_MISMATCH`, `HTTP_WITNESS_NETWORK_ERROR`.

**Vector:** `VECTOR_NOT_FOUND`, `VECTOR_METADATA_MISMATCH`, `VECTOR_PAYLOAD_MISMATCH`, `VECTOR_PROVIDER_ERROR`.

**Mongo:** `MONGO_DOCUMENT_MISSING`, `MONGO_VALUE_MISMATCH`.

---

## 5. Example registry snippets

See **`examples/tools-state-stores.json`** in the repository for a minimal, schema-valid illustration of **`vector_document`**, **`object_storage_object`**, **`http_witness`**, and **`mongo_document`** side by side.

---

## 6. Operator notes

- Rotate keys via **environment** only; do not embed secrets in **`tools.json`**.
- Grant **read-only** SQL roles and **S3 `s3:GetObject` + `s3:HeadObject`** (or tighter if your checks allow) for verification principals.
- **Egress:** HTTP vector and witness calls require outbound HTTPS from the process running verification.

<!-- GENERATED_CAPABILITY_MATRIX_START -->

## Generated Capability Matrix

| Behavior | Capability | TS | Python |
| --- | --- | --- | --- |
| `bigquery.sql_row.strong` | `unsupported` | `supported` | `supported` |
| `http_witness.strong` | `supported` | `supported` | `supported` |
| `mongo_document.strong` | `supported` | `supported` | `supported` |
| `mysql.sql_row.strong` | `unsupported` | `supported` | `supported` |
| `object_storage_object.strong` | `supported` | `supported` | `supported` |
| `postgres.sql_effects.eventual` | `supported` | `supported` | `supported` |
| `postgres.sql_effects.strong` | `supported` | `supported` | `supported` |
| `postgres.sql_relational.strong` | `supported` | `supported` | `supported` |
| `postgres.sql_row_absent.strong` | `supported` | `supported` | `supported` |
| `postgres.sql_row.bounded` | `supported` | `supported` | `supported` |
| `postgres.sql_row.eventual` | `supported` | `supported` | `supported` |
| `postgres.sql_row.strong` | `supported` | `supported` | `supported` |
| `sqlite.sql_row_absent.strong` | `supported` | `supported` | `supported` |
| `sqlite.sql_row.bounded` | `unsupported` | `supported` | `supported` |
| `sqlite.sql_row.eventual` | `supported` | `supported` | `supported` |
| `sqlite.sql_row.strong` | `supported` | `supported` | `supported` |
| `sqlserver.sql_row.strong` | `unsupported` | `supported` | `supported` |
| `vector_document.strong` | `supported` | `supported` | `supported` |

<!-- GENERATED_CAPABILITY_MATRIX_END -->
