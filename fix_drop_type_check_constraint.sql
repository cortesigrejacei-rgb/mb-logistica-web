-- Remove the specific check constraint that limits what values 'type' can have
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

-- Just in case there are others with similar names (sometimes named automatically)
-- Ideally we would check information_schema, but this is the named one from the error.

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
