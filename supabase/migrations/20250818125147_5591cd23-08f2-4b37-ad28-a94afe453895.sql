-- Fix security warnings from the linter

-- 1. Fix function search path for notify_matching_users function
CREATE OR REPLACE FUNCTION public.notify_matching_users()
RETURNS TRIGGER AS $$
DECLARE
  alert_record RECORD;
  user_profile RECORD;
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
      (alert_record.max_bedrooms IS NULL OR NEW.bedrooms <= alert_record.max_bedrooms)
    ) THEN
      
      -- Check if notification already exists for this property and user
      IF NOT EXISTS (
        SELECT 1 FROM public.notifications 
        WHERE user_id = alert_record.user_id 
        AND property_id = NEW.id
      ) THEN
        
        -- Create notification message
        notification_message := format(
          'New property alert: %s - €%s - %s bedrooms in %s. View: %s',
          NEW.title,
          NEW.price,
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;