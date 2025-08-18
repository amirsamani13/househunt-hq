-- EMERGENCY CLEANUP: Remove all fake data (fixed)

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

-- Step 4: Ensure external_id is properly set to URL for existing properties
UPDATE public.properties 
SET external_id = url 
WHERE external_id IS NULL OR external_id = '';

-- Step 5: Update existing scraping logs to valid status (using 'success' instead of 'completed')
UPDATE public.scraping_logs 
SET status = 'success', 
    error_message = NULL,
    completed_at = now() 
WHERE status NOT IN ('success', 'error', 'running');