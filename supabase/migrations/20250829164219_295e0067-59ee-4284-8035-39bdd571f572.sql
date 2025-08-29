-- Test inserting a notification manually to verify the trigger works
INSERT INTO public.notifications (
  user_id, 
  property_id, 
  alert_id, 
  message,
  delivery_status
) VALUES (
  'b7502c31-6566-417a-bd31-44d7790f6260',
  '7b376815-3f07-4931-a73f-0686655044c4',
  '8ca7015d-66f4-4e65-b3e0-619003afd63e',
  'Test notification - Room at Warmoesstraat - €571',
  'pending'
);

-- Check notifications count
SELECT COUNT(*) as notification_count FROM public.notifications;

-- Check if the log was created
SELECT source, status, error_message, started_at FROM public.scraping_logs 
WHERE source = 'notification_system' 
ORDER BY started_at DESC LIMIT 2;