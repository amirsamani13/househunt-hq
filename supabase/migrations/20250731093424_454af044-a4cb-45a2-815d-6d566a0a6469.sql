-- Test the triggers by inserting a test user (we'll delete it after)
-- This will help us verify the triggers are working
INSERT INTO auth.users (
  id, 
  email, 
  raw_user_meta_data, 
  created_at, 
  updated_at,
  aud,
  role
) VALUES (
  gen_random_uuid(),
  'test-trigger@example.com',
  '{"full_name": "Test User"}',
  now(),
  now(),
  'authenticated',
  'authenticated'
);