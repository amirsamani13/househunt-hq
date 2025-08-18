-- Clean up all duplicate cron jobs
SELECT cron.unschedule('scrape-properties-1m');
SELECT cron.unschedule('send-notifications-1m');

-- Verify our main jobs are still running
SELECT jobname, schedule FROM cron.job WHERE jobname IN ('continuous-property-scraping', 'auto-repair-broken-scrapers');