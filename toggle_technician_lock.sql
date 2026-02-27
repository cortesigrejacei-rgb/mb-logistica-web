
-- Função para bloquear/desbloquear técnico e seu login
CREATE OR REPLACE FUNCTION toggle_technician_lock(target_id UUID, block_status BOOLEAN)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    -- 1. Atualizar a tabela de técnicos
    UPDATE technicians
    SET 
        is_blocked = block_status,
        status = CASE WHEN block_status THEN 'Inativo' ELSE 'Offline' END
    WHERE id = target_id;

    -- 2. Atualizar o login no Supabase Auth
    -- 'infinity' bloqueia indefinidamente, NULL remove o bloqueio
    UPDATE auth.users
    SET banned_until = CASE WHEN block_status THEN 'infinity'::timestamptz ELSE NULL END
    WHERE id = target_id;

    RETURN jsonb_build_object(
        'success', true, 
        'message', CASE WHEN block_status THEN 'Técnico bloqueado com sucesso' ELSE 'Técnico desbloqueado com sucesso' END
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

-- Liberar execução
GRANT EXECUTE ON FUNCTION toggle_technician_lock(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION toggle_technician_lock(UUID, BOOLEAN) TO anon;
