-- Make profile creation idempotent to avoid duplicate trigger inserts
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  )
  ON CONFLICT (user_id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    updated_at = now();

  RETURN NEW;
END;
$$;

-- Make subscriber setup idempotent to avoid duplicate trigger inserts
CREATE OR REPLACE FUNCTION public.setup_user_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Create or update subscriber record with 14-day trial on first creation
  INSERT INTO public.subscribers (user_id, email, subscribed, subscription_tier, trial_end)
  VALUES (
    NEW.id,
    NEW.email,
    true,  -- Start with trial active
    'trial',
    now() + interval '14 days'
  )
  ON CONFLICT (email) DO UPDATE
  SET 
    subscribed = true,
    subscription_tier = EXCLUDED.subscription_tier,
    -- keep existing trial_end if already set to avoid extending repeatedly
    trial_end = COALESCE(public.subscribers.trial_end, EXCLUDED.trial_end),
    updated_at = now();
  
  -- Ensure profile trial flags are set (idempotent update)
  UPDATE public.profiles 
  SET trial_used = false, trial_start_date = COALESCE(trial_start_date, now()), updated_at = now()
  WHERE user_id = NEW.id;
  
  RETURN NEW;
END;
$$;