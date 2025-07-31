-- Create missing subscriber record for existing user
INSERT INTO public.subscribers (user_id, email, subscribed, subscription_tier, trial_end)
SELECT 'b7502c31-6566-417a-bd31-44d7790f6260', 'amirsamani13@gmail.com', true, 'trial', now() + interval '14 days'
WHERE NOT EXISTS (
  SELECT 1 FROM public.subscribers WHERE user_id = 'b7502c31-6566-417a-bd31-44d7790f6260'
);

-- Update the profile with trial info
UPDATE public.profiles 
SET trial_used = false, trial_start_date = now()
WHERE user_id = 'b7502c31-6566-417a-bd31-44d7790f6260' AND trial_start_date IS NULL;