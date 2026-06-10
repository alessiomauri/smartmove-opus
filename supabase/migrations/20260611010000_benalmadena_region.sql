-- Benalmádena becomes the 45th curated area (Alessio, 11 Jun): its own
-- region (per-town pattern like Fuengirola/Torremolinos), displayed in
-- the "Mijas & East" cluster. The area row itself is data (inserted
-- unpublished by ops); only the enum needs schema.
ALTER TYPE area_region ADD VALUE IF NOT EXISTS 'Benalmadena';
