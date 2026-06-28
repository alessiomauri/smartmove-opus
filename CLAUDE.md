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
