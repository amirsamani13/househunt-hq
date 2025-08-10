-- Ensure de-duplication for notifications: one per (user,property)
CREATE UNIQUE INDEX IF NOT EXISTS notifications_user_property_unique
ON public.notifications (user_id, property_id);

-- Optional performance improvement for recent property scans
CREATE INDEX IF NOT EXISTS idx_properties_first_seen_at
ON public.properties (first_seen_at DESC);