#!/usr/bin/env node
/**
 * Verification Contract Manifest helper.
 *
 * The manifest at schemas/contract/v1.json is the single product surface naming and
 * hashing the contract members (event line, tools registry, tools registry export)
 * and the canonical example registry/events. All hashes live in `history[]`; the
 * current manifest version is always `history[history.length - 1].manifestVersion`.
 *
 * Modes:
 *   --check                   Validate the committed manifest against live files,
 *                             package.json pin, and the synced static asset.
 *   --write                   Re-seal `history[last].manifestSha256` if the manifest
 *                             content changed but no member/example bytes did.
 *                             Refuses to seal across a member/example change; tells
 *                             the author to run --bump first.
 *   --bump <major|minor|patch>
 *                             Append a new history entry with the chosen semver
 *                             bump, snapshot current member/example hashes, and
 *                             seal the new entry.
 *   --sync-package-pin        Update package.json `verificationContractManifest`
 *                             to match `history[last]`. Mechanical, never hand-
 *                             edited.
 *   --bootstrap               One-time mode that writes an initial manifest with
 *                             history[0] for v1.0.0. Refuses if the manifest
 *                             already exists.
 *
 * Exit codes (all gates use distinct codes for negative validation tests):
 *   0  ok
 *   1  CONTRACT_MANIFEST_VERSION_NOT_BUMPED
 *   2  CONTRACT_MANIFEST_HASH_STALE
 *   3  CONTRACT_MANIFEST_VERSION_TOPLEVEL_MISMATCH
 *   4  CONTRACT_MANIFEST_HISTORY_NONMONOTONIC
 *   5  CONTRACT_MANIFEST_PKG_DRIFT
 *   6  CONTRACT_MANIFEST_STATIC_ASSET_DRIFT
 *   7  CONTRACT_MANIFEST_BUMP_REQUIRED  (--write refuses to seal across member change)
 *   8  CONTRACT_MANIFEST_META_INVALID
 *   9  argument / usage error
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Resolve the repo root the script operates on. Default is the parent of this
 * script's directory; tests override via `AGENTSKEPTIC_CONTRACT_ROOT` so they
 * can run the gate against temp fixture trees without copying the script too.
 * The meta-schema is always loaded from the same checkout as the script
 * (it is a shape definition, not contract content).
 */
const REPO_ROOT_DEFAULT = resolve(__dirname, "..");
const ROOT = resolve(process.env.AGENTSKEPTIC_CONTRACT_ROOT ?? REPO_ROOT_DEFAULT);

const MANIFEST_PATH = join(ROOT, "schemas", "contract", "v1.json");
const META_SCHEMA_PATH = join(REPO_ROOT_DEFAULT, "schemas", "contract-manifest.schema.json");
const PKG_PATH = join(ROOT, "package.json");
const STATIC_ASSET_PATH = join(ROOT, "website", "public", "contract", "v1.json");
const PUBLIC_URL = "https://agentskeptic.com/contract/v1.json";
const PRODUCT_PACKAGE = "agentskeptic";

const MEMBERS = /** @type {const} */ ({
  event: {
    role: "event-line",
    schemaPath: "schemas/event.schema.json",
    schemaId: "https://agentskeptic.com/schemas/event.schema.json",
  },
  toolsRegistry: {
    role: "registry",
    schemaPath: "schemas/tools-registry.schema.json",
    schemaId: "https://agentskeptic.com/schemas/tools-registry.schema.json",
  },
  toolsRegistryExport: {
    role: "registry-export",
    schemaPath: "schemas/tools-registry-export.schema.json",
    schemaId: "https://agentskeptic.com/schemas/tools-registry-export.schema.json",
  },
});

const EXAMPLES = /** @type {const} */ ({
  registry: { path: "examples/tools.json" },
  events: { path: "examples/events.ndjson" },
});

const VALIDATOR_FINGERPRINT = { library: "ajv", draft: "2020-12" };

const ERR = {
  VERSION_NOT_BUMPED: ["CONTRACT_MANIFEST_VERSION_NOT_BUMPED", 1],
  HASH_STALE: ["CONTRACT_MANIFEST_HASH_STALE", 2],
  VERSION_TOPLEVEL_MISMATCH: ["CONTRACT_MANIFEST_VERSION_TOPLEVEL_MISMATCH", 3],
  HISTORY_NONMONOTONIC: ["CONTRACT_MANIFEST_HISTORY_NONMONOTONIC", 4],
  PKG_DRIFT: ["CONTRACT_MANIFEST_PKG_DRIFT", 5],
  STATIC_ASSET_DRIFT: ["CONTRACT_MANIFEST_STATIC_ASSET_DRIFT", 6],
  BUMP_REQUIRED: ["CONTRACT_MANIFEST_BUMP_REQUIRED", 7],
  META_INVALID: ["CONTRACT_MANIFEST_META_INVALID", 8],
};

/** @param {keyof typeof ERR} key @param {string} detail */
function fail(key, detail) {
  const [code, exit] = ERR[key];
  process.stderr.write(`${code}: ${detail}\n`);
  process.exit(exit);
}

/**
 * Hash canonical text bytes so Windows CRLF vs Linux LF checkouts produce the
 * same digest (CI runs on Ubuntu; devs may use core.autocrlf).
 * @param {string} absPath
 */
function sha256OfFile(absPath) {
  const raw = readFileSync(absPath);
  const lower = absPath.replace(/\\/g, "/").toLowerCase();
  const isTextContract =
    lower.endsWith(".json") || lower.endsWith(".ndjson") || lower.endsWith(".yaml") || lower.endsWith(".yml");
  const buf = isTextContract
    ? Buffer.from(raw.toString("utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n"), "utf8")
    : raw;
  return createHash("sha256").update(buf).digest("hex");
}

/** Stable JSON serialization: keys sorted, no insignificant whitespace beyond
 *  the layout we want for human-readable diffs. We prefer the same indented
 *  shape we write to disk so canonicalization and committed bytes match. */
function canonicalize(value) {
  return JSON.stringify(sortKeys(value), null, 2) + "\n";
}

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === "object") {
    const out = {};
    for (const k of Object.keys(value).sort()) out[k] = sortKeys(value[k]);
    return out;
  }
  return value;
}

/** Compute the manifest's own hash with `history[last].manifestSha256` zeroed. */
function computeManifestSha256(manifest) {
  const clone = JSON.parse(JSON.stringify(manifest));
  clone.history[clone.history.length - 1].manifestSha256 = "";
  const bytes = canonicalize(clone);
  return createHash("sha256").update(Buffer.from(bytes, "utf8")).digest("hex");
}

/** @returns {{ memberSha256: Record<keyof typeof MEMBERS, string>, exampleSha256: Record<keyof typeof EXAMPLES, string> }} */
function snapshotLiveHashes() {
  const memberSha256 = {};
  for (const [key, m] of Object.entries(MEMBERS)) {
    memberSha256[key] = sha256OfFile(join(ROOT, m.schemaPath));
  }
  const exampleSha256 = {};
  for (const [key, e] of Object.entries(EXAMPLES)) {
    exampleSha256[key] = sha256OfFile(join(ROOT, e.path));
  }
  return { memberSha256, exampleSha256 };
}

function makeManifestSkeleton(manifestVersion) {
  return {
    $schema: "https://agentskeptic.com/schemas/contract-manifest.schema.json",
    manifestVersion,
    publicUrl: PUBLIC_URL,
    productPackage: PRODUCT_PACKAGE,
    members: { ...MEMBERS },
    examples: { ...EXAMPLES },
    validatorFingerprint: VALIDATOR_FINGERPRINT,
    history: [],
  };
}

function todayIsoDate() {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** @param {string} a @param {string} b -1/0/1 */
function semverCompare(a, b) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if (pa[i] < pb[i]) return -1;
    if (pa[i] > pb[i]) return 1;
  }
  return 0;
}

/** @param {string} v @param {"major"|"minor"|"patch"} kind */
function bumpVersion(v, kind) {
  const [maj, min, pat] = v.split(".").map(Number);
  if (kind === "major") return `${maj + 1}.0.0`;
  if (kind === "minor") return `${maj}.${min + 1}.0`;
  return `${maj}.${min}.${pat + 1}`;
}

async function loadMetaValidator() {
  const { Ajv2020 } = await import("ajv/dist/2020.js");
  const ajvFormatsModule = await import("ajv-formats");
  const ajvFormats = /** @type {any} */ (ajvFormatsModule.default ?? ajvFormatsModule);
  const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true });
  ajvFormats(ajv);
  const meta = JSON.parse(readFileSync(META_SCHEMA_PATH, "utf8"));
  return ajv.compile(meta);
}

function readManifest() {
  if (!existsSync(MANIFEST_PATH)) {
    fail("META_INVALID", `manifest missing at ${relative(ROOT, MANIFEST_PATH).split(sep).join("/")}`);
  }
  const raw = readFileSync(MANIFEST_PATH, "utf8");
  return { raw, manifest: JSON.parse(raw) };
}

function readPkg() {
  return JSON.parse(readFileSync(PKG_PATH, "utf8"));
}

function writeJson(absPath, value) {
  mkdirSync(dirname(absPath), { recursive: true });
  writeFileSync(absPath, canonicalize(value), "utf8");
}

async function runCheck() {
  const validate = await loadMetaValidator();
  const { raw, manifest } = readManifest();

  if (!validate(manifest)) {
    fail("META_INVALID", `manifest fails meta-schema: ${JSON.stringify(validate.errors)}`);
  }

  // Re-canonicalize and compare bytes. If the committed file is not in canonical
  // form, surface this as HASH_STALE so authors run --write.
  const expectedRaw = canonicalize(manifest);
  if (raw !== expectedRaw) {
    fail("HASH_STALE", `manifest is not in canonical form; run \`node scripts/contract-manifest.mjs --write\``);
  }

  const head = manifest.history[manifest.history.length - 1];

  // Strict ascending semver, no duplicates.
  for (let i = 1; i < manifest.history.length; i++) {
    if (semverCompare(manifest.history[i].manifestVersion, manifest.history[i - 1].manifestVersion) <= 0) {
      fail(
        "HISTORY_NONMONOTONIC",
        `history[${i}].manifestVersion ${manifest.history[i].manifestVersion} is not strictly greater than history[${i - 1}].manifestVersion ${manifest.history[i - 1].manifestVersion}`,
      );
    }
  }

  if (manifest.manifestVersion !== head.manifestVersion) {
    fail(
      "VERSION_TOPLEVEL_MISMATCH",
      `manifestVersion ${manifest.manifestVersion} != history[last].manifestVersion ${head.manifestVersion}`,
    );
  }

  // Live member / example hashes must match the head history entry; otherwise
  // the author edited a member without bumping.
  const live = snapshotLiveHashes();
  for (const key of Object.keys(MEMBERS)) {
    if (live.memberSha256[key] !== head.memberSha256[key]) {
      fail(
        "VERSION_NOT_BUMPED",
        `members.${key} hash drifted; live=${live.memberSha256[key]} history[last]=${head.memberSha256[key]} — run \`node scripts/contract-manifest.mjs --bump <major|minor|patch>\``,
      );
    }
  }
  for (const key of Object.keys(EXAMPLES)) {
    if (live.exampleSha256[key] !== head.exampleSha256[key]) {
      fail(
        "VERSION_NOT_BUMPED",
        `examples.${key} hash drifted; live=${live.exampleSha256[key]} history[last]=${head.exampleSha256[key]} — run \`node scripts/contract-manifest.mjs --bump <major|minor|patch>\``,
      );
    }
  }

  // Manifest's own hash with the field zeroed must match the sealed value.
  const recomputed = computeManifestSha256(manifest);
  if (recomputed !== head.manifestSha256) {
    fail(
      "HASH_STALE",
      `head.manifestSha256 stale; recomputed=${recomputed} sealed=${head.manifestSha256} — run \`node scripts/contract-manifest.mjs --write\``,
    );
  }

  // package.json pin parity.
  const pkg = readPkg();
  const pin = pkg.verificationContractManifest;
  if (
    !pin ||
    pin.version !== head.manifestVersion ||
    pin.manifestSha256 !== head.manifestSha256 ||
    pin.url !== manifest.publicUrl
  ) {
    fail(
      "PKG_DRIFT",
      `package.json verificationContractManifest != head; expected { version: "${head.manifestVersion}", manifestSha256: "${head.manifestSha256}", url: "${manifest.publicUrl}" }; got ${JSON.stringify(pin)} — run \`node scripts/contract-manifest.mjs --sync-package-pin\``,
    );
  }

  // Static asset parity (when website tree is present).
  if (existsSync(STATIC_ASSET_PATH)) {
    const staticRaw = readFileSync(STATIC_ASSET_PATH, "utf8");
    if (staticRaw !== raw) {
      fail(
        "STATIC_ASSET_DRIFT",
        `${relative(ROOT, STATIC_ASSET_PATH).split(sep).join("/")} differs from source; rerun the website ssot sync`,
      );
    }
  }

  console.log(
    `contract-manifest: ok (manifestVersion=${head.manifestVersion} manifestSha256=${head.manifestSha256.slice(0, 12)}…)`,
  );
}

async function runWrite() {
  const validate = await loadMetaValidator();
  const { manifest } = readManifest();
  const head = manifest.history[manifest.history.length - 1];
  const live = snapshotLiveHashes();

  for (const key of Object.keys(MEMBERS)) {
    if (live.memberSha256[key] !== head.memberSha256[key]) {
      fail(
        "BUMP_REQUIRED",
        `members.${key} changed since v${head.manifestVersion}. Run \`node scripts/contract-manifest.mjs --bump <major|minor|patch>\` before --write.`,
      );
    }
  }
  for (const key of Object.keys(EXAMPLES)) {
    if (live.exampleSha256[key] !== head.exampleSha256[key]) {
      fail(
        "BUMP_REQUIRED",
        `examples.${key} changed since v${head.manifestVersion}. Run \`node scripts/contract-manifest.mjs --bump <major|minor|patch>\` before --write.`,
      );
    }
  }

  // Re-seal the head entry's manifestSha256 over current canonical bytes.
  manifest.history[manifest.history.length - 1].manifestSha256 = "";
  const sha = computeManifestSha256(manifest);
  manifest.history[manifest.history.length - 1].manifestSha256 = sha;

  if (!validate(manifest)) {
    fail("META_INVALID", `produced manifest fails meta-schema: ${JSON.stringify(validate.errors)}`);
  }

  writeJson(MANIFEST_PATH, manifest);
  console.log(`contract-manifest: re-sealed manifestSha256=${sha}`);
}

async function runBump(kind) {
  if (!["major", "minor", "patch"].includes(kind)) {
    process.stderr.write(`usage: --bump <major|minor|patch>\n`);
    process.exit(9);
  }

  const validate = await loadMetaValidator();
  const { manifest } = readManifest();
  const head = manifest.history[manifest.history.length - 1];
  const next = bumpVersion(head.manifestVersion, /** @type {any} */ (kind));
  const live = snapshotLiveHashes();

  manifest.manifestVersion = next;
  manifest.history.push({
    manifestVersion: next,
    introducedAt: todayIsoDate(),
    memberSha256: live.memberSha256,
    exampleSha256: live.exampleSha256,
    manifestSha256: "",
  });

  const sha = computeManifestSha256(manifest);
  manifest.history[manifest.history.length - 1].manifestSha256 = sha;

  if (!validate(manifest)) {
    fail("META_INVALID", `produced manifest fails meta-schema: ${JSON.stringify(validate.errors)}`);
  }

  writeJson(MANIFEST_PATH, manifest);
  process.stderr.write(
    `bumped manifestVersion ${head.manifestVersion} -> ${next}; remember to run \`node scripts/contract-manifest.mjs --sync-package-pin\`\n`,
  );
  console.log(`contract-manifest: bumped to ${next} (manifestSha256=${sha})`);
}

function runSyncPackagePin() {
  const { manifest } = readManifest();
  const head = manifest.history[manifest.history.length - 1];
  const pkgRaw = readFileSync(PKG_PATH, "utf8");
  const pkg = JSON.parse(pkgRaw);

  const newPin = {
    version: head.manifestVersion,
    manifestSha256: head.manifestSha256,
    url: manifest.publicUrl,
  };

  // Remove any prior opaque marker; replace/add the structured pin.
  delete pkg["x-agentskeptic-decision-ready-contract"];
  pkg.verificationContractManifest = newPin;

  // Preserve trailing newline + 2-space indent style used by the repo.
  const trailingNewline = pkgRaw.endsWith("\n") ? "\n" : "";
  writeFileSync(PKG_PATH, JSON.stringify(pkg, null, 2) + trailingNewline, "utf8");
  console.log(
    `contract-manifest: synced package.json verificationContractManifest = ${JSON.stringify(newPin)}`,
  );
}

async function runBootstrap() {
  if (existsSync(MANIFEST_PATH)) {
    process.stderr.write(`contract-manifest: manifest already exists at ${MANIFEST_PATH}; refusing to bootstrap\n`);
    process.exit(9);
  }
  const validate = await loadMetaValidator();
  const live = snapshotLiveHashes();
  const manifest = makeManifestSkeleton("1.0.0");
  manifest.history.push({
    manifestVersion: "1.0.0",
    introducedAt: todayIsoDate(),
    memberSha256: live.memberSha256,
    exampleSha256: live.exampleSha256,
    manifestSha256: "",
  });
  const sha = computeManifestSha256(manifest);
  manifest.history[0].manifestSha256 = sha;

  if (!validate(manifest)) {
    fail("META_INVALID", `bootstrapped manifest fails meta-schema: ${JSON.stringify(validate.errors)}`);
  }

  writeJson(MANIFEST_PATH, manifest);
  console.log(`contract-manifest: bootstrapped v1.0.0 (manifestSha256=${sha})`);
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0) {
    process.stderr.write(
      "usage: contract-manifest.mjs --check | --write | --bump <kind> | --sync-package-pin | --bootstrap\n",
    );
    process.exit(9);
  }
  const flag = argv[0];
  switch (flag) {
    case "--check":
      await runCheck();
      return;
    case "--write":
      await runWrite();
      return;
    case "--bump":
      await runBump(argv[1] ?? "");
      return;
    case "--sync-package-pin":
      runSyncPackagePin();
      return;
    case "--bootstrap":
      await runBootstrap();
      return;
    default:
      process.stderr.write(`unknown flag: ${flag}\n`);
      process.exit(9);
  }
}

main().catch((e) => {
  process.stderr.write(`contract-manifest: fatal: ${e?.stack ?? e}\n`);
  process.exit(9);
});
