-- Função para sincronizar dados do perfil (público) com a conta de Autenticação (auth.users)
-- Isso permite mudar Nome e Email no painel e refletir no login do técnico.

CREATE OR REPLACE FUNCTION sync_technician_auth(
    current_email TEXT,
    updated_email TEXT,
    updated_name TEXT,
    updated_role TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Roda como admin para poder alterar a tabela auth.users
SET search_path = public, auth
AS $$
DECLARE
    target_user_id UUID;
BEGIN
    -- 1. Localizar o usuário na tabela de autenticação pelo email atual
    SELECT id INTO target_user_id FROM auth.users WHERE email = current_email;

    IF target_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Usuário não encontrado na base de Autenticação.');
    END IF;

    -- 2. Atualizar os dados (Email e Metadata)
    UPDATE auth.users
    SET 
        email = updated_email,
        raw_user_meta_data = raw_user_meta_data || jsonb_build_object(
            'full_name', updated_name,
            'role', updated_role
        ),
        updated_at = now(),
        email_confirmed_at = now() -- Auto-confirma para não travar o acesso
    WHERE id = target_user_id;

    RETURN jsonb_build_object('success', true, 'message', 'Autenticação sincronizada com sucesso.');

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

-- Liberar acesso
GRANT EXECUTE ON FUNCTION sync_technician_auth(TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION sync_technician_auth(TEXT, TEXT, TEXT, TEXT) TO anon;

SELECT 'Função sync_technician_auth criada com sucesso.' as status;
