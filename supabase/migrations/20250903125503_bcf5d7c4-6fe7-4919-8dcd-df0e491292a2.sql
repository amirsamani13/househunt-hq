-- Add cron job for QA Continuous Agent (every 5 minutes)
SELECT cron.schedule(
  'qa-continuous-agent-5min',
  '*/5 * * * *', -- Every 5 minutes
  $$
  SELECT
    net.http_post(
        url:='https://oxdneiaojgwezxltivcl.supabase.co/functions/v1/qa-continuous-agent',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94ZG5laWFvamd3ZXp4bHRpdmNsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzcwNjk4NSwiZXhwIjoyMDY5MjgyOTg1fQ.k0cjr9bkl6wpYOp3uGkzgtNKdXHepUE8_Euf5QOTGYk"}'::jsonb,
        body:='{"triggered_by": "cron"}'::jsonb
    ) as request_id;
  $$
);

-- Add cron job for admin alerts (every 10 minutes)
SELECT cron.schedule(
  'qa-admin-alerts-10min',
  '*/10 * * * *', -- Every 10 minutes
  $$
  SELECT
    net.http_post(
        url:='https://oxdneiaojgwezxltivcl.supabase.co/functions/v1/qa-admin-alerts',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94ZG5laWFvamd3ZXp4bHRpdmNsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzcwNjk4NSwiZXhwIjoyMDY5MjgyOTg1fQ.k0cjr9bkl6wpYOp3uGkzgtNKdXHepUE8_Euf5QOTGYk"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);

-- Add cron job for QA data cleanup (daily at 2 AM)
SELECT cron.schedule(
  'qa-cleanup-daily',
  '0 2 * * *', -- Daily at 2 AM
  $$
  SELECT public.cleanup_old_qa_data();
  $$
);