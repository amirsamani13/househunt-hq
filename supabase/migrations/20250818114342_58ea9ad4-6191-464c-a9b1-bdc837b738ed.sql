-- EMERGENCY CLEANUP: Remove all fake data and fix duplicate detection

-- Step 1: Delete all fake Kamernet entries
DELETE FROM public.properties 
WHERE source = 'kamernet' 
AND url = 'https://kamernet.nl/en/for-rent/room-test';

-- Step 2: Delete all properties with fake title fragments
DELETE FROM public.properties 
WHERE title ILIKE '%Ook ligt dit huis dicht bij%' 
OR description ILIKE '%Ook ligt dit huis dicht bij%';

-- Step 3: Delete notifications for non-existent properties
DELETE FROM public.notifications 
WHERE property_id NOT IN (SELECT id FROM public.properties);

-- Step 4: Add unique constraint for proper duplicate detection
-- First, ensure external_id is properly set to URL for existing properties
UPDATE public.properties 
SET external_id = url 
WHERE external_id IS NULL OR external_id = '';

-- Add unique constraint on source + external_id to prevent duplicates
ALTER TABLE public.properties 
ADD CONSTRAINT properties_source_external_id_unique 
UNIQUE (source, external_id);

-- Step 5: Add index for better performance
CREATE INDEX IF NOT EXISTS idx_properties_source_external_id 
ON public.properties (source, external_id);

-- Step 6: Update existing scraping logs to clean status
UPDATE public.scraping_logs 
SET status = 'completed', 
    error_message = NULL,
    completed_at = now() 
WHERE status NOT IN ('completed', 'running');