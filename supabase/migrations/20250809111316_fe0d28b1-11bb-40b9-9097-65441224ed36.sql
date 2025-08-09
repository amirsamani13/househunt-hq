-- Add a global pause flag for notifications per user
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS notifications_paused boolean NOT NULL DEFAULT false;

-- Enforce deduplication of notifications per user/property
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uniq_notifications_user_property'
  ) THEN
    ALTER TABLE public.notifications
    ADD CONSTRAINT uniq_notifications_user_property UNIQUE (user_id, property_id);
  END IF;
END $$;

-- When a new alert is created, deactivate all previous alerts for that user
CREATE OR REPLACE FUNCTION public.deactivate_existing_alerts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  UPDATE public.user_alerts
  SET is_active = false,
      updated_at = now()
  WHERE user_id = NEW.user_id
    AND id <> NEW.id
    AND is_active = true;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_deactivate_existing_alerts ON public.user_alerts;
CREATE TRIGGER trg_deactivate_existing_alerts
AFTER INSERT ON public.user_alerts
FOR EACH ROW
EXECUTE FUNCTION public.deactivate_existing_alerts();

-- Switch cron to run every minute for near-real-time behavior
-- Unschedule older jobs if present
SELECT cron.unschedule('scrape-properties-5m');
SELECT cron.unschedule('send-notifications-5m');
SELECT cron.unschedule('scrape-properties-hourly');
SELECT cron.unschedule('send-notifications-hourly');

-- Schedule scraping every minute
SELECT cron.schedule(
  'scrape-properties-1m',
  '* * * * *',
  $$
  SELECT net.http_post(
    url:='https://oxdneiaojgwezxltivcl.supabase.co/functions/v1/scrape-properties',
    headers:='{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94ZG5laWFvamd3ZXp4bHRpdmNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM3MDY5ODUsImV4cCI6MjA2OTI4Mjk4NX0.8jK-YtcqCshUDP1UgYzZLg8efcqfSl5oHK2a1ghqgAI"}'::jsonb,
    body:='{"automated":true}'::jsonb
  );
  $$
);

-- Schedule notifications every minute as well
SELECT cron.schedule(
  'send-notifications-1m',
  '* * * * *',
  $$
  SELECT net.http_post(
    url:='https://oxdneiaojgwezxltivcl.supabase.co/functions/v1/send-notifications',
    headers:='{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94ZG5laWFvamd3ZXp4bHRpdmNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM3MDY5ODUsImV4cCI6MjA2OTI4Mjk4NX0.8jK-YtcqCshUDP1UgYzZLg8efcqfSl5oHK2a1ghqgAI"}'::jsonb,
    body:='{"automated":true}'::jsonb
  );
  $$
);