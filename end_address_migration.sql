-- Add End Location fields to technicians table
ALTER TABLE public.technicians
ADD COLUMN IF NOT EXISTS end_address TEXT,
ADD COLUMN IF NOT EXISTS end_city TEXT,
ADD COLUMN IF NOT EXISTS end_state TEXT,
ADD COLUMN IF NOT EXISTS end_lat FLOAT,
ADD COLUMN IF NOT EXISTS end_lng FLOAT;
