-- Update user_alerts table to include all new filter fields (without location functions for now)
ALTER TABLE public.user_alerts 
ADD COLUMN IF NOT EXISTS min_surface_area numeric,
ADD COLUMN IF NOT EXISTS property_types text[] DEFAULT ARRAY['apartment', 'house', 'studio', 'room'],
ADD COLUMN IF NOT EXISTS furnishing text[] DEFAULT ARRAY['unfurnished', 'semi-furnished', 'furnished'],
ADD COLUMN IF NOT EXISTS location_radius numeric DEFAULT 5,
ADD COLUMN IF NOT EXISTS latitude numeric,
ADD COLUMN IF NOT EXISTS longitude numeric,
ADD COLUMN IF NOT EXISTS notification_methods text[] DEFAULT ARRAY['email'];

-- Update properties table to include furnishing and coordinates
ALTER TABLE public.properties
ADD COLUMN IF NOT EXISTS furnishing text,
ADD COLUMN IF NOT EXISTS latitude numeric,
ADD COLUMN IF NOT EXISTS longitude numeric;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_properties_price ON public.properties(price) WHERE price IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_properties_surface_area ON public.properties(surface_area) WHERE surface_area IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_properties_bedrooms ON public.properties(bedrooms) WHERE bedrooms IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_properties_property_type ON public.properties(property_type);
CREATE INDEX IF NOT EXISTS idx_properties_furnishing ON public.properties(furnishing);
CREATE INDEX IF NOT EXISTS idx_properties_city ON public.properties(city);
CREATE INDEX IF NOT EXISTS idx_properties_source ON public.properties(source);
CREATE INDEX IF NOT EXISTS idx_properties_active_first_seen ON public.properties(is_active, first_seen_at) WHERE is_active = true;

-- Update the notify_matching_users function to handle new criteria (without location for now)
CREATE OR REPLACE FUNCTION public.notify_matching_users()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  alert_record RECORD;
  notification_message TEXT;
BEGIN
  -- Only process active properties
  IF NEW.is_active = false THEN
    RETURN NEW;
  END IF;

  -- Loop through all active alerts
  FOR alert_record IN 
    SELECT ua.*, p.email, p.phone, p.notifications_paused
    FROM public.user_alerts ua
    JOIN public.profiles p ON ua.user_id = p.user_id
    WHERE ua.is_active = true 
    AND p.notifications_paused = false
  LOOP
    -- Check if property matches the alert criteria
    IF (
      -- City match
      (alert_record.cities IS NULL OR NEW.city = ANY(alert_record.cities)) AND
      -- Source match  
      (alert_record.sources IS NULL OR NEW.source = ANY(alert_record.sources)) AND
      -- Price match
      (alert_record.min_price IS NULL OR NEW.price >= alert_record.min_price) AND
      (alert_record.max_price IS NULL OR NEW.price <= alert_record.max_price) AND
      -- Bedrooms match
      (alert_record.min_bedrooms IS NULL OR NEW.bedrooms >= alert_record.min_bedrooms) AND
      (alert_record.max_bedrooms IS NULL OR NEW.bedrooms <= alert_record.max_bedrooms) AND
      -- Surface area match
      (alert_record.min_surface_area IS NULL OR NEW.surface_area >= alert_record.min_surface_area) AND
      -- Property type match
      (alert_record.property_types IS NULL OR NEW.property_type = ANY(alert_record.property_types)) AND
      -- Furnishing match
      (alert_record.furnishing IS NULL OR NEW.furnishing = ANY(alert_record.furnishing))
    ) THEN
      
      -- Check if notification already exists for this property and user
      IF NOT EXISTS (
        SELECT 1 FROM public.notifications 
        WHERE user_id = alert_record.user_id 
        AND property_id = NEW.id
      ) THEN
        
        -- Create notification message
        notification_message := format(
          'New property alert: %s - €%s - %s m² - %s bedrooms in %s. View: %s',
          NEW.title,
          NEW.price,
          COALESCE(NEW.surface_area::text, 'N/A'),
          COALESCE(NEW.bedrooms::text, 'N/A'),
          NEW.city,
          NEW.url
        );
        
        -- Insert notification record
        INSERT INTO public.notifications (
          user_id,
          property_id, 
          alert_id,
          message,
          delivery_status
        ) VALUES (
          alert_record.user_id,
          NEW.id,
          alert_record.id,
          notification_message,
          'pending'
        );
        
      END IF;
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$function$;