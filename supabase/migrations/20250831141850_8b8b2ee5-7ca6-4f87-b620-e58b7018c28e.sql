-- Update the test property to be active again to trigger the notification
UPDATE public.properties 
SET is_active = true, last_updated_at = now() 
WHERE external_id = 'test-property-notification-system-2';