-- Fix properties table constraint to allow test data
ALTER TABLE properties DROP CONSTRAINT IF EXISTS properties_source_check;
ALTER TABLE properties ADD CONSTRAINT properties_source_check 
  CHECK (source IN ('pararius', 'kamernet', 'grunoverhuur', 'qa_test'));

-- Fix scraping_logs table constraint to allow test data
ALTER TABLE scraping_logs DROP CONSTRAINT IF EXISTS scraping_logs_status_check;
ALTER TABLE scraping_logs ADD CONSTRAINT scraping_logs_status_check 
  CHECK (status IN ('success', 'failed', 'running', 'timeout', 'error'));

-- Reset scraper health to get them out of permanent repair mode
UPDATE scraper_health 
SET 
  is_in_repair_mode = false,
  repair_attempt_count = 0,
  consecutive_failures = 0,
  qa_failure_count = 0,
  last_repair_attempt = NULL,
  repair_status = 'healthy'
WHERE is_in_repair_mode = true;

-- Add cron job for daily summary (runs at 8 AM every day)
SELECT cron.schedule(
  'daily-qa-summary',
  '0 8 * * *',
  $$
  SELECT
    net.http_post(
        url:='https://oxdneiaojgwezxltivcl.supabase.co/functions/v1/qa-daily-summary',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94ZG5laWFvamd3ZXp4bHRpdmNsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzcwNjk4NSwiZXhwIjoyMDY5MjgyOTg1fQ.k0cjr9bkl6wpYOp3uGkzgtNKdXHepUE8_Euf5QOTGYk"}'::jsonb,
        body:='{"daily_summary": true}'::jsonb
    ) as request_id;
  $$
);

-- Remove the frequent qa-admin-alerts cron job to stop spam
SELECT cron.unschedule('qa-admin-alerts');