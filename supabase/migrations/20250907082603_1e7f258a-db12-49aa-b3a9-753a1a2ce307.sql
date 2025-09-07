-- Disable QA admin email notifications by pausing the cron job and updating alert statuses
-- Unschedule the QA continuous agent to stop triggering new alerts
SELECT cron.unschedule('qa-continuous-agent-controlled');

-- Mark all pending admin alerts as resolved to stop email queue processing
UPDATE public.qa_admin_alerts 
SET status = 'resolved', resolved_at = now() 
WHERE status = 'pending';

-- Add a system pause flag to prevent new admin alerts from being sent
INSERT INTO public.qa_system_config (setting_key, setting_value) VALUES
('admin_alerts_paused', '{"paused": true, "paused_at": "' || now() || '", "reason": "User requested to stop admin emails"}')
ON CONFLICT (setting_key) DO UPDATE SET
setting_value = '{"paused": true, "paused_at": "' || now() || '", "reason": "User requested to stop admin emails"}',
updated_at = now();