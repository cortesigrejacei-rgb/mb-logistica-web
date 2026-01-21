-- 1. VERIFICAÇÃO (Mostra o estado atual)
SELECT id, name, email, status, expo_push_token 
FROM technicians 
ORDER BY name;

-- 2. CORREÇÃO DE PERMISSÕES (Garante que o App consiga salvar o Token)

-- Habilita RLS (Boas práticas)
ALTER TABLE technicians ENABLE ROW LEVEL SECURITY;

-- Limpa politicas antigas que podem estar bloqueando
DROP POLICY IF EXISTS "Enable read access for all users" ON technicians;
DROP POLICY IF EXISTS "Enable insert for all users" ON technicians;
DROP POLICY IF EXISTS "Enable update for all users" ON technicians;
DROP POLICY IF EXISTS "Allow public read-write" ON technicians;

-- Cria políticas PERMISSIVAS (Ideal para fazer funcionar agora)
-- Permite leitura pública (Necessário para login/verificação)
CREATE POLICY "Enable read access for all users" ON technicians FOR SELECT USING (true);

-- Permite atualização pública (Necessário para o App salvar o Token e Bateria)
CREATE POLICY "Enable update for all users" ON technicians FOR UPDATE USING (true);

-- Permite inserção (Caso crie tecnicos via app no futuro)
CREATE POLICY "Enable insert for all users" ON technicians FOR INSERT WITH CHECK (true);

-- Garante grants
GRANT ALL ON TABLE technicians TO anon;
GRANT ALL ON TABLE technicians TO authenticated;
GRANT ALL ON TABLE technicians TO service_role;

-- 3. CONFIRMAÇÃO
SELECT 'Permissões atualizadas com sucesso. Tente logar no App novamente.' as status;
