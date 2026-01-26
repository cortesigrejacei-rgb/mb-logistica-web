-- Função para deletar técnico de forma robusta, limpando dependências
-- Isso resolve o problema de "Técnicos do cadastro antigo" que não deletam por FK ou falta de Auth.

CREATE OR REPLACE FUNCTION nuke_technician(target_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Permite deletar mesmo se o usuário logado não tiver permissão direta em todas as tabelas
AS $$
BEGIN
    -- 1. Desvincular coletas (Não deletamos as coletas, apenas removemos o técnico)
    UPDATE collections 
    SET driver_id = NULL, status = 'Pendente' 
    WHERE driver_id = target_id;

    -- 2. Deletar históricos de rota
    DELETE FROM route_summaries WHERE technician_id::text = target_id;

    -- 3. Deletar notificações enviadas
    DELETE FROM notifications WHERE technician_id = target_id;

    -- 4. Deletar pontos batidos (Se a tabela existir)
    BEGIN
        DELETE FROM time_entries WHERE technician_id = target_id;
    EXCEPTION WHEN OTHERS THEN
        -- Ignora se a tabela não existir
    END;

    -- 5. Deletar o perfil do técnico
    DELETE FROM technicians WHERE id = target_id;

    RETURN jsonb_build_object('success', true, 'message', 'Técnico e dependências removidos com sucesso');

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

-- Liberar execução para authenticated e anon (Painel Web)
GRANT EXECUTE ON FUNCTION nuke_technician(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION nuke_technician(TEXT) TO anon;

-- Garantir que a tabela technicians permite DELETE via RPC (Security Definer já ajuda, mas por garantia)
DROP POLICY IF EXISTS "Enable delete for all users" ON technicians;
CREATE POLICY "Enable delete for all users" ON technicians FOR DELETE USING (true);
GRANT DELETE ON TABLE technicians TO anon, authenticated, service_role;

SELECT 'Função nuke_technician criada com sucesso.' as status;
