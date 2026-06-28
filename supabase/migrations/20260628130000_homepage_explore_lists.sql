-- Admin-controlled homepage "Explore" picks. The curated_lists schema is
-- single-entity-type per list, so the two homepage slots are two lists:
-- one villa (property) list + one development list. Managed via the existing
-- /admin/curation drag-rank UI. Idempotent + reversible (delete the rows).
insert into public.curated_lists (slug, title, entity_type) values
  ('homepage-explore-villas', 'Homepage Explore — Villas', 'property'),
  ('homepage-explore-developments', 'Homepage Explore — Developments', 'development')
on conflict (slug) do nothing;
