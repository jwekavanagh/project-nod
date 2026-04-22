# AgentSkeptic brand system (SSOT)

This file is the **only** branding documentation added for the rebrand. Do not add parallel “brand guidelines” or page-level branding docs elsewhere.

## Canonical assets

| File | Purpose |
|------|---------|
| `website/public/brand/mark.png` | Square header + OG source mark (navy + signal green). Wordmark and tagline text live in React (`BrandLockup`) and on the OG composite. |
| `website/src/app/icon.png` / `apple-icon.png` | Favicon + touch icon, rasterized from `mark.png` (regenerate if the mark file changes). |
| `website/public/og.png` | Open Graph raster, **1200×630**: `mark.png` + wordmark (see `export-og-from-lockup.cjs`). |

When `mark.png` or `og.png` changes, update the SHA-256 constants in `website/__tests__/rebrand-assets.contract.test.ts` in the **same** commit. After editing `mark.png`, re-run the OG script and, if the square dimensions change, regenerate `icon.png` / `apple-icon.png` from the new PNG.

## Canonical CSS tokens

Defined in `website/src/app/globals.css` inside the `:root` block (byte-pinned by `website/__tests__/globals-css-surface-contract.test.ts`).

| Token | Hex / value | Role |
|-------|----------------|------|
| `--bg` | `#f6f8fc` | Page background (light) |
| `--surface` | `#eef2f7` | Panels |
| `--surface-2` | `#e2e8f0` | Elevated panels / secondary buttons |
| `--fg` | `#0b1220` | Primary text |
| `--muted` | `#5c6b7a` | Secondary text |
| `--brand-navy-ink` | `#0b1f33` | Wordmark “Agent”, tagline |
| `--accent` | `#00c853` | Links, “Skeptic”, focus ring, primary CTA fill |
| `--accent-on-card` | `#007a3d` | Muted green on white (AA on `--card`) |
| `--accent-contrast` | `#ffffff` | Text on solid accent buttons |
| `--card` | `#ffffff` | Cards / inputs |
| `--border` | `#d0d7e0` | Borders |
| `--link` / `--link-hover` | `#1a4a6e` / `#0b1f33` | Default underlined text links in page content (nav/footer reset to `--fg` / accent) |
| `--danger` / `--danger-bright` / `--danger-border` | `#b91c1c` / `#d92d20` + mix | Form errors, terminal failure hit color, error JSON border |
| `--font-sans` | (Next `Inter` + fallbacks) | All UI typography |

Ghost framing utility:

```css
.surface-ghost {
  border: 1px dashed color-mix(in srgb, var(--accent) 55%, var(--border));
  background: color-mix(in srgb, var(--card) 88%, transparent);
}
```

## Copy ownership

| Audience / surface | Source file | Fields |
|--------------------|-------------|--------|
| Homepage hero title, README fold hero, `llms.txt` (via sync) | `config/primary-marketing.json` | `heroTitle`, `readmeTitle`, `heroSubtitle`, `visitorProblemAnswer`, `homepageDecisionFraming`, `pageMetadata`, `cliFollowupLines`, … |
| `llms.txt` summary line after adoption fence, OpenAPI package line, discovery payload (same file) | `config/primary-marketing.json` | `identityOneLiner` |
| Site chrome tagline only | `website/src/components/BrandLockup.tsx` | Literal `TRUST REALITY, NOT TRACES.` (not in discovery JSON) |
| npm `package.json` `description` | Sync from discovery | `pageMetadata.description` |

After editing JSON, run from repository root: **`npm run emit-primary-marketing`** (or **`sync:public-product-anchors`**, the alias; see existing distribution docs in-repo for full artifact list).

## Regenerating `og.png` (single command)

From repository root, after installing website devDependencies (`npm install` at repo root or in `website/`):

```bash
node website/scripts/export-og-from-lockup.cjs
```

Then recompute SHA-256 for `website/public/og.png` and update `OG_PNG_SHA256` in `website/__tests__/rebrand-assets.contract.test.ts`.

## Non-goals

- No dark/light toggle: the commercial site is **light theme only** (tokens above).
- No edits to `debug-ui/` in this cutover.
- No additional markdown branding documents beyond this file.
