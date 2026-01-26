-- Versão melhorada da sincronização para garantir que funcione mesmo com metadados vazios
-- e trate o email de forma case-insensitive.

CREATE OR REPLACE FUNCTION sync_technician_auth(
    current_email TEXT,
    updated_email TEXT,
    updated_name TEXT,
    updated_role TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    target_user_id UUID;
BEGIN
    -- 1. Localizar o usuário (Case Insensitive)
    SELECT id INTO target_user_id 
    FROM auth.users 
    WHERE LOWER(email) = LOWER(current_email);

    IF target_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false, 
            'message', 'Usuário ' || current_email || ' não encontrado na Autenticação (Auth). Provavelmente foi criado manualmente apenas na tabela e não possui login.'
        );
    END IF;

    -- 2. Atualizar os dados
    -- Usamos COALESCE para garantir que o merge (||) funcione mesmo se raw_user_meta_data for nulo
    UPDATE auth.users
    SET 
        email = LOWER(updated_email),
        raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
            'full_name', updated_name,
            'role', updated_role
        ),
        updated_at = now(),
        email_confirmed_at = now()
    WHERE id = target_user_id;

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Dados de login sincronizados com sucesso para ' || updated_email
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', 'Erro SQL: ' || SQLERRM);
END;
$$;

-- Grants
GRANT EXECUTE ON FUNCTION sync_technician_auth(TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION sync_technician_auth(TEXT, TEXT, TEXT, TEXT) TO anon;

SELECT 'RPC sync_technician_auth atualizada com melhorias de robustez.' as status;
