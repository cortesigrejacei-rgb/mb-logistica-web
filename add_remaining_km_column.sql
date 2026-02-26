-- Adiciona a coluna remaining_km na tabela de técnicos se ela não existir
ALTER TABLE public.technicians ADD COLUMN IF NOT EXISTS remaining_km numeric;
