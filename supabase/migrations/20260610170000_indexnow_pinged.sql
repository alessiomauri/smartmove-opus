-- IndexNow observability: how many changed URLs each sync run submitted.
ALTER TABLE resales_sync_runs ADD COLUMN IF NOT EXISTS indexnow_pinged int DEFAULT 0;
NOTIFY pgrst, 'reload schema';
