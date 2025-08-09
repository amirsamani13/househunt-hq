-- Clean up duplicate notifications to allow unique constraint
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY user_id, property_id ORDER BY sent_at DESC, id DESC) AS rn
  FROM public.notifications
)
DELETE FROM public.notifications n
USING ranked r
WHERE n.id = r.id
  AND r.rn > 1;

-- Add global pause flag
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS notifications_paused boolean NOT NULL DEFAULT false;

-- Add unique constraint for dedup (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uniq_notifications_user_property'
  ) THEN
    ALTER TABLE public.notifications
    ADD CONSTRAINT uniq_notifications_user_property UNIQUE (user_id, property_id);
  END IF;
END $$;

-- Trigger to deactivate older alerts when a new one is created
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

-- Unschedule existing cron jobs if they exist (prevent errors if missing)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'scrape-properties-5m') THEN
    PERFORM cron.unschedule('scrape-properties-5m');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-notifications-5m') THEN
    PERFORM cron.unschedule('send-notifications-5m');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'scrape-properties-hourly') THEN
    PERFORM cron.unschedule('scrape-properties-hourly');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-notifications-hourly') THEN
    PERFORM cron.unschedule('send-notifications-hourly');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'scrape-properties-1m') THEN
    PERFORM cron.unschedule('scrape-properties-1m');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-notifications-1m') THEN
    PERFORM cron.unschedule('send-notifications-1m');
  END IF;
END $$;

-- Schedule every-minute scraping
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

-- Schedule every-minute notifications
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