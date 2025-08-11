-- Clean up existing properties with contaminated titles
UPDATE public.properties 
SET title = CASE 
    WHEN title LIKE '%?%' THEN 
        TRIM(REGEXP_REPLACE(
            REGEXP_REPLACE(title, '\?.*$', '', 'g'),
            '[&=].*$', '', 'g'
        ))
    ELSE title
END
WHERE title LIKE '%?%' OR title LIKE '%&%' OR title LIKE '%=%';

-- Delete properties with obviously bad URLs or titles that couldn't be cleaned
DELETE FROM public.properties 
WHERE 
    title ~ '[?&=]' OR 
    title LIKE '%overzicht%' OR 
    title LIKE '%filter%' OR
    url LIKE '%?%' OR
    url LIKE '%&%' OR
    title = '' OR
    title IS NULL;