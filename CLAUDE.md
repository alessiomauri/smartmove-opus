# Smartmove Marbella — project rules for Claude

## Start here (Opus working copy)

This is the **Opus 4.8 working copy** on branch `opus-4.8`. The original repo
(`~/Desktop/smartmove-web`, `main`) is the **frozen Fable baseline** — do not
edit it. Before doing real work, read, in order:
1. `OPUS_CONTINUITY_NOTES.md` (this repo root) — orientation, source-of-truth
   precedence, the open sandbox-vs-production issue, hard constraints, next steps.
2. `HANDOVER.md` (this repo root) — the engineering audit (schema, env vars,
   migrations, §11 do-not-revert workarounds).
3. `../smartmove-web-briefs-opus/HANDOVER.md` — strategy/decisions/design history.
4. `../smartmove-web-briefs-opus/SMARTMOVE_NEXT_PROMPTS.md` — master prompts + standards.

Run `npm install` before running this copy. Never set `MONDAY_API_TOKEN`. STOP
before any production data flip (sandbox→prod, full import, row deletes) — those
are Alessio's call.

## Verification standard

Backend verification alone never closes a user-facing feature. Before
claiming anything works: verify in a real browser (Preview/Playwright)
— navigate as a user, find the control, click it, assert the visible
outcome, screenshot it. Debriefs must include UI-level evidence for
anything with UI. Data features: spot-check rendered values against
the DB, not just that the query runs.

## Design port standard (binding — never needs restating in a prompt)

When porting any Claude Design page/component (sources live in
`../site claude design/` — the design folder), this is the DEFAULT bar.
Apply it without being told:

1. **Faithful, not approximate.** Reproduce the design exactly —
   typography, spacing, the gold family, imagery, section rhythm,
   hover + motion. The design HTML/CSS is the source of truth, never
   screenshots or memory.
2. **Inventory first.** Before building, read the FULL design (HTML
   structure + its CSS + any JS) and list every section, interaction/
   animation, and asset. Port ALL of it; flag ambiguities, never drop them.
3. **Adapt the design's own CSS.** Lift its HTML+CSS into the components
   referencing the ported `--sm-*` tokens. Do NOT re-derive styles ad hoc,
   and do NOT use Tailwind's same-named built-ins (`text-2xl`, `rounded-lg`,
   `leading-relaxed`…) for brand type/spacing/radius — the brand scale lives
   in `--sm-*` / `.sm-kicker` / `h1–h5`.
4. **Port interactions + motion too** (carousels, countdowns, marquees,
   scroll reveals, sticky/glass header, language/currency) using the
   `--sm-*` motion tokens — not just static layout.
5. **Copy referenced assets** from the design `assets/` into the app's
   public dir.
6. **Keep it wired.** Re-skin existing components — preserve data/logic,
   the leads pipeline, links and CTAs. Every button must route correctly;
   if a destination is unclear, ask.
7. **Don't break** existing routes or restyle unrelated pages.
8. **Verify visually.** Open the design HTML in a real browser, screenshot
   it, screenshot the ported route at the same desktop viewport, compare
   SECTION BY SECTION until they match. Desktop now; mobile is its own later
   pass. Lead the debrief with the inventory + side-by-side screenshots;
   state VERIFIED vs ASSUMED.

If unsure about anything, ask before assuming.
