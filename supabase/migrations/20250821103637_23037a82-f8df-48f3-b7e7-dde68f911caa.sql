-- Clean up database by removing properties from unwanted sources
-- Keep only pararius, kamernet, and grunoverhuur
DELETE FROM public.properties 
WHERE source NOT IN ('pararius', 'kamernet', 'grunoverhuur');

-- Also clean up any scraping logs for unwanted sources
DELETE FROM public.scraping_logs 
WHERE source NOT IN ('pararius', 'kamernet', 'grunoverhuur');

-- Update any user alerts that might reference removed sources
UPDATE public.user_alerts 
SET sources = ARRAY['pararius', 'kamernet', 'grunoverhuur']
WHERE sources IS NOT NULL 
AND sources != ARRAY['pararius', 'kamernet', 'grunoverhuur'];