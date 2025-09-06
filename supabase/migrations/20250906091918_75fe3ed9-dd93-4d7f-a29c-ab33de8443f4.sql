-- Set up cron job for AI system monitor (every 5 minutes)
SELECT cron.schedule(
  'ai-system-monitor',
  '*/5 * * * *',
  $$
  SELECT
    net.http_post(
        url:='https://oxdneiaojgwezxltivcl.supabase.co/functions/v1/ai-system-monitor',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94ZG5laWFvamd3ZXp4bHRpdmNsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzcwNjk4NSwiZXhwIjoyMDY5MjgyOTg1fQ.k0cjr9bkl6wpYOp3uGkzgtNKdXHepUE8_Euf5QOTGYk"}'::jsonb,
        body:='{"monitor_check": true}'::jsonb
    ) as request_id;
  $$
);