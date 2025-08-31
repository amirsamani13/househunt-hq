-- Fix the database trigger by ensuring the function and trigger are properly created
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

-- Re-activate the test property to trigger notification processing
UPDATE public.properties 
SET is_active = true, last_updated_at = now() 
WHERE external_id = 'test-property-notification-system-2';