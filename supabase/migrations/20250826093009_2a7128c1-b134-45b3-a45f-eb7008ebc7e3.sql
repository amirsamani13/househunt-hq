-- Phase 1: Fix Database Triggers - Create the missing trigger
CREATE TRIGGER properties_notify_users
    AFTER INSERT OR UPDATE ON public.properties
    FOR EACH ROW
    WHEN (NEW.is_active = true)
    EXECUTE FUNCTION public.notify_matching_users();

-- Phase 3: Clean Database - Remove malformed properties
DELETE FROM public.properties 
WHERE title LIKE '%Unknown%' 
   OR title LIKE '%Apartment at%' 
   OR title LIKE 'Kamer %'
   OR external_id LIKE '%kamer-%';

-- Add URL validation function
CREATE OR REPLACE FUNCTION public.validate_property_url()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Mark properties as inactive if URL patterns suggest they might be broken
  IF NEW.url ~ '.*/(kamer-[0-9]+|appartement-[0-9]+)$' 
     AND NEW.title ~ '^(Kamer|Apartment at Unknown)' THEN
    NEW.is_active = false;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger for URL validation
CREATE TRIGGER validate_property_url_trigger
    BEFORE INSERT OR UPDATE ON public.properties
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_property_url();