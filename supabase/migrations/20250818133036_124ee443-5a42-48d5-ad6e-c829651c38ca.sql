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
INSERT INTO public.scraper_health (source, url, link_pattern, needs_repair, health_status, custom_selectors) 
VALUES 
  ('kamernet', 'https://kamernet.nl/huren/kamer-groningen', 'kamernet\.nl/huren/kamer-[^/]+/[0-9]+', false, 'healthy', '{"container": ".tile-container, .accommodation-search-result", "link": "a[href*=\"/huren/kamer-\"]", "title": ".tile-title, h2.accommodation-title, .accommodation-search-result h3", "price": ".tile-price, .price, .accommodation-price"}'),
  ('pararius', 'https://www.pararius.com/apartments/groningen', 'pararius\.com/apartment-for-rent/[^/]+/[0-9a-f-]+', false, 'healthy', null),
  ('grunoverhuur', 'https://www.grunoverhuur.nl/aanbod/huren', 'grunoverhuur\.nl/aanbod/[0-9]+', false, 'healthy', null)
ON CONFLICT (source) DO UPDATE SET
  url = EXCLUDED.url,
  link_pattern = EXCLUDED.link_pattern,
  needs_repair = EXCLUDED.needs_repair,
  health_status = EXCLUDED.health_status,
  custom_selectors = EXCLUDED.custom_selectors,
  last_updated_at = now();

-- 4. Reset failed scraper health status
UPDATE public.scraper_health 
SET needs_repair = true, 
    health_status = 'needs_repair',
    last_updated_at = now()
WHERE source IN ('funda', 'rotsvast', 'campusgroningen', 'studenthousing', 'housinganywhere', 'vandermeulen', 'roomspot', 'rentberry');