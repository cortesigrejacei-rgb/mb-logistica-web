-- 1. Habilitar DELETE na tabela de técnicos para administradores (ou público se preferir simplificar agora)
DROP POLICY IF EXISTS "Enable delete for all users" ON technicians;
CREATE POLICY "Enable delete for all users" ON technicians FOR DELETE USING (true);

-- 2. Garantir Grants de DELETE
GRANT DELETE ON TABLE technicians TO anon;
GRANT DELETE ON TABLE technicians TO authenticated;
GRANT DELETE ON TABLE technicians TO service_role;

-- 3. Verificação de FKs (Opcional, mas útil saber)
-- Se houver erro de "foreign key constraint", o usuário verá no toast que precisa desvincular as coletas primeiro.

SELECT 'Política de DELETE habilitada na tabela technicians.' as status;
