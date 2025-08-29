-- Enable required extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create a trigger function that calls the send-notifications edge function when new properties are added
CREATE OR REPLACE FUNCTION public.trigger_property_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only trigger for new active properties
  IF NEW.is_active = true AND (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.is_active = false)) THEN
    -- Call the send-notifications edge function asynchronously
    PERFORM net.http_post(
      url := 'https://oxdneiaojgwezxltivcl.supabase.co/functions/v1/send-notifications',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94ZG5laWFvamd3ZXp4bHRpdmNsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzcwNjk4NSwiZXhwIjoyMDY5MjgyOTg1fQ.k0cjr9bkl6wpYOp3uGkzgtNKdXHepUE8_Euf5QOTGYk"}'::jsonb,
      body := '{"windowHours": 24}'::jsonb
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create the trigger on properties table
DROP TRIGGER IF EXISTS trigger_property_notifications_on_insert ON public.properties;
CREATE TRIGGER trigger_property_notifications_on_insert
  AFTER INSERT OR UPDATE ON public.properties
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_property_notifications();

-- Schedule the send-notifications function to run every 5 minutes
SELECT cron.schedule(
  'send-property-notifications',
  '*/5 * * * *', -- every 5 minutes
  $$
  SELECT net.http_post(
    url := 'https://oxdneiaojgwezxltivcl.supabase.co/functions/v1/send-notifications',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94ZG5laWFvamd3ZXp4bHRpdmNsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzcwNjk4NSwiZXhwIjoyMDY5MjgyOTg1fQ.k0cjr9bkl6wpYOp3uGkzgtNKdXHepUE8_Euf5QOTGYk"}'::jsonb,
    body := '{"windowHours": 6}'::jsonb
  ) as request_id;
  $$
);

-- Remove the old notify_matching_users trigger since we're replacing it with the edge function approach
DROP TRIGGER IF EXISTS notify_matching_users_trigger ON public.properties;

-- Clean up test data
DELETE FROM public.notifications WHERE message LIKE 'Test notification%';