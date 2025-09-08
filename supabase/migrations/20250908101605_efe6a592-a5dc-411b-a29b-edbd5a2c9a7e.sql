-- Clean up test data that's clogging the notification system
-- Delete test notifications first (foreign key dependencies)
DELETE FROM public.notifications 
WHERE user_id IN (
  SELECT user_id FROM public.profiles 
  WHERE email LIKE '%@test.com' OR email LIKE 'qa-%'
);

-- Delete test user alerts
DELETE FROM public.user_alerts 
WHERE user_id IN (
  SELECT user_id FROM public.profiles 
  WHERE email LIKE '%@test.com' OR email LIKE 'qa-%'
);

-- Delete test users from QA tables
DELETE FROM public.qa_test_users;

-- Delete test profiles (this will cascade to auth.users via the trigger)
DELETE FROM public.profiles 
WHERE email LIKE '%@test.com' OR email LIKE 'qa-%';

-- Reset notification system stats
INSERT INTO public.scraping_logs (
  source,
  status, 
  properties_found,
  started_at,
  completed_at,
  error_message
) VALUES (
  'notification_cleanup',
  'success',
  0,
  now(),
  now(),
  'Cleaned up test data - removed test users, alerts, and notifications'
);