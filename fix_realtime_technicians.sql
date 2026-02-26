-- Ativa Replicação Completa para a tabela de técnicos
-- Isso garante que o payload do Web Socket traga todos os dados antigos e novos de lat/lng
ALTER TABLE public.technicians REPLICA IDENTITY FULL;

-- Garante que a tabela está na publicação do Realtime
DO $$
BEGIN
    if not exists(
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
        and tablename = 'technicians'
    ) then
        ALTER PUBLICATION supabase_realtime ADD TABLE public.technicians;
    end if;
END
$$;

-- Testa um update para forçar um evento de broadcast
UPDATE public.technicians 
SET last_seen = NOW() 
WHERE lat IS NOT NULL;
