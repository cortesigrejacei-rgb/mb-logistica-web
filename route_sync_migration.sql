-- Add Sequence Order to collections for Route Synchronization
ALTER TABLE public.collections
ADD COLUMN IF NOT EXISTS sequence_order INTEGER DEFAULT 999;

-- Index for faster ordering queries
CREATE INDEX IF NOT EXISTS idx_collections_sequence_order ON public.collections(sequence_order);

-- Update RLS to ensure authenticated users can update the sequence
-- (Assuming existing update policy covers 'collections', but good to double check)
-- Existing policy usually is "Enable update for authenticated users only"
