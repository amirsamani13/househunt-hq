-- Clean up malformed properties with bad titles and broken URLs
DELETE FROM public.properties 
WHERE title ILIKE '%for rent%euro%,%' 
   OR title = ''
   OR title IS NULL
   OR LENGTH(trim(title)) < 3
   OR url LIKE '%/huurwoningen/groningen'
   OR url LIKE '%/for-rent/properties-groningen'
   OR url LIKE '%/woningaanbod';