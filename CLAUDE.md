# Smartmove Marbella — project rules for Claude

## Verification standard

Backend verification alone never closes a user-facing feature. Before
claiming anything works: verify in a real browser (Preview/Playwright)
— navigate as a user, find the control, click it, assert the visible
outcome, screenshot it. Debriefs must include UI-level evidence for
anything with UI. Data features: spot-check rendered values against
the DB, not just that the query runs.
