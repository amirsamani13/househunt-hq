-- Fix the scraping_logs status constraint to allow notification logging
-- First, check what values are currently allowed
SELECT conname, pg_get_constraintdef(oid) as definition 
FROM pg_constraint 
WHERE conrelid = 'public.scraping_logs'::regclass 
AND contype = 'c';

-- Drop the existing check constraint and create a new one that includes notification statuses
ALTER TABLE public.scraping_logs DROP CONSTRAINT IF EXISTS scraping_logs_status_check;
ALTER TABLE public.scraping_logs ADD CONSTRAINT scraping_logs_status_check 
  CHECK (status IN ('started', 'success', 'error', 'failed', 'notification_created', 'notification_sent'));

-- Also update the log_notification_creation function to use a valid status
CREATE OR REPLACE FUNCTION public.log_notification_creation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Log notification creation for debugging
  INSERT INTO public.scraping_logs (
    source,
    status,
    properties_found,
    started_at,
    completed_at,
    error_message
  ) VALUES (
    'notification_system',
    'success',  -- Use 'success' instead of 'notification_created'
    1,
    now(),
    now(),
    format('Notification created for user %s, property %s, alert %s', NEW.user_id, NEW.property_id, NEW.alert_id)
  );
  
  RETURN NEW;
END;
$function$;