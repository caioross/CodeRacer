---
name: supabase-rls-guard
description: Implementa e audita Row Level Security deny-by-default no Supabase. Use SEMPRE que a tarefa mencionar RLS, Row Level Security, políticas de acesso, migration de segurança, compartilhamento com escopo, MedPet, linkapet, MecanicaSmart, skilldepot, Senet rankings, tabelas Supabase, "using (true)", service_role, ou quando adicionar uma tabela nova a qualquer projeto com Supabase. Projetos afetados: MedPet (schema linkapet, 4 papéis, share-token com hash+pepper), MecanicaSmart (OS, clientes, billing), skilldepot (skills, ratings, OAuth tokens), Senet (rankings públicos).
---

# supabase-rls-guard — RLS deny-by-default para todos os projetos Supabase

## Por que deny-by-default, e não o contrário

O default do Postgres sem RLS é: toda linha de toda tabela é visível para qualquer query autenticada. Com `enable row level security` mas sem policies, o resultado é zero acesso. **Esquecer uma policy = bloquear. Esquecer o RLS = vazar.** A direção do erro é oposta — deny-by-default erra para o lado seguro.

O portfólio já tem um exemplo correto: MedPet/linkapet `20260503000600_rls_policies.sql` implementa deny-by-default com 4 papéis (owner, co-tutor, caretaker, viewer) e share-tokens com `hash + pepper`. Esta skill propaga o mesmo padrão.

## Projetos e estado atual

| Projeto | Schema | Estado RLS | Risco |
|---|---|---|---|
| MedPet/linkapet | `linkapet` | Implementado em migration `20260503000600_rls_policies.sql` | Testar cross-tenant isolation |
| MecanicaSmart | `public` | Supabase provisionado, migrations não verificadas | Dados de clientes e OS sem proteção confirmada |
| skilldepot | `public` | RLS não mencionado no relatório; `sk_live` em `.env` | Skills/ratings visíveis cross-user? |
| Senet | `public` (site) | Rankings públicos — verificar se tabelas privadas existem | Baixo se tudo for público |

## Workflow por projeto

### Para uma tabela nova (qualquer projeto)

```sql
-- 1. Habilite RLS na tabela — sem policy = zero acesso (intencional)
ALTER TABLE linkapet.minha_tabela ENABLE ROW LEVEL SECURITY;

-- 2. Adicione policies mínimas. Veja references/policy-patterns.md para moldes.
-- NÃO use USING (true) sem justificativa documentada como comentário.

-- 3. Rode o script de auditoria para garantir que nenhuma tabela ficou para trás
python3 scripts/check_rls.py --migrations-dir supabase/migrations/
```

### Para auditar o estado atual

```bash
# Encontra tabelas sem RLS ou com policy permissiva injustificada
python3 scripts/check_rls.py --migrations-dir supabase/migrations/

# Roda os testes de isolamento por papel
psql $SUPABASE_DB_URL -f scripts/test_rls.sql -v ON_ERROR_STOP=1
```

### Para adicionar um papel novo

Leia `references/policy-patterns.md` — tem o molde por papel (owner, co-tutor, caretaker, viewer) e para share-tokens com expiração + auditoria.

## O padrão hash + pepper (share-tokens do MedPet)

Share-tokens permitem que um tutor compartilhe o prontuário do pet com um veterinário via link/QR sem criar uma conta. O design protege contra dois ataques:

1. **Dump do banco:** o token no banco é um hash SHA-256 do valor real + um pepper do servidor. Mesmo com acesso ao banco, o atacante não consegue derivar o token original.
2. **Brute force:** o token real tem entropia suficiente (UUID v4 = 122 bits). Com pepper, mesmo tabelas de hash pré-computadas são inúteis.

```sql
-- Armazenar (na escrita do token):
INSERT INTO linkapet.share_tokens (token_hash, pet_id, scope, expires_at)
VALUES (
    encode(sha256((token_value || current_setting('app.token_pepper'))::bytea), 'hex'),
    pet_id,
    scope_array,
    NOW() + INTERVAL '7 days'
);

-- Validar (na leitura via link):
SELECT * FROM linkapet.share_tokens
WHERE token_hash = encode(sha256((input_token || current_setting('app.token_pepper'))::bytea), 'hex')
  AND expires_at > NOW()
  AND revoked_at IS NULL;
```

O pepper (`app.token_pepper`) é uma variável de configuração do Postgres definida via `supabase secrets set` — nunca em código ou migration.

## Verificação de segurança antes de commitar

```bash
# Confirma que nenhuma policy usa (true) sem justificativa
python3 scripts/check_rls.py --migrations-dir supabase/migrations/ --strict

# Confirma que service_role não está em arquivo versionável
git diff --cached | grep -i "service.role\|anon.*key\|supabase.*password" && \
  echo "PARE: credencial Supabase no diff!" && exit 1 || echo "OK"
```

## Arquivos desta skill

- `scripts/check_rls.py` — audita migrations, flageia tabelas sem RLS e policies permissivas
- `scripts/test_rls.sql` — testa isolamento cross-tenant por papel (rodável em CI)
- `references/policy-patterns.md` — moldes de policy por papel + share-token
- `assets/rls_migration.template.sql` — template de migration com deny-by-default

## Critério de aceite

- `check_rls.py` termina sem warnings: toda tabela tem RLS habilitado.
- `test_rls.sql` passa: cada papel só vê o que deve, viewer não lê dados de outro tutor.
- Nenhuma policy usa `USING (true)` sem um comentário de justificativa na migration.
- `service_role` key não aparece em nenhum arquivo versionado (`git log --all -S "service_role"`).
