-- Insert a test property with a real URL that should work
INSERT INTO public.properties (
  external_id,
  source,
  title,
  description,
  price,
  bedrooms,
  bathrooms,
  surface_area,
  address,
  city,
  postal_code,
  property_type,
  url,
  is_active,
  first_seen_at,
  last_updated_at
) VALUES (
  'test-property-notification-valid-url',
  'pararius',
  'Test Apartment with Valid URL',
  'A test apartment for notification system verification.',
  850,
  2,
  1,
  65,
  'Grote Markt 15',
  'Groningen',
  '9712HN',
  'apartment',
  'https://www.pararius.com/',
  true,
  now(),
  now()
) 
ON CONFLICT (external_id) DO UPDATE SET
  is_active = EXCLUDED.is_active,
  last_updated_at = EXCLUDED.last_updated_at;