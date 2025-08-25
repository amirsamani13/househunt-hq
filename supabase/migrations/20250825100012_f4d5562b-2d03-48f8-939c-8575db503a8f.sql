-- Create trigger to automatically send notifications when new properties are inserted
CREATE TRIGGER notify_users_of_new_properties
    AFTER INSERT ON public.properties
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_matching_users();

-- Also create a trigger to handle updates to properties
CREATE TRIGGER notify_users_of_updated_properties
    AFTER UPDATE ON public.properties
    FOR EACH ROW
    WHEN (OLD.is_active = false AND NEW.is_active = true)
    EXECUTE FUNCTION public.notify_matching_users();