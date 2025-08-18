-- Create health monitoring tables for scrapers
CREATE TABLE IF NOT EXISTS public.scraper_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  last_successful_run TIMESTAMP WITH TIME ZONE,
  last_failure_run TIMESTAMP WITH TIME ZONE,
  consecutive_failures INTEGER DEFAULT 0,
  consecutive_hours_zero_properties INTEGER DEFAULT 0,
  is_in_repair_mode BOOLEAN DEFAULT false,
  repair_attempts INTEGER DEFAULT 0,
  last_repair_attempt TIMESTAMP WITH TIME ZONE,
  repair_status TEXT DEFAULT 'healthy', -- healthy, needs_repair, repairing, failed
  current_url TEXT,
  backup_urls TEXT[],
  current_selectors JSONB,
  backup_selectors JSONB[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create unique index on source
CREATE UNIQUE INDEX IF NOT EXISTS idx_scraper_health_source ON public.scraper_health(source);

-- Enable RLS
ALTER TABLE public.scraper_health ENABLE ROW LEVEL SECURITY;

-- Allow service role to manage scraper health
CREATE POLICY "Service can manage scraper health" ON public.scraper_health
FOR ALL USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_scraper_health_updated_at
  BEFORE UPDATE ON public.scraper_health
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert initial health records for all scrapers
INSERT INTO public.scraper_health (source, current_url, repair_status)
VALUES 
  ('kamernet', 'https://kamernet.nl/huren/kamer-groningen', 'needs_repair'),
  ('pararius', 'https://www.pararius.com/apartments/groningen', 'healthy'),
  ('grunoverhuur', 'https://www.grunoverhuur.nl/woningaanbod', 'healthy'),
  ('funda', 'https://www.funda.nl/huur/groningen', 'needs_repair'),
  ('campusgroningen', 'https://www.campusgroningen.nl/aanbod/huren', 'needs_repair'),
  ('rotsvast', 'https://www.rotsvast.nl/verhuur/groningen', 'needs_repair'),
  ('expatrentalholland', 'https://www.expatrentalholland.com/apartments-for-rent/groningen', 'needs_repair'),
  ('vandermeulen', 'https://www.vandermeulen.nl/huurwoningen/groningen', 'needs_repair'),
  ('housinganywhere', 'https://housinganywhere.com/s/Groningen--Netherlands', 'healthy'),
  ('studenthousing', 'https://www.studenthousing.com/find-student-housing/netherlands/groningen', 'needs_repair'),
  ('roomspot', 'https://www.roomspot.nl/en/student-housing/groningen', 'needs_repair'),
  ('rentberry', 'https://rentberry.com/apartments-for-rent/groningen-netherlands', 'needs_repair')
ON CONFLICT (source) DO UPDATE SET
  repair_status = EXCLUDED.repair_status,
  updated_at = now();