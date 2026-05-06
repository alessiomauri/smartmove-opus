# Design handoff

The contract between Claude Design (visual layer) and the dev side (everything else).

## Files

| File | Owned by | Purpose |
|---|---|---|
| `tokens.css` | Claude Design | All visual tokens (color, type, spacing, radius, shadow, motion). Imported by `src/app/globals.css`. |
| `DECISIONS.md` | Both | One-line ledger of every locked design decision and when it was made. |
| `components/<name>.md` | Claude Design | Per-component spec — variants, states, breakpoints, microinteractions, asset URLs. |

## How handoff works

1. **Claude Design conversation** produces a deliverable (regenerated `tokens.css`, or a new `components/<name>.md`).
2. The user **drops the file into this folder**, replacing the previous version.
3. **Dev side picks it up** — for `tokens.css`, all UI re-skins instantly because every component consumes `--sm-*` tokens; for component specs, the dev side implements against the spec and confirms with a deploy preview.
4. **DECISIONS.md gets a new line** with the date and what was decided.

## Token naming

Every token is `--sm-<category>-<name>`. Categories:

- `color` — palette, semantic, status
- `font` — family
- `text` — type scale (xs → 6xl)
- `leading` — line-height
- `tracking` — letter-spacing
- `space` — spacing scale (1 → 10)
- `radius` — corner radius
- `shadow` — elevation
- `duration` / `easing` — motion
- `max-width` — layout maxes

If the application ever wants something visual that isn't in tokens.css, it's a sign tokens.css needs a new variable — flag it back to Claude Design rather than hardcoding.

## Order of conversations with Claude Design

Strictly serial — each builds on the previous output:

1. **Brand foundation** (colors, typography, type scale, spacing, radius, shadow) → regenerates `tokens.css`
2. **Property card system** (grid card, featured card, map popup, email card)
3. **Search/filter UX** (real-time, mobile-first)
4. **Homepage** (hero, featured listings block, featured developments block, trust block, language switcher)
5. **Property detail page** (hero, gallery, contact CTA, agent card)
6. **Email Property Selection Builder** (admin tool)
7. **Programmatic landing template** (`/villas-in-marbella-up-to-2m` etc.)
8. **Agent card** + agent profile page

## What does NOT live in this folder

- React components → `src/components/`
- Application logic → `src/lib/`, `src/app/`
- Brand asset originals (logos, photos, PDFs) → `~/Desktop/smartmove-brand-assets/`
- Markdown specs that drive product behaviour (not visual) → root `docs/`
