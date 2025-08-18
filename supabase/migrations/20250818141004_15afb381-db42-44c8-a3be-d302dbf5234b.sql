-- Update scraper URLs and clean up unwanted scrapers
-- First, delete unwanted scrapers (rentberry, roomspot, studenthousing)
DELETE FROM public.scraper_health 
WHERE source IN ('rentberry', 'roomspot', 'studenthousing');

-- Update or insert the 9 scrapers with correct URLs and reset their health status
INSERT INTO public.scraper_health (
  source, 
  current_url, 
  repair_status, 
  consecutive_failures, 
  consecutive_hours_zero_properties,
  is_in_repair_mode,
  repair_attempts,
  current_selectors,
  last_successful_run,
  updated_at
) VALUES
  ('campusgroningen', 'https://www.campusgroningen.com/huren-groningen', 'healthy', 0, 0, false, 0, null, now(), now()),
  ('rotsvast', 'https://www.rotsvast.nl/huren/', 'healthy', 0, 0, false, 0, null, now(), now()),
  ('expatrentalsholland', 'https://www.expatrentalsholland.com/offer/in/groningen', 'healthy', 0, 0, false, 0, null, now(), now()),
  ('vandermeulen', 'https://www.vandermeulenmakelaars.nl/en/rental-properties/', 'healthy', 0, 0, false, 0, null, now(), now()),
  ('funda', 'https://www.funda.nl/huur/groningen', 'healthy', 0, 0, false, 0, null, now(), now()),
  ('kamernet', 'https://kamernet.nl/huren/kamer-groningen', 'healthy', 0, 0, false, 0, null, now(), now()),
  ('housinganywhere', 'https://housinganywhere.com/s/Groningen--Netherlands', 'healthy', 0, 0, false, 0, null, now(), now()),
  ('grunoverhuur', 'https://www.grunoverhuur.nl/aanbod/huren', 'healthy', 0, 0, false, 0, null, now(), now()),
  ('pararius', 'https://www.pararius.com/apartments/groningen', 'healthy', 0, 0, false, 0, null, now(), now())
ON CONFLICT (source) DO UPDATE SET
  current_url = EXCLUDED.current_url,
  repair_status = 'healthy',
  consecutive_failures = 0,
  consecutive_hours_zero_properties = 0,
  is_in_repair_mode = false,
  repair_attempts = 0,
  current_selectors = null,
  last_successful_run = now(),
  updated_at = now();