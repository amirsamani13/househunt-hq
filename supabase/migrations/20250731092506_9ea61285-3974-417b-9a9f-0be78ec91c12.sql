-- Fix the database triggers completely
-- First, drop all existing triggers
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_subscription ON auth.users;

-- Create the profile trigger first (this already exists and works)
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create the subscription trigger second
CREATE TRIGGER on_auth_user_created_subscription  
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.setup_user_subscription();