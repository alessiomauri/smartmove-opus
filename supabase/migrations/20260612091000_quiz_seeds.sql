-- Seed the two launch quizzes (Prompt 6). These are ordinary rows — the
-- admin panel can edit every word, photo and weight. Photo refs use the
-- `area:<slug>` token (resolved to that area's hero image at render).
--
-- Question ORDER is the engagement funnel: photo-led identity questions
-- first; qualifying (purpose/timeline/budget) LAST, right before the
-- contact gate.
--
-- which-development seeds as DRAFT: there are zero published
-- developments yet and NEW_DEVELOPMENTS_PUBLIC is off — flip to live in
-- /admin/quizzes when the dev surface launches.

INSERT INTO quizzes (slug, title, status, intro, questions, result)
VALUES (
  'which-coast',
  'Which stretch of coast is for you?',
  'live',
  $${
    "eyebrow": "60-second match",
    "heading": "Which stretch of coast is for you?",
    "sub": "Seven taps. No typing. We match you to the three areas that actually fit how you live — not the ones with the loudest ads.",
    "cta": "Find my stretch",
    "estimate": "7 questions · under 90 seconds"
  }$$::jsonb,
  $$[
    {
      "id": "saturday",
      "kind": "photo",
      "text": "Saturday morning. Where are you?",
      "options": [
        { "id": "market", "label": "Old-town market, then coffee", "photo": "area:marbella",
          "weights": { "marbella": 3, "estepona": 3, "san-pedro": 2, "casares": 2 },
          "record": "Market & coffee", "feedback": "A morning person with taste — the old towns are calling." },
        { "id": "golf", "label": "First tee at 8am", "photo": "area:nueva-andalucia",
          "weights": { "nueva-andalucia": 3, "la-quinta": 3, "mijas-golf": 3, "los-flamingos": 2 },
          "record": "First tee at 8", "feedback": "Seventy courses within an hour. You'll cope." },
        { "id": "promenade", "label": "Long run on the promenade", "photo": "area:fuengirola",
          "weights": { "fuengirola": 3, "la-cala-de-mijas": 3, "san-pedro": 2, "estepona": 2 },
          "record": "Promenade run", "feedback": "Flat, long and right on the water — noted." },
        { "id": "hills", "label": "Into the hills before it warms up", "photo": "area:benahavis",
          "weights": { "benahavis": 3, "el-madroñal": 2, "la-zagaleta": 2, "mijas": 2 },
          "record": "Hill walk", "feedback": "Altitude and quiet. The coast looks better from above." }
      ]
    },
    {
      "id": "terrace",
      "kind": "photo",
      "text": "Which terrace is yours?",
      "options": [
        { "id": "beachfront", "label": "Frontline beach, doors wide open", "photo": "area:new-golden-mile",
          "weights": { "new-golden-mile": 3, "estepona": 2, "el-chaparral": 2, "los-monteros": 2 },
          "record": "Beachfront apartment" },
        { "id": "golf-garden", "label": "Villa garden on the fairway", "photo": "area:guadalmina",
          "weights": { "nueva-andalucia": 3, "guadalmina": 2, "la-quinta": 2, "el-paraiso": 1 },
          "record": "Golf villa" },
        { "id": "infinity", "label": "Hillside infinity, sea below", "photo": "area:la-zagaleta",
          "weights": { "la-zagaleta": 3, "el-madroñal": 3, "sierra-blanca": 2, "benahavis": 2 },
          "record": "Hillside villa with view", "feedback": "The view tax is real — and worth it." },
        { "id": "rooftop", "label": "Town rooftop, everything walkable", "photo": "area:malaga",
          "weights": { "marbella": 2, "fuengirola": 2, "malaga": 2, "estepona": 1 },
          "record": "Town penthouse" }
      ]
    },
    {
      "id": "area_pref",
      "kind": "cards",
      "core": "area_pref",
      "text": "Any pull already?",
      "sub": "Where on the map are you drawn to — gut feel is fine.",
      "options": [
        { "id": "west", "label": "West", "sublabel": "Estepona → Sotogrande",
          "weights": { "estepona": 2, "casares": 2, "manilva": 2, "sotogrande": 2, "finca-cortesin": 1 }, "record": "West (Estepona–Sotogrande)" },
        { "id": "centre", "label": "Centre", "sublabel": "Marbella & the Golden Mile",
          "weights": { "marbella": 2, "golden-mile": 2, "puerto-banus": 2, "nueva-andalucia": 2, "sierra-blanca": 1 }, "record": "Centre (Marbella core)" },
        { "id": "east", "label": "East", "sublabel": "Mijas → Málaga",
          "weights": { "mijas-costa": 2, "la-cala-de-mijas": 2, "fuengirola": 2, "benalmadena": 2, "malaga": 1 }, "record": "East (Mijas–Málaga)" },
        { "id": "open", "label": "Surprise me", "sublabel": "That is what the quiz is for",
          "weights": {}, "record": "Open to anywhere" }
      ]
    },
    {
      "id": "party",
      "kind": "cards",
      "core": "party",
      "text": "Who is it for?",
      "options": [
        { "id": "solo", "label": "Just me", "weights": {}, "record": "Solo" },
        { "id": "couple", "label": "The two of us", "weights": {}, "record": "Couple" },
        { "id": "family", "label": "Family — kids in tow", "sublabel": "Schools matter",
          "weights": { "nueva-andalucia": 1, "guadalmina": 1, "san-pedro": 1, "elviria": 1 }, "record": "Family with kids" },
        { "id": "multigen", "label": "The whole tribe", "sublabel": "Parents, kids, visitors",
          "weights": { "benahavis": 1, "mijas": 1, "elviria": 1 }, "record": "Multi-generation" }
      ]
    },
    {
      "id": "purpose",
      "kind": "cards",
      "core": "purpose",
      "text": "And the honest reason?",
      "options": [
        { "id": "live", "label": "Living here full-time", "weights": { "san-pedro": 1, "fuengirola": 1, "estepona": 1 }, "record": "Relocating full-time", "feedback": "The year-round coast is a different (better) place." },
        { "id": "holiday", "label": "A holiday base", "weights": { "la-cala-de-mijas": 1, "cabopino": 1, "estepona": 1 }, "record": "Holiday home" },
        { "id": "invest", "label": "An investment", "weights": { "fuengirola": 1, "malaga": 1, "mijas-costa": 1 }, "record": "Investment" },
        { "id": "mix", "label": "Holidays now, more later", "weights": {}, "record": "Mix — use now, decide later" }
      ]
    },
    {
      "id": "timeline",
      "kind": "slider",
      "core": "timeline",
      "text": "When would you want keys?",
      "options": [
        { "id": "now", "label": "Ready now", "weights": {}, "record": "ready-now" },
        { "id": "3-6", "label": "3–6 months", "weights": {}, "record": "3-6-months" },
        { "id": "6-12", "label": "6–12 months", "weights": {}, "record": "6-12-months" },
        { "id": "exploring", "label": "Just exploring", "weights": {}, "record": "exploring" }
      ]
    },
    {
      "id": "budget",
      "kind": "slider",
      "core": "budget",
      "text": "Comfortable budget?",
      "sub": "Bands, not euros — this only narrows the map.",
      "options": [
        { "id": "b1", "label": "Up to €350k", "weights": { "fuengirola": 2, "torremolinos": 2, "manilva": 2, "benalmadena": 2, "mijas-costa": 1 }, "record": "<350k" },
        { "id": "b2", "label": "€350k – €700k", "weights": { "la-cala-de-mijas": 2, "estepona": 2, "san-pedro": 1, "el-paraiso": 1, "selwo": 1 }, "record": "350k-700k" },
        { "id": "b3", "label": "€700k – €1.5M", "weights": { "nueva-andalucia": 2, "guadalmina": 2, "los-monteros": 1, "elviria": 1, "san-pedro": 1 }, "record": "700k-1.5m" },
        { "id": "b4", "label": "€1.5M – €3M", "weights": { "golden-mile": 2, "los-flamingos": 2, "sierra-blanca": 1, "la-quinta": 1, "puente-romano": 1 }, "record": "1.5m-3m", "feedback": "That opens the addresses people move here for." },
        { "id": "b5", "label": "€3M+", "weights": { "la-zagaleta": 3, "golden-mile": 2, "sierra-blanca": 2, "puente-romano": 2, "sotogrande": 1 }, "record": "3m+", "feedback": "Gates, privacy and the serious end of the Golden Mile." }
      ]
    }
  ]$$::jsonb,
  $${
    "kind": "area",
    "count": 3,
    "headline": "Your stretch of coast",
    "sub": "Three areas that fit how you actually live — each with its full guide and current curated listings.",
    "guideNote": "We are sending the area guide PDFs for all three matches to your email.",
    "cta": { "label": "Book a 30-min orientation call", "sub": "Free, no pitch — a local walks you through your matches." }
  }$$::jsonb
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO quizzes (slug, title, status, intro, questions, result)
VALUES (
  'which-development',
  'Which new development fits your brief?',
  'draft',
  $${
    "eyebrow": "Off-plan, matched",
    "heading": "Which new development fits your brief?",
    "sub": "Seven taps to match you with the projects worth a flight — completion dates, payment terms and yield profile included.",
    "cta": "Match my brief",
    "estimate": "7 questions · under 90 seconds"
  }$$::jsonb,
  $$[
    {
      "id": "view",
      "kind": "photo",
      "text": "Pick the view from your future terrace",
      "options": [
        { "id": "sea", "label": "Open sea, frontline", "photo": "area:estepona",
          "weights": { "crit:cluster:west": 2, "crit:cluster:east": 1 }, "record": "Frontline sea view", "feedback": "Frontline new-builds are rare — good thing we track them all." },
        { "id": "golf", "label": "Down the fairway", "photo": "area:nueva-andalucia",
          "weights": { "crit:cluster:centre": 2, "crit:cluster:west": 1 }, "record": "Golf view" },
        { "id": "marina", "label": "Marina lights", "photo": "area:puerto-banus",
          "weights": { "crit:cluster:east": 2, "crit:cluster:centre": 1 }, "record": "Marina view" },
        { "id": "hillside", "label": "Hills and sea together", "photo": "area:benahavis",
          "weights": { "crit:cluster:centre": 2, "crit:cluster:west": 2 }, "record": "Elevated panoramic" }
      ]
    },
    {
      "id": "building",
      "kind": "photo",
      "text": "The place you'd rather come home to",
      "options": [
        { "id": "boutique", "label": "Boutique low-rise, few neighbours", "photo": "area:el-paraiso", "weights": {}, "record": "Boutique low-rise" },
        { "id": "resort", "label": "Resort living — pools, gym, co-work", "photo": "area:la-cala-de-mijas", "weights": {}, "record": "Resort amenities", "feedback": "Amenity-rich resorts also rent hardest. Useful overlap." },
        { "id": "branded", "label": "Branded residence, hotel service", "photo": "area:golden-mile", "weights": {}, "record": "Branded residence" },
        { "id": "villas", "label": "A gated villa community", "photo": "area:la-zagaleta", "weights": {}, "record": "Gated villas" }
      ]
    },
    {
      "id": "timeline",
      "kind": "slider",
      "core": "timeline",
      "text": "When do you want keys?",
      "sub": "This sets how off-plan you can comfortably go.",
      "options": [
        { "id": "now", "label": "Move-in ready only", "weights": { "crit:status:key_ready": 3 }, "record": "ready-now" },
        { "id": "year", "label": "Within a year", "weights": { "crit:status:under_construction": 2, "crit:status:key_ready": 1 }, "record": "6-12-months" },
        { "id": "two", "label": "Up to two years — staged payments suit me", "weights": { "crit:status:off_plan": 2, "crit:status:under_construction": 1 }, "record": "12-24-months" },
        { "id": "patient", "label": "3+ years for the best price", "weights": { "crit:status:off_plan": 3 }, "record": "24-months-plus", "feedback": "Patience is the biggest discount in off-plan." }
      ]
    },
    {
      "id": "goal",
      "kind": "slider",
      "core": null,
      "text": "Yield or growth?",
      "sub": "Slide to where you sit.",
      "options": [
        { "id": "yield", "label": "Cash flow — rent it hard", "weights": { "crit:goal:yield": 2 }, "record": "Yield-first" },
        { "id": "lean-yield", "label": "Mostly yield", "weights": { "crit:goal:yield": 1 }, "record": "Yield-leaning" },
        { "id": "balanced", "label": "Balanced", "weights": {}, "record": "Balanced yield/growth" },
        { "id": "lean-growth", "label": "Mostly growth", "weights": { "crit:goal:growth": 1 }, "record": "Growth-leaning" },
        { "id": "growth", "label": "Capital growth — sell well later", "weights": { "crit:goal:growth": 2 }, "record": "Growth-first" }
      ]
    },
    {
      "id": "area_pref",
      "kind": "cards",
      "core": "area_pref",
      "text": "Where on the coast?",
      "options": [
        { "id": "west", "label": "West", "sublabel": "Estepona → Sotogrande", "weights": { "crit:cluster:west": 2 }, "record": "West (Estepona–Sotogrande)" },
        { "id": "centre", "label": "Centre", "sublabel": "Marbella & Benahavís", "weights": { "crit:cluster:centre": 2 }, "record": "Centre (Marbella core)" },
        { "id": "east", "label": "East", "sublabel": "Mijas → Málaga", "weights": { "crit:cluster:east": 2 }, "record": "East (Mijas–Málaga)" },
        { "id": "open", "label": "Wherever the project is right", "weights": {}, "record": "Open to anywhere" }
      ]
    },
    {
      "id": "purpose",
      "kind": "cards",
      "core": "purpose",
      "text": "And the plan for it?",
      "options": [
        { "id": "live", "label": "Our main home", "weights": { "crit:goal:growth": 1 }, "record": "Relocating full-time · family/couple" },
        { "id": "holiday", "label": "Lock-up-and-leave holiday base", "weights": {}, "record": "Holiday home · couple" },
        { "id": "invest", "label": "Pure investment", "weights": { "crit:goal:yield": 1 }, "record": "Investment" },
        { "id": "mix", "label": "Use it some weeks, rent the rest", "weights": { "crit:goal:yield": 1 }, "record": "Mixed use" }
      ]
    },
    {
      "id": "budget",
      "kind": "slider",
      "core": "budget",
      "text": "Comfortable budget?",
      "options": [
        { "id": "b1", "label": "Up to €350k", "weights": { "crit:budget:b1": 3 }, "record": "<350k" },
        { "id": "b2", "label": "€350k – €700k", "weights": { "crit:budget:b2": 3 }, "record": "350k-700k" },
        { "id": "b3", "label": "€700k – €1.5M", "weights": { "crit:budget:b3": 3 }, "record": "700k-1.5m" },
        { "id": "b4", "label": "€1.5M – €3M", "weights": { "crit:budget:b4": 3 }, "record": "1.5m-3m" },
        { "id": "b5", "label": "€3M+", "weights": { "crit:budget:b5": 3 }, "record": "3m+" }
      ]
    }
  ]$$::jsonb,
  $${
    "kind": "development",
    "count": 3,
    "headline": "Projects that fit your brief",
    "sub": "Matched on completion horizon, location and your yield/growth profile.",
    "guideNote": "Full brochures for all three are on their way to your email.",
    "cta": { "label": "Book a 30-min orientation call", "sub": "Walk the shortlist with someone who has seen every show flat." }
  }$$::jsonb
)
ON CONFLICT (slug) DO NOTHING;
