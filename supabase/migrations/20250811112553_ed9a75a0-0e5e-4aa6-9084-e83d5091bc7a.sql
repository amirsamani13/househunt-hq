-- Expand allowed values for properties.source to include all current scraper sources
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'properties_source_check'
      AND conrelid = 'public.properties'::regclass
  ) THEN
    ALTER TABLE public.properties DROP CONSTRAINT properties_source_check;
  END IF;
END $$;

ALTER TABLE public.properties
ADD CONSTRAINT properties_source_check
CHECK (source = ANY (ARRAY[
  'pararius','kamernet','grunoverhuur','funda','campusgroningen','rotsvast','expatrentalsholland','vandermeulen','housinganywhere','dcwonen','huure','maxxhuren','kpmakelaars','househunting','woldringverhuur','050vastgoed','pandomo'
]));

-- Ensure uniqueness on (source, external_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'properties_source_external_id_unique'
      AND conrelid = 'public.properties'::regclass
  ) THEN
    ALTER TABLE public.properties
    ADD CONSTRAINT properties_source_external_id_unique UNIQUE (source, external_id);
  END IF;
END $$;

-- Deactivate known kamernet fallback records lingering from older runs
UPDATE public.properties
SET is_active = false, last_updated_at = now()
WHERE source = 'kamernet' AND external_id LIKE 'kamernet_fallback%';