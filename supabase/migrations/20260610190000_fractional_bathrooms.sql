-- Live-sandbox smoke finding (2026-06-10): MLS rows carry fractional
-- bathroom counts ("2.5"), which crashed integer columns and killed
-- whole insert batches. Bathrooms are genuinely fractional in real
-- estate data → numeric. Bedrooms stay integer (fractional values are
-- feed noise; the mapper rounds them defensively).
ALTER TABLE properties   ALTER COLUMN bathrooms      TYPE numeric USING bathrooms::numeric;
ALTER TABLE developments ALTER COLUMN bathrooms_from TYPE numeric USING bathrooms_from::numeric;
ALTER TABLE developments ALTER COLUMN bathrooms_to   TYPE numeric USING bathrooms_to::numeric;
NOTIFY pgrst, 'reload schema';
