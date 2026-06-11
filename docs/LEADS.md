# Lead Pipeline — Capture, Protection, Interim CRM, Selection Emails

Implements SMARTMOVE_BRIEF §4.5. Monday stays **disconnected**
(`MONDAY_API_TOKEN` unset ⇒ the wrapper no-ops); `/admin/leads` is the
interim CRM and the local `leads` table is the source of truth.

## Capture surfaces (one pipeline)

| Surface | Component | source | source_detail |
|---|---|---|---|
| Property page — "Request a viewing" | `LeadCaptureSection` (after the gallery; sticky card column on desktop) | `viewing-request` | listing reference |
| Property page — brochure email-gate | same section; success reveals the on-the-fly PDF (`/api/property/[slug]/brochure`) | `brochure-request` | listing reference |
| Development page — 4 sidebar actions (Register early interest / Download the brochure / Book a virtual presentation / Schedule a viewing) | `DevLeadActions` (sticky rail desktop, card after stats mobile; behind `NEW_DEVELOPMENTS_PUBLIC`) | `viewing-request` / `brochure-request` | `ref · intent:<label>` — one pipeline, four intents |
| `/contact` (+ `/es/contacto`) | contact page | `contact-form` | `contact-page` |
| Footer slim form (site-wide) | `SiteFooter` | `contact-form` | `footer` |
| Newsletter | `NewsletterForm` (pre-existing) | `newsletter` | page path |

All post to `POST /api/leads` (zod-validated, service-role insert,
Monday wrapper no-ops after the response).

## Protections on /api/leads

1. **Rate limit** — Upstash sliding window per IP, default 5/min
   (`LEADS_RATE_LIMIT_PER_MIN`). **Env-gated:** without
   `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` (e.g. local
   dev) it's skipped; on Redis errors it FAILS OPEN (a lead beats a
   limit). Returns a friendly 429. → To arm in prod: create a free
   Upstash Redis db, add both env vars in Vercel, redeploy.
2. **Honeypot** — hidden `company` input. Filled ⇒ HTTP 200 with a
   plausible fake leadId, nothing written.
3. **Min time-to-submit** — forms fetch a signed HMAC timestamp from
   `/api/leads/token` on MOUNT (pages are ISR-cached, so render-time
   stamps would be stale). Submits <2s after mount ⇒ fake 200, drop.
   Missing/forged/expired (>6h) token ⇒ 400 "reload the page". Secret:
   `LEAD_FORM_SECRET` (falls back to `SYNC_CRON_SECRET` — no new env
   needed).

Verified locally (prod build): no-token → 400; honeypot → 200 + no row;
<2s → 200 + no row; forged → 400; legit → exactly one row.

## Form views vs submissions

Every form fires one `view` beacon per mount → `lead_form_events`
(no cookies, no PII, path + listing ref only). Submissions are the
`leads` rows. Conversion (7d) shows on the dashboard header; per-form:

```sql
select e.form, count(distinct e.id) views,
  (select count(*) from leads l where l.source = e.form
    and l.submitted_at > now() - interval '7 days') submits
from lead_form_events e
where e.created_at > now() - interval '7 days' group by 1;
```

## /admin/leads — call-first workflow

- Newest first; **new** rows are loud (gold edge, tinted, pulse dot) —
  the same-hour-callback rule depends on it.
- Status pipeline, one click each: `new → called → selection_sent →
  closed` (legacy enum values stay valid in the DB).
- Click-to-act: `tel:` + `wa.me` (pre-filled greeting incl. listing
  ref) + `mailto:`.
- Row expands to everything submitted (message with preferred date and
  intent label, context, budget/timeline fields ready for the quiz).
- Filters: status / source / date range. Header: new today · new this
  week · awaiting call · 7-day conversion.

## Copy-card-to-email (selection emails)

Admin-only; the app never sends email — clipboard only.

- **From the property list** (`/admin`): tick any rows → floating bar →
  "Copy for email". Cards stack vertically in one paste, selection
  order preserved (≤20).
- **From a lead row**: "Copy card for email" copies that lead's listing
  with `lead=<id>` on every URL; paste into your mail client, then
  one-click flip the lead to **Selection sent**.
- Card: 600px table layout, every style inline, Georgia serif stack,
  absolute CDN image, gold hairline, "View property" button. Links
  carry `utm_source=selection&utm_medium=email&utm_campaign=property-selection`
  (+`lead=<id>`), so analytics ties clicks to the lead.
- Clipboard: `ClipboardItem` with `text/html` + `text/plain` fallback.

**Gmail check (do once):** open Gmail web → Compose → paste. Expect
image, name, price, spec line, gold rule and the button; click the
button and confirm the URL carries the utm+lead params.
**Outlook caveats (known, not chased):** desktop Outlook (Word engine)
squares off the rounded corners and ignores `max-width`; the fixed
600px width keeps layout intact. Some clients drop the paper-tint
backdrop. Both cosmetic.

## Env summary

| Var | Required? | Purpose |
|---|---|---|
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | recommended in prod | arms the rate limit |
| `LEADS_RATE_LIMIT_PER_MIN` | optional (5) | window size |
| `LEAD_FORM_SECRET` | optional | token HMAC (falls back to `SYNC_CRON_SECRET`) |
| `MONDAY_API_TOKEN` | **leave unset** | Monday stays disconnected |
