-- Fix database triggers to ensure notifications work properly

-- First, drop existing trigger if it exists
DROP TRIGGER IF EXISTS notify_matching_users_trigger ON public.properties;

-- Create the trigger to fire AFTER INSERT OR UPDATE when is_active is true
CREATE TRIGGER notify_matching_users_trigger
  AFTER INSERT OR UPDATE OF is_active, price, city, bedrooms, surface_area, property_type, furnishing
  ON public.properties
  FOR EACH ROW
  WHEN (NEW.is_active = true)
  EXECUTE FUNCTION public.notify_matching_users();

-- Clean up any malformed properties from previous runs
UPDATE public.properties 
SET is_active = false 
WHERE title ~ '^(Kamer|Apartment at Unknown|Property Listing)$' 
   OR address ~ 'Unknown'
   OR url ~ '.*/(kamer-[0-9]+|appartement-[0-9]+)$';

-- Add logging to track when notifications are created
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
    'notification_created',
    1,
    now(),
    now(),
    format('Notification created for user %s, property %s, alert %s', NEW.user_id, NEW.property_id, NEW.alert_id)
  );
  
  RETURN NEW;
END;
$function$;

-- Create trigger to log notification creation
DROP TRIGGER IF EXISTS log_notification_creation_trigger ON public.notifications;
CREATE TRIGGER log_notification_creation_trigger
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.log_notification_creation();