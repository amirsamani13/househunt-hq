-- Clean up properties with fake/malformed data
DELETE FROM public.properties 
WHERE title ILIKE '%apartment at kamer%'
   OR title ILIKE '%apartment at unknown%'
   OR address ILIKE '%kamer %'
   OR title = ''
   OR title IS NULL;