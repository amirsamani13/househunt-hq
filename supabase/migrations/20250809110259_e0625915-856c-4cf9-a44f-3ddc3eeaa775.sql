-- Adjust schedules to every 5 minutes (300s)
-- Remove previous hourly jobs if they exist
select cron.unschedule('scrape-properties-hourly');
select cron.unschedule('send-notifications-hourly');

-- Create 5-minute scrape job at minutes 0,5,10,..
select cron.schedule(
  'scrape-properties-5m',
  '*/5 * * * *',
  $$
  select net.http_post(
    url:='https://oxdneiaojgwezxltivcl.supabase.co/functions/v1/scrape-properties',
    headers:='{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94ZG5laWFvamd3ZXp4bHRpdmNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM3MDY5ODUsImV4cCI6MjA2OTI4Mjk4NX0.8jK-YtcqCshUDP1UgYzZLg8efcqfSl5oHK2a1ghqgAI"}'::jsonb,
    body:='{"automated":true}'::jsonb
  );
  $$
);

-- Create 5-minute notification job offset by 1 minute: 1,6,11,..
select cron.schedule(
  'send-notifications-5m',
  '1-59/5 * * * *',
  $$
  select net.http_post(
    url:='https://oxdneiaojgwezxltivcl.supabase.co/functions/v1/send-notifications',
    headers:='{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94ZG5laWFvamd3ZXp4bHRpdmNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM3MDY5ODUsImV4cCI6MjA2OTI4Mjk4NX0.8jK-YtcqCshUDP1UgYzZLg8efcqfSl5oHK2a1ghqgAI"}'::jsonb,
    body:='{"automated":true}'::jsonb
  );
  $$
);