-- Deduplicate properties by (source, external_id)
WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY source, external_id ORDER BY first_seen_at) AS rn
  FROM public.properties
)
DELETE FROM public.properties p USING ranked r
WHERE p.id = r.id AND r.rn > 1;

-- Enforce uniqueness on properties (source, external_id)
DO $$
BEGIN
  ALTER TABLE public.properties
  ADD CONSTRAINT properties_source_external_id_key UNIQUE (source, external_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Index to speed up recent fetches
CREATE INDEX IF NOT EXISTS idx_properties_first_seen_at ON public.properties (first_seen_at DESC);

-- Deduplicate notifications per user and property
WITH ranked_n AS (
  SELECT id, row_number() OVER (PARTITION BY user_id, property_id ORDER BY sent_at) AS rn
  FROM public.notifications
)
DELETE FROM public.notifications n USING ranked_n r
WHERE n.id = r.id AND r.rn > 1;

-- Enforce uniqueness on notifications (user_id, property_id)
DO $$
BEGIN
  ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_user_property_unique UNIQUE (user_id, property_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;