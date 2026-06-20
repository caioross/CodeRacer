-- rls_migration.template.sql — Template de migration RLS deny-by-default
-- Renomeie para: supabase/migrations/<timestamp>_rls_<nome_tabela>.sql
--
-- Substitua:
--   <schema>     → linkapet | public | seu_schema
--   <tabela>     → nome da tabela
--   <owner_col>  → coluna que identifica o dono (ex: owner_id, user_id, created_by)

-- ─── 1. Habilitar RLS (sem policy = zero acesso) ──────────────────────────────
ALTER TABLE <schema>.<tabela> ENABLE ROW LEVEL SECURITY;

-- ─── 2. Policy de leitura — owner vê apenas seus próprios registros ───────────
CREATE POLICY "<tabela>_owner_select"
ON <schema>.<tabela>
FOR SELECT
USING (<owner_col> = auth.uid());

-- ─── 3. Policy de inserção — owner cria registros como dono ──────────────────
CREATE POLICY "<tabela>_owner_insert"
ON <schema>.<tabela>
FOR INSERT
WITH CHECK (<owner_col> = auth.uid());

-- ─── 4. Policy de atualização — owner atualiza apenas os próprios ─────────────
CREATE POLICY "<tabela>_owner_update"
ON <schema>.<tabela>
FOR UPDATE
USING (<owner_col> = auth.uid())
WITH CHECK (<owner_col> = auth.uid());

-- ─── 5. Policy de deleção — owner deleta apenas os próprios ──────────────────
CREATE POLICY "<tabela>_owner_delete"
ON <schema>.<tabela>
FOR DELETE
USING (<owner_col> = auth.uid());

-- ─── 6. (Opcional) Acesso de service_role para operações admin ───────────────
-- service_role bypassa RLS por padrão — não é necessário policy explícita.
-- Mas documente se alguma função usa SECURITY DEFINER para operar como admin.

-- ─── 7. (Opcional) Leitura pública — apenas se o dado for realmente público ──
-- REMOVA este bloco se o dado não for público.
-- CREATE POLICY "<tabela>_public_read"
-- ON <schema>.<tabela>
-- FOR SELECT
-- USING (true); -- justificativa: <DESCREVA POR QUE O DADO É PÚBLICO>

-- ─── Verificação pós-migration ────────────────────────────────────────────────
-- Rode após aplicar:
--   python3 scripts/check_rls.py --migrations-dir supabase/migrations/
--   psql $SUPABASE_DB_URL -f scripts/test_rls.sql -v ON_ERROR_STOP=1
