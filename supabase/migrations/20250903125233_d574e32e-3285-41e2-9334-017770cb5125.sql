-- Create QA system tables for continuous quality control

-- Track each QA test run cycle
CREATE TABLE public.qa_test_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'running', -- running, completed, failed
  total_tests INTEGER DEFAULT 0,
  passed_tests INTEGER DEFAULT 0,
  failed_tests INTEGER DEFAULT 0,
  error_message TEXT,
  test_user_id UUID,
  test_property_id UUID
);

-- Store individual test results
CREATE TABLE public.qa_test_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  test_run_id UUID NOT NULL REFERENCES public.qa_test_runs(id) ON DELETE CASCADE,
  test_name TEXT NOT NULL, -- 'user_registration', 'alert_creation', 'notification_trigger', 'email_quality', 'scraper_health'
  test_target TEXT, -- specific scraper name or 'general' for overall tests
  status TEXT NOT NULL, -- 'passed', 'failed', 'skipped'
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  test_data JSONB, -- store test-specific data like user info, property info, etc.
  quality_score INTEGER, -- 0-100 for quality tests
  response_time_ms INTEGER
);

-- Track admin alerts for failed repairs
CREATE TABLE public.qa_admin_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_type TEXT NOT NULL, -- 'scraper_repair_failed', 'notification_system_failed', 'critical_failure'
  severity TEXT NOT NULL DEFAULT 'warning', -- 'warning', 'critical', 'emergency'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  details JSONB, -- error logs, context data
  test_run_id UUID REFERENCES public.qa_test_runs(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  sent_at TIMESTAMP WITH TIME ZONE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'pending' -- 'pending', 'sent', 'resolved'
);

-- Track test users for cleanup
CREATE TABLE public.qa_test_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  test_run_id UUID REFERENCES public.qa_test_runs(id),
  cleaned_up_at TIMESTAMP WITH TIME ZONE,
  cleanup_attempts INTEGER DEFAULT 0
);

-- Add QA-related columns to existing scraper_health table
ALTER TABLE public.scraper_health 
ADD COLUMN IF NOT EXISTS repair_attempt_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_admin_alert TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_qa_check TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS qa_failure_count INTEGER DEFAULT 0;

-- Add quality tracking to notifications table
ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS quality_score INTEGER,
ADD COLUMN IF NOT EXISTS quality_issues JSONB,
ADD COLUMN IF NOT EXISTS qa_validated_at TIMESTAMP WITH TIME ZONE;

-- Enable RLS on new tables
ALTER TABLE public.qa_test_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qa_test_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qa_admin_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qa_test_users ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for service access
CREATE POLICY "Service can manage QA test runs" 
ON public.qa_test_runs FOR ALL USING (true);

CREATE POLICY "Service can manage QA test results" 
ON public.qa_test_results FOR ALL USING (true);

CREATE POLICY "Service can manage QA admin alerts" 
ON public.qa_admin_alerts FOR ALL USING (true);

CREATE POLICY "Service can manage QA test users" 
ON public.qa_test_users FOR ALL USING (true);

-- Create indexes for performance
CREATE INDEX idx_qa_test_runs_started_at ON public.qa_test_runs(started_at);
CREATE INDEX idx_qa_test_runs_status ON public.qa_test_runs(status);
CREATE INDEX idx_qa_test_results_test_run_id ON public.qa_test_results(test_run_id);
CREATE INDEX idx_qa_test_results_test_name ON public.qa_test_results(test_name);
CREATE INDEX idx_qa_admin_alerts_status ON public.qa_admin_alerts(status);
CREATE INDEX idx_qa_admin_alerts_created_at ON public.qa_admin_alerts(created_at);
CREATE INDEX idx_qa_test_users_user_id ON public.qa_test_users(user_id);
CREATE INDEX idx_qa_test_users_cleaned_up_at ON public.qa_test_users(cleaned_up_at);

-- Create function to auto-cleanup old QA data
CREATE OR REPLACE FUNCTION public.cleanup_old_qa_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete test runs older than 30 days
  DELETE FROM public.qa_test_runs 
  WHERE started_at < now() - interval '30 days';
  
  -- Delete resolved admin alerts older than 7 days
  DELETE FROM public.qa_admin_alerts 
  WHERE resolved_at IS NOT NULL 
  AND resolved_at < now() - interval '7 days';
  
  -- Delete cleaned up test users older than 24 hours
  DELETE FROM public.qa_test_users 
  WHERE cleaned_up_at IS NOT NULL 
  AND cleaned_up_at < now() - interval '24 hours';
END;
$$;