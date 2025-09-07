-- Set up controlled QA cron job (every 15 minutes instead of 5 to reduce load)
SELECT cron.schedule(
  'qa-continuous-agent-controlled',
  '*/15 * * * *',
  $$
  SELECT
    net.http_post(
        url:='https://oxdneiaojgwezxltivcl.supabase.co/functions/v1/qa-continuous-agent',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94ZG5laWFvamd3ZXp4bHRpdmNsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzcwNjk4NSwiZXhwIjoyMDY5MjgyOTg1fQ.k0cjr9bkl6wpYOp3uGkzgtNKdXHepUE8_Euf5QOTGYk"}'::jsonb,
        body:='{"controlled_run": true}'::jsonb
    ) as request_id;
  $$
);