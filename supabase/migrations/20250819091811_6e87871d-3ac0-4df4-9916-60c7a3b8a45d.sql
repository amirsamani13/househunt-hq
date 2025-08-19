-- Update user_alerts table to include all new filter fields
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
CREATE INDEX IF NOT EXISTS idx_properties_location ON public.properties USING GIST (
  ll_to_earth(latitude, longitude)
) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_properties_price ON public.properties(price) WHERE price IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_properties_surface_area ON public.properties(surface_area) WHERE surface_area IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_properties_bedrooms ON public.properties(bedrooms) WHERE bedrooms IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_properties_property_type ON public.properties(property_type);
CREATE INDEX IF NOT EXISTS idx_properties_furnishing ON public.properties(furnishing);
CREATE INDEX IF NOT EXISTS idx_properties_city ON public.properties(city);
CREATE INDEX IF NOT EXISTS idx_properties_source ON public.properties(source);
CREATE INDEX IF NOT EXISTS idx_properties_active_first_seen ON public.properties(is_active, first_seen_at) WHERE is_active = true;

-- Update the notify_matching_users function to handle new criteria
CREATE OR REPLACE FUNCTION public.notify_matching_users()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  alert_record RECORD;
  distance_km numeric;
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
    -- Calculate distance if coordinates are available
    distance_km := NULL;
    IF alert_record.latitude IS NOT NULL AND alert_record.longitude IS NOT NULL 
       AND NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
      distance_km := earth_distance(
        ll_to_earth(alert_record.latitude, alert_record.longitude),
        ll_to_earth(NEW.latitude, NEW.longitude)
      ) / 1000; -- Convert to kilometers
    END IF;

    -- Check if property matches the alert criteria
    IF (
      -- City match (if no coordinates or within radius)
      (alert_record.cities IS NULL OR NEW.city = ANY(alert_record.cities) OR 
       (distance_km IS NOT NULL AND distance_km <= COALESCE(alert_record.location_radius, 5))) AND
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
        
        -- Call notification function immediately using pg_net
        PERFORM net.http_post(
          url := 'https://oxdneiaojgwezxltivcl.supabase.co/functions/v1/send-notifications',
          headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94ZG5laWFvamd3ZXp4bHRpdmNsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzcwNjk4NSwiZXhwIjoyMDY5MjgyOTg1fQ.WnvHGDQ-xJfT9eo51EbLmPfUqPNMPglLhkPWN7lWsOA"}'::jsonb,
          body := format('{"propertyId": "%s", "alertId": "%s", "userId": "%s", "immediate": true}', NEW.id, alert_record.id, alert_record.user_id)::jsonb
        );
        
      END IF;
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$function$;

-- Enable earth_distance extension for location calculations
CREATE EXTENSION IF NOT EXISTS earthdistance CASCADE;