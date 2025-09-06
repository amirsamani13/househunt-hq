-- Phase 1: Emergency Stop - Disable QA cron jobs temporarily and clear alerts
-- Remove existing cron jobs to stop the spam
SELECT cron.unschedule('qa-continuous-agent');
SELECT cron.unschedule('ai-system-monitor');

-- Clear all pending admin alerts to stop email spam
UPDATE public.qa_admin_alerts 
SET status = 'resolved', resolved_at = now() 
WHERE status = 'pending';

-- Phase 2: Fix Database Constraint Issue
-- Drop and recreate the properties source constraint with explicit qa_test support
ALTER TABLE public.properties DROP CONSTRAINT IF EXISTS properties_source_check;

-- Recreate constraint with explicit qa_test validation
ALTER TABLE public.properties 
ADD CONSTRAINT properties_source_check 
CHECK (source IN ('pararius', 'kamernet', 'grunoverhuur', 'qa_test', 'notification_system'));

-- Test constraint by inserting and immediately deleting a test record
INSERT INTO public.properties (
  external_id, source, title, url, city, price, is_active
) VALUES (
  'constraint-test-' || extract(epoch from now()), 
  'qa_test', 
  'Constraint Test Property', 
  'https://test.example.com', 
  'Test City', 
  1000, 
  false
);

-- Clean up the test record
DELETE FROM public.properties WHERE external_id LIKE 'constraint-test-%';