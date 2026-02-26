-- Adiciona colunas para rastrear o progresso do combustível e distância no resumo de rotas
ALTER TABLE public.route_summaries 
ADD COLUMN IF NOT EXISTS remaining_distance_km numeric,
ADD COLUMN IF NOT EXISTS remaining_fuel_cost numeric;
