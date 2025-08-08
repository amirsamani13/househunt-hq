-- Enable required extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule property scraping every hour
SELECT cron.schedule(
  'scrape-properties-hourly',
  '0 * * * *', -- Every hour at minute 0
  $$
  SELECT
    net.http_post(
        url:='https://oxdneiaojgwezxltivcl.supabase.co/functions/v1/scrape-properties',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94ZG5laWFvamd3ZXp4bHRpdmNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM3MDY5ODUsImV4cCI6MjA2OTI4Mjk4NX0.8jK-YtcqCshUDP1UgYzZLg8efcqfSl5oHK2a1ghqgAI"}'::jsonb,
        body:='{"automated": true}'::jsonb
    ) as request_id;
  $$
);

-- Schedule notifications 5 minutes after each scrape
SELECT cron.schedule(
  'send-notifications-hourly',
  '5 * * * *', -- Every hour at minute 5 (5 minutes after scraping)
  $$
  SELECT
    net.http_post(
        url:='https://oxdneiaojgwezxltivcl.supabase.co/functions/v1/send-notifications',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94ZG5laWFvamd3ZXp4bHRpdmNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM3MDY5ODUsImV4cCI6MjA2OTI4Mjk4NX0.8jK-YtcqCshUDP1UgYzZLg8efcqfSl5oHK2a1ghqgAI"}'::jsonb,
        body:='{"automated": true}'::jsonb
    ) as request_id;
  $$
);