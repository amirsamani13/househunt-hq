-- Test the notification system by updating existing recent properties to trigger notifications
-- This will simulate new properties and test the trigger

-- Update 3 recent properties to trigger the notification system
UPDATE public.properties 
SET is_active = true, last_updated_at = NOW()
WHERE id IN (
  SELECT id 
  FROM public.properties 
  WHERE is_active = true 
  AND first_seen_at > NOW() - INTERVAL '2 days'
  ORDER BY first_seen_at DESC 
  LIMIT 3
);

-- Check if notifications were created
SELECT COUNT(*) as notification_count FROM public.notifications;