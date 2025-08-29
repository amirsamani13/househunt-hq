-- Create a simple test to manually trigger notifications for existing matches
-- First, let's insert a test notification manually to see if that works

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

-- Check if the notification was created and if the trigger fired
SELECT COUNT(*) as total_notifications FROM public.notifications;