-- Fix invalid trigger on properties that referenced a non-existent updated_at column
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_proc p ON t.tgfoid = p.oid
    JOIN pg_class c ON t.tgrelid = c.oid
    WHERE c.relname = 'properties' AND p.proname = 'update_updated_at_column' AND NOT t.tgisinternal
  ) THEN
    EXECUTE 'DROP TRIGGER update_properties_updated_at ON public.properties';
  END IF;
END $$;

-- Create a proper function to maintain last_updated_at
CREATE OR REPLACE FUNCTION public.update_last_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Create trigger using the correct column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    WHERE c.relname = 'properties' AND t.tgname = 'update_properties_last_updated_at'
  ) THEN
    CREATE TRIGGER update_properties_last_updated_at
    BEFORE UPDATE ON public.properties
    FOR EACH ROW
    EXECUTE FUNCTION public.update_last_updated_at_column();
  END IF;
END $$;

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
SET is_active = false
WHERE source = 'kamernet' AND external_id LIKE 'kamernet_fallback%';