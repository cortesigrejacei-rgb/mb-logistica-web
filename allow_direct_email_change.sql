-- Function to allow an authenticated user to update their own email directly
-- This bypasses the default Supabase "Secure Email Change" flow which requires confirmation.

CREATE OR REPLACE FUNCTION update_own_email(new_email TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with privileges of the creator (postgres), allowing access to auth.users
SET search_path = public, auth -- Set search path for safety
AS $$
DECLARE
  current_user_id UUID;
BEGIN
  -- Get the current user ID
  current_user_id := auth.uid();

  -- Check if user is logged in
  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
  END IF;

  -- Update the email in auth.users
  -- We also update email_confirmed_at to ensure it's treated as verified immediately
  UPDATE auth.users
  SET 
    email = new_email,
    updated_at = now(),
    email_confirmed_at = now() -- Auto-confirm the new email
  WHERE id = current_user_id;

  -- Optional: If you have a matching record in public.users or public.profiles (depending on your schema), update it too.
  -- Currently assuming Supabase handles the sync or trigger handles it, but explicit update is safer if you use email as a key elsewhere.
  -- UPDATE public.technicians SET email = new_email WHERE id = current_user_id; -- Example if needed

  RETURN jsonb_build_object('success', true, 'message', 'Email updated successfully');

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

-- Grant permission to authenticated users to call this function
GRANT EXECUTE ON FUNCTION update_own_email(TEXT) TO authenticated;
