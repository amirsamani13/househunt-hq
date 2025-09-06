-- Clear all pending admin alerts to stop email spam
UPDATE public.qa_admin_alerts 
SET status = 'resolved', resolved_at = now() 
WHERE status = 'pending';

-- Fix Database Constraint Issue
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

-- Add QA system configuration table for circuit breaker
CREATE TABLE IF NOT EXISTS public.qa_system_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text UNIQUE NOT NULL,
  setting_value jsonb NOT NULL,
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on qa_system_config
ALTER TABLE public.qa_system_config ENABLE ROW LEVEL SECURITY;

-- Policy for service to manage QA system config
CREATE POLICY "Service can manage QA system config" 
ON public.qa_system_config 
FOR ALL 
USING (true);

-- Initialize circuit breaker settings
INSERT INTO public.qa_system_config (setting_key, setting_value) VALUES
('circuit_breaker', '{"consecutive_failures": 0, "last_failure": null, "paused_until": null, "max_failures": 3, "pause_duration_minutes": 60}'),
('alert_consolidation', '{"last_digest_sent": null, "failures_since_digest": 0, "digest_interval_minutes": 30}')
ON CONFLICT (setting_key) DO NOTHING;