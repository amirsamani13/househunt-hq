-- Remove all user data and associated records
-- Delete in order to handle foreign key constraints

-- Delete notifications first (references user_id and property_id)
DELETE FROM public.notifications;

-- Delete user alerts (references user_id)
DELETE FROM public.user_alerts;

-- Delete subscribers (references user_id)
DELETE FROM public.subscribers;

-- Delete profiles (references user_id from auth.users)
DELETE FROM public.profiles;

-- Delete QA test users
DELETE FROM public.qa_test_users;

-- Delete users from auth.users table (this will cascade to any remaining references)
DELETE FROM auth.users;