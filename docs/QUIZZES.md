# Quiz Engine — Definitions, Scoring, Admin

Prompt 6. Quizzes are DATA: definitions live in the `quizzes` table;
one renderer (`src/components/quiz/QuizRunner.tsx`) consumes any row.
**Adding a quiz = inserting a row** (easiest: /admin/quizzes →
Duplicate → reshape → flip live). The two launch quizzes are seed rows
(`which-coast` live, `which-development` draft until the developments
surface goes public — zero published devs and the feature flag is off).

## Definition shape (JSONB columns on `quizzes`)

```jsonc
{
  "slug": "which-coast",
  "title": "Which stretch of coast is for you?",
  "status": "live",                    // live | draft (draft = admin preview only)
  "intro": {
    "eyebrow": "60-second match",
    "heading": "…", "sub": "…",
    "cta": "Find my stretch",
    "estimate": "7 questions · under 90 seconds"
  },
  "questions": [
    {
      "id": "saturday",
      "kind": "photo",                 // photo | cards | slider
      "text": "Saturday morning. Where are you?",
      "sub": "optional sub-copy",
      "core": null,                    // budget|timeline|purpose|party|area_pref → recorded on the lead
      "options": [
        {
          "id": "market",
          "label": "Old-town market, then coffee",
          "sublabel": "optional",
          "photo": "area:marbella",   // `area:<slug>` token (resolved to that area's hero) or a URL
          "weights": { "marbella": 3, "estepona": 3 },   // target → score
          "record": "Market & coffee",                    // how it reads on the lead row
          "feedback": "One reactive line shown after picking this"
        }
      ]
    }
  ],
  "result": {
    "kind": "area",                    // area | development
    "count": 3,
    "headline": "Your stretch of coast",
    "sub": "…", "guideNote": "…",
    "cta": { "label": "Book a 30-min orientation call", "sub": "…" }
  }
}
```

## Scoring & matching (src/lib/quiz.ts)

Chosen options' `weights` are summed per target.

- **kind: area** — targets are **area slugs**; top-N resolved against
  the *published* areas pool. Sparse scoring pads from editorially-safe
  defaults so the results screen never looks empty.
- **kind: development** — developments churn, so targets are stable
  **criteria tokens** `crit:<dimension>:<value>`:
  `crit:status:key_ready|under_construction|off_plan` ·
  `crit:budget:b1..b5` (price_from bands: <350k, 350–700k, 700k–1.5M,
  1.5–3M, 3M+) · `crit:cluster:west|centre|east` ·
  `crit:goal:yield|growth`. Each *published* dev is scored by how its
  real fields satisfy the visitor's criteria totals.

**CURATION RULE (hard):** result cards only surface published areas,
published developments, and listings from the curated universe
(non-Resales or admin-featured) — the pools handed to the renderer come
from the curated fetchers and the resolvers drop anything outside them.
An unpublished slug in a weight map simply never surfaces (e.g.
`benalmadena` weights activate the day that area publishes).

## Conversion flow (decided)

Funnel order: photo-led identity questions FIRST, qualifying
(purpose/timeline/budget) LAST. Matches are computed client-side as
answers accumulate → the contact screen ("final step", progress reads
"Your matches are ready") shows them blurred/masked behind the fields.
Name + email + **phone (required — call-first; fix framing, never the
field)**. "Show my matches →" renders results INSTANTLY; the lead posts
in the background to the hardened `/api/leads` (signed token + honeypot
+ rate limit) with `source: quiz-area|quiz-dev`,
`source_detail: <slug> · <match slugs>`, the full Q→A set in `message`,
and `budget_tier`/`purchase_timeline` filled from the core questions —
the advisor reads all of it on the lead row before dialing; quiz leads
get the same new-lead glow + same-hour-callback treatment.

Results CTA is swappable: `NEXT_PUBLIC_BOOKING_URL` (Cal.com when
wired) → `NEXT_PUBLIC_WHATSAPP_URL` → `/contact` fallback.

The seven-question cap forced one trade-off (documented): the dev quiz
folds *party* into the purpose options' `record` strings and encodes
off-plan comfort + payment-terms appetite inside the keys-when slider —
all four dev-module topics are asked, and the shared core stays
comparable on budget/timeline/purpose/area_pref.

## Instrumentation

Every step fires `trackQuiz()` (src/lib/quiz-track.ts): first-party →
`quiz_events` (no PII/cookies; start / answer / contact_view /
complete + per-question ids and a per-run id → drop-off and answer
distributions are queryable now), and mirrored to `window.posthog`
whenever PostHog is mounted (same event names: `quiz_start`,
`quiz_answer`, …). Completion stats render on /admin/quizzes.

```sql
-- per-question drop-off for one quiz
select question_id, count(distinct run_id) reached
from quiz_events where quiz_slug='which-coast' and event='answer'
group by 1 order by reached desc;
```

## Admin (/admin/quizzes)

List with status + starts / reached-gate / completed / completion % /
leads. Per quiz: edit title/intro/status, add/remove/reorder questions
(↑↓), edit option labels/photos (URL or area-token picker)/recorded
answers/feedback lines, edit matching weights (target+score rows),
result copy, **Duplicate as draft**, **Preview** (drafts render only
for an authenticated admin via `?preview=1`). Saving a live quiz
refreshes public caches immediately (QUIZZES_TAG).
