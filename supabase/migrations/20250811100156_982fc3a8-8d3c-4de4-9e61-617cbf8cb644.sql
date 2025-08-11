-- Add cities filter to user_alerts for city-level targeting
ALTER TABLE public.user_alerts
ADD COLUMN IF NOT EXISTS cities TEXT[];

-- Optional: set default empty array for consistency (kept NULL to mean "any city")
-- ALTER TABLE public.user_alerts ALTER COLUMN cities SET DEFAULT ARRAY[]::TEXT[];

-- Note: RLS remains unchanged (Users can manage their own alerts)
