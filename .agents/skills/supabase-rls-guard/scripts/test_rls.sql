-- test_rls.sql — Testes de isolamento RLS para schema linkapet (MedPet)
-- Adapte os nomes de tabela e papéis para MecanicaSmart e outros projetos.
--
-- Execute: psql $SUPABASE_DB_URL -f test_rls.sql -v ON_ERROR_STOP=1
--
-- NUNCA rode contra banco de produção. Use:
--   supabase start          (banco local)
--   supabase db reset       (limpa e aplica migrations do zero)
--
-- Convenção: RAISE EXCEPTION em falha → exit code 1 → CI falha imediatamente.

\set ON_ERROR_STOP on

DO $$ BEGIN RAISE NOTICE '=== Testes RLS — schema linkapet ==='; END $$;

BEGIN;

-- ─── Setup: usuários e dados de teste ────────────────────────────────────────

-- Usuários de teste
INSERT INTO auth.users (id, email, created_at, updated_at) VALUES
    ('aaaaaaaa-0000-0000-0000-000000000001', 'tutor_a@rls.test', NOW(), NOW()),
    ('bbbbbbbb-0000-0000-0000-000000000002', 'tutor_b@rls.test', NOW(), NOW()),
    ('cccccccc-0000-0000-0000-000000000003', 'viewer@rls.test',  NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Pets: pet_a pertence ao tutor_a; pet_b ao tutor_b
INSERT INTO linkapet.pets (id, owner_id, name, species) VALUES
    ('pet-aaaa-rls1', 'aaaaaaaa-0000-0000-0000-000000000001', 'Bolinha', 'dog'),
    ('pet-bbbb-rls1', 'bbbbbbbb-0000-0000-0000-000000000002', 'Mingau',  'cat')
ON CONFLICT (id) DO NOTHING;

-- Eventos de saúde
INSERT INTO linkapet.health_events (id, pet_id, event_type, notes) VALUES
    ('evt-aaaa-rls1', 'pet-aaaa-rls1', 'vaccine', 'Raiva 2026'),
    ('evt-bbbb-rls1', 'pet-bbbb-rls1', 'vaccine', 'V10 2026')
ON CONFLICT (id) DO NOTHING;

-- Share-token válido (expira em 1h) para pet_a, escopo vaccines
INSERT INTO linkapet.share_tokens (id, pet_id, scope, expires_at, token_hash) VALUES
    ('tok-valid-rls1', 'pet-aaaa-rls1', ARRAY['vaccines'],
     NOW() + INTERVAL '1 hour',
     encode(sha256(('rls-test-token-valid' || current_setting('app.token_pepper', true))::bytea), 'hex'))
ON CONFLICT (id) DO NOTHING;

-- Share-token expirado para pet_a
INSERT INTO linkapet.share_tokens (id, pet_id, scope, expires_at, token_hash) VALUES
    ('tok-expired-rls1', 'pet-aaaa-rls1', ARRAY['vaccines'],
     NOW() - INTERVAL '1 hour',
     encode(sha256(('rls-test-token-expired' || current_setting('app.token_pepper', true))::bytea), 'hex'))
ON CONFLICT (id) DO NOTHING;

-- ─── T1: owner vê apenas seus próprios pets ───────────────────────────────────
DO $$
DECLARE v_count INTEGER;
BEGIN
    PERFORM set_config('request.jwt.claims',
        '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
    SELECT COUNT(*) INTO v_count FROM linkapet.pets;
    IF v_count != 1 THEN
        RAISE EXCEPTION 'FALHA T1: tutor_a deve ver 1 pet, viu %', v_count;
    END IF;
    RAISE NOTICE 'PASSOU T1: owner vê apenas seus pets';
END $$;

-- ─── T2: cross-tenant — tutor_b não lê pets do tutor_a ───────────────────────
DO $$
DECLARE v_count INTEGER;
BEGIN
    PERFORM set_config('request.jwt.claims',
        '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}', true);
    SELECT COUNT(*) INTO v_count
    FROM linkapet.pets
    WHERE owner_id = 'aaaaaaaa-0000-0000-0000-000000000001';
    IF v_count != 0 THEN
        RAISE EXCEPTION 'FALHA T2: tutor_b não deve ver pets do tutor_a (vazou %)', v_count;
    END IF;
    RAISE NOTICE 'PASSOU T2: cross-tenant isolation pets';
END $$;

-- ─── T3: cross-tenant — tutor_b não lê health_events do tutor_a ──────────────
DO $$
DECLARE v_count INTEGER;
BEGIN
    PERFORM set_config('request.jwt.claims',
        '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}', true);
    SELECT COUNT(*) INTO v_count
    FROM linkapet.health_events
    WHERE pet_id = 'pet-aaaa-rls1';
    IF v_count != 0 THEN
        RAISE EXCEPTION 'FALHA T3: tutor_b não deve ver eventos de pet do tutor_a (vazou %)', v_count;
    END IF;
    RAISE NOTICE 'PASSOU T3: cross-tenant isolation health_events';
END $$;

-- ─── T4: viewer com share-token válido vê eventos autorizados ────────────────
DO $$
DECLARE v_count INTEGER;
BEGIN
    PERFORM set_config('request.jwt.claims',
        '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated","share_token":"tok-valid-rls1"}', true);
    SELECT COUNT(*) INTO v_count
    FROM linkapet.health_events
    WHERE pet_id = 'pet-aaaa-rls1' AND event_type = 'vaccine';
    IF v_count = 0 THEN
        RAISE EXCEPTION 'FALHA T4: viewer com token válido deve ver eventos de vacina';
    END IF;
    RAISE NOTICE 'PASSOU T4: viewer com token válido acessa escopo autorizado';
END $$;

-- ─── T5: viewer com token válido de pet_a NÃO vê dados de pet_b ──────────────
DO $$
DECLARE v_count INTEGER;
BEGIN
    PERFORM set_config('request.jwt.claims',
        '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated","share_token":"tok-valid-rls1"}', true);
    SELECT COUNT(*) INTO v_count
    FROM linkapet.health_events
    WHERE pet_id = 'pet-bbbb-rls1';
    IF v_count != 0 THEN
        RAISE EXCEPTION 'FALHA T5: viewer não deve acessar dados de outro pet via token (VAZAMENTO: %)', v_count;
    END IF;
    RAISE NOTICE 'PASSOU T5: share-token não permite acesso cross-tenant';
END $$;

-- ─── T6: token expirado é rejeitado ──────────────────────────────────────────
DO $$
DECLARE v_count INTEGER;
BEGIN
    PERFORM set_config('request.jwt.claims',
        '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated","share_token":"tok-expired-rls1"}', true);
    SELECT COUNT(*) INTO v_count
    FROM linkapet.health_events
    WHERE pet_id = 'pet-aaaa-rls1';
    IF v_count != 0 THEN
        RAISE EXCEPTION 'FALHA T6: token expirado não deve conceder acesso (vazou % eventos)', v_count;
    END IF;
    RAISE NOTICE 'PASSOU T6: token expirado rejeitado';
END $$;

-- ─── T7: viewer sem token não acessa nenhum dado ─────────────────────────────
DO $$
DECLARE v_count INTEGER;
BEGIN
    PERFORM set_config('request.jwt.claims',
        '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}', true);
    SELECT COUNT(*) INTO v_count FROM linkapet.pets;
    IF v_count != 0 THEN
        RAISE EXCEPTION 'FALHA T7: viewer sem token não deve ver nenhum pet (viu %)', v_count;
    END IF;
    RAISE NOTICE 'PASSOU T7: viewer sem token não acessa dados';
END $$;

-- ─── Cleanup: rollback — sem rastro no banco ──────────────────────────────────
ROLLBACK;

DO $$ BEGIN
    RAISE NOTICE '=== Todos os testes RLS passaram. Isolamento cross-tenant verificado. ===';
END $$;
