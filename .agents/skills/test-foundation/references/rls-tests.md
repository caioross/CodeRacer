# Testes de RLS no Supabase por Papel

## Contexto do portfólio

MedPet/linkapet tem RLS `deny-by-default` na migration `20260503000600_rls_policies.sql` com 4 papéis: owner, co-tutor, caretaker, viewer. MecanicaSmart tem Supabase provisionado mas migrations não verificadas. A ausência de testes significa que uma policy mal escrita pode vazar dados de saúde de pets ou dados de clientes de oficina sem que ninguém perceba.

Deny-by-default garante que esquecer uma policy = bloquear, não vazar. O risco real é o inverso: uma policy mal escrita que usa `using (true)` expõe tudo. O teste prova o isolamento cross-tenant.

## Como executar testes de RLS no Supabase

### Opção 1: psql direto (mais simples, CI-friendly)

```bash
# Conecte ao banco de desenvolvimento (nunca ao de produção para testes)
psql $SUPABASE_DB_URL -f scripts/test_rls.sql
```

Se alguma asserção falhar, o script retorna exit code 1 e o CI falha.

### Opção 2: pgTAP (framework de testes para Postgres)

```sql
-- Requer extensão pgTAP instalada
CREATE EXTENSION IF NOT EXISTS pgtap;
SELECT * FROM runtests('linkapet_rls');
```

## Template de teste por papel — schema linkapet (MedPet)

Para o padrão completo, use `assets/test_rls.sql` diretamente. O princípio:

```sql
-- 1. Crie usuários de teste com JWTs simulando cada papel
-- 2. Execute queries como cada papel via SET LOCAL role + SET LOCAL jwt.claims
-- 3. Asserte que cada papel vê apenas o que deve
-- 4. Asserte explicitamente que viewer NÃO vê dados de outro tutor (cross-tenant)
```

## Papéis no schema linkapet

| Papel | Pode ler | Pode escrever | Pode deletar |
|---|---|---|---|
| `owner` | Todos os seus pets e eventos | Todos os seus dados | Sim |
| `co-tutor` | Pets onde foi convidado | Eventos dos pets compartilhados | Não |
| `caretaker` | Pets em cuidado ativo | Apenas eventos de cuidado | Não |
| `viewer` | Snapshot via share-token | Nada | Não |

## Invariantes que o teste deve provar

1. `viewer` com token do pet A não consegue ler dados do pet B (mesmo banco, outro tutor).
2. `co-tutor` do tutor X não consegue criar registros fingindo ser o tutor X.
3. `caretaker` com sessão expirada é rejeitado (policy verifica `expires_at`).
4. Nenhuma tabela tem `USING (true)` sem uma razão documentada como comentário na migration.

## Script de verificação automática

```bash
# Verifica se alguma policy usa (true) sem justificativa
grep -r "USING (true)" supabase/migrations/ | grep -v "-- justificativa:" && \
  echo "FALHA: policy permissiva sem justificativa" && exit 1 || \
  echo "OK: nenhuma policy (true) injustificada"
```

## MecanicaSmart — o que testar

Papéis esperados: `dono_oficina`, `mecanico`, `cliente_externo` (via link público de OS).

```sql
-- Cliente externo não pode ler lista de outros clientes
SET LOCAL role TO 'cliente_externo';
SET LOCAL request.jwt.claims TO '{"sub": "cliente-uuid-123", "role": "cliente_externo"}';

SELECT count(*) FROM os WHERE cliente_id != 'cliente-uuid-123';
-- Deve retornar 0. Se retornar > 0, há vazamento cross-tenant.
```

## CI snippet

```yaml
- name: Testar RLS
  env:
    SUPABASE_DB_URL: ${{ secrets.SUPABASE_TEST_DB_URL }}  # banco de teste, nunca produção
  run: psql $SUPABASE_DB_URL -f scripts/test_rls.sql -v ON_ERROR_STOP=1
```

**NUNCA use o banco de produção para testes.** Use `supabase start` localmente ou provisione um projeto separado para CI.
