-- Fix all scraper issues immediately

-- 1. First, remove all existing cron jobs to clean slate
SELECT cron.unschedule('continuous-property-scraping');
SELECT cron.unschedule('auto-repair-broken-scrapers');

-- 2. Create single, non-conflicting cron jobs
SELECT cron.schedule(
  'continuous-property-scraping',
  '*/5 * * * *', -- Every 5 minutes
  $$
  SELECT net.http_post(
    url := 'https://oxdneiaojgwezxltivcl.supabase.co/functions/v1/scrape-properties',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94ZG5laWFvamd3ZXp4bHRpdmNsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzcwNjk4NSwiZXhwIjoyMDY5MjgyOTg1fQ.WnvHGDQ-xJfT9eo51EbLmPfUqPNMPglLhkPWN7lWsOA"}'::jsonb,
    body := '{"source": "all"}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'auto-repair-broken-scrapers',
  '*/30 * * * *', -- Every 30 minutes
  $$
  SELECT net.http_post(
    url := 'https://oxdneiaojgwezxltivcl.supabase.co/functions/v1/auto-repair-scraper',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94ZG5laWFvamd3ZXp4bHRpdmNsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzcwNjk4NSwiZXhwIjoyMDY5MjgyOTg1fQ.WnvHGDQ-xJfT9eo51EbLmPfUqPNMPglLhkPWN7lWsOA"}'::jsonb,
    body := '{"action": "repair_all"}'::jsonb
  );
  $$
);

-- 3. Update scraper_health table with correct configurations for working scrapers
INSERT INTO public.scraper_health (source, current_url, current_selectors, is_in_repair_mode, consecutive_failures, repair_attempts) 
VALUES 
  ('kamernet', 'https://kamernet.nl/huren/kamer-groningen', '{"container": ".tile-container, .accommodation-search-result", "link": "a[href*=\"/huren/kamer-\"]", "title": ".tile-title, h2.accommodation-title, .accommodation-search-result h3", "price": ".tile-price, .price, .accommodation-price"}', false, 0, 0),
  ('pararius', 'https://www.pararius.com/apartments/groningen', null, false, 0, 0),
  ('grunoverhuur', 'https://www.grunoverhuur.nl/aanbod/huren', null, false, 0, 0)
ON CONFLICT (source) DO UPDATE SET
  current_url = EXCLUDED.current_url,
  current_selectors = EXCLUDED.current_selectors,
  is_in_repair_mode = EXCLUDED.is_in_repair_mode,
  consecutive_failures = EXCLUDED.consecutive_failures,
  repair_attempts = EXCLUDED.repair_attempts,
  updated_at = now();

-- 4. Reset failed scraper health status
UPDATE public.scraper_health 
SET is_in_repair_mode = true, 
    consecutive_failures = 5,
    repair_attempts = 0,
    updated_at = now()
WHERE source IN ('funda', 'rotsvast', 'campusgroningen', 'studenthousing', 'housinganywhere', 'vandermeulen', 'roomspot', 'rentberry');