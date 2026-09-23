# Moldes de Policy RLS por Papel — schema linkapet

## Princípio geral

Toda policy usa `auth.uid()` para identificar o usuário atual, nunca um parâmetro passado pelo cliente. O cliente nunca deve poder falsificar sua própria identidade no contexto de uma policy.

## Papel: owner (tutor principal do pet)

```sql
-- Leitura: owner vê todos os próprios pets
CREATE POLICY "owner_select_pets"
ON linkapet.pets FOR SELECT
USING (owner_id = auth.uid());

-- Escrita: owner cria pets como dono
CREATE POLICY "owner_insert_pets"
ON linkapet.pets FOR INSERT
WITH CHECK (owner_id = auth.uid());

-- Atualização: owner atualiza apenas os próprios pets
CREATE POLICY "owner_update_pets"
ON linkapet.pets FOR UPDATE
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

-- Deleção: owner pode deletar os próprios pets
CREATE POLICY "owner_delete_pets"
ON linkapet.pets FOR DELETE
USING (owner_id = auth.uid());
```

## Papel: co-tutor (outro tutor com acesso compartilhado)

```sql
-- co-tutor vê pets onde foi explicitamente convidado
CREATE POLICY "cotutor_select_pets"
ON linkapet.pets FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM linkapet.pet_grants
        WHERE pet_id = pets.id
          AND grantee_id = auth.uid()
          AND role = 'co-tutor'
          AND (expires_at IS NULL OR expires_at > NOW())
    )
);

-- co-tutor pode adicionar eventos de saúde (mas não deletar)
CREATE POLICY "cotutor_insert_health_events"
ON linkapet.health_events FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM linkapet.pet_grants
        WHERE pet_id = health_events.pet_id
          AND grantee_id = auth.uid()
          AND role IN ('co-tutor', 'caretaker')
          AND (expires_at IS NULL OR expires_at > NOW())
    )
);
```

## Papel: caretaker (cuidador temporário — pet-sitter, veterinário de plantão)

```sql
-- caretaker vê apenas pets em cuidado ativo
CREATE POLICY "caretaker_select_pets"
ON linkapet.pets FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM linkapet.pet_grants
        WHERE pet_id = pets.id
          AND grantee_id = auth.uid()
          AND role = 'caretaker'
          AND started_at <= NOW()
          AND (ended_at IS NULL OR ended_at > NOW())
    )
);
```

## Papel: viewer (acesso via share-token, sem conta)

O viewer acessa via token de compartilhamento. O JWT tem o claim `share_token` com o ID do token. A policy verifica o hash e a expiração.

```sql
-- viewer lê apenas dados do pet com que o token foi gerado,
-- dentro do escopo declarado (ex: ['vaccines', 'weight'])
CREATE POLICY "viewer_select_health_events_via_token"
ON linkapet.health_events FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM linkapet.share_tokens st
        WHERE st.id = (current_setting('request.jwt.claims', true)::json->>'share_token')
          AND st.pet_id = health_events.pet_id
          AND st.expires_at > NOW()
          AND st.revoked_at IS NULL
          AND (
              event_type = ANY(st.scope)
              OR 'all' = ANY(st.scope)
          )
    )
);
```

## Share-token com auditoria de acesso

Toda vez que um viewer usa um token, registre o acesso. Isso permite ao tutor ver quem acessou quando.

```sql
-- Trigger de auditoria (dispara após SELECT via token)
CREATE OR REPLACE FUNCTION linkapet.log_token_access()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    token_id TEXT;
BEGIN
    token_id := current_setting('request.jwt.claims', true)::json->>'share_token';
    IF token_id IS NOT NULL THEN
        INSERT INTO linkapet.access_audit (token_id, accessed_at, resource_table, resource_id)
        VALUES (token_id, NOW(), TG_TABLE_NAME, NEW.id::text)
        ON CONFLICT DO NOTHING;
    END IF;
    RETURN NEW;
END $$;
```

## Escopo de token

O campo `scope` é um array de tipos de evento autorizados:

| Valor | Acesso concedido |
|---|---|
| `['vaccines']` | Apenas registros de vacina |
| `['weight', 'exams']` | Peso e exames |
| `['all']` | Todos os tipos de evento |
| `[]` (vazio) | Nenhum acesso (token inativo) |

## MecanicaSmart — papéis equivalentes

| Papel linkapet | Equivalente MecanicaSmart | Acesso |
|---|---|---|
| owner | dono_oficina | OS, clientes, billing, mecânicos |
| co-tutor | atendente | OS, clientes (sem billing) |
| caretaker | mecanico | OS atribuídas a ele, sem clientes |
| viewer | cliente_externo | Apenas a própria OS via link público |

```sql
-- Exemplo: mecânico vê apenas OS atribuídas a ele
CREATE POLICY "mecanico_select_os"
ON os FOR SELECT
USING (
    mecanico_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM oficina_members
        WHERE user_id = auth.uid() AND role = 'dono_oficina'
    )
);
```

## Tabelas que devem ser públicas (com justificativa)

Algumas tabelas podem ter acesso público legítimo. Documente sempre:

```sql
-- Leitura pública de rankings do Senet — justificativa: dados de placar são públicos por design
-- sem PII, sem dados sensíveis, funcionalidade central do leaderboard
CREATE POLICY "public_select_rankings"
ON senet_rankings FOR SELECT
USING (true); -- justificativa: leaderboard público por design de produto
```

## Checklist de policy nova

- [ ] Usa `auth.uid()` para identificar o usuário (nunca parâmetro do cliente)
- [ ] `USING` restringe leitura; `WITH CHECK` restringe escrita — ambos necessários para UPDATE
- [ ] Policy de SELECT e INSERT são separadas (não use `FOR ALL`)
- [ ] Share-token verifica `expires_at > NOW()` E `revoked_at IS NULL`
- [ ] `USING (true)` tem comentário de justificativa na mesma linha ou na anterior
