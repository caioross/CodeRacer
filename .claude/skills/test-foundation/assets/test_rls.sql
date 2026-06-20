-- test_rls.sql — Template de testes RLS para schema linkapet (MedPet)
-- Adapte para MecanicaSmart e outros projetos Supabase.
--
-- Execute: psql $SUPABASE_DB_URL -f test_rls.sql -v ON_ERROR_STOP=1
-- NUNCA rode contra banco de produção. Use Supabase local (supabase start).
--
-- Convenção de asserções:
--   RAISE EXCEPTION se condição FALHAR → psql retorna exit code 1 → CI falha
--   RAISE NOTICE  se condição PASSAR  → log informativo

\set ON_ERROR_STOP on

-- ─────────────────────────────────────────────────────────────────────────────
-- SETUP: usuários de teste (criados e destruídos por este script)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  RAISE NOTICE '=== Iniciando testes RLS — schema linkapet ===';
END $$;

BEGIN;

-- Cria usuários de teste no schema auth (Supabase)
INSERT INTO auth.users (id, email, created_at, updated_at)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'tutor_a@test.local', NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000002', 'tutor_b@test.local', NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000003', 'viewer@test.local',  NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Cria pets de teste: pet_a pertence ao tutor_a, pet_b ao tutor_b
INSERT INTO linkapet.pets (id, owner_id, name, species)
VALUES
  ('pet-aaaa-0000', '00000000-0000-0000-0000-000000000001', 'Bolinha', 'dog'),
  ('pet-bbbb-0000', '00000000-0000-0000-0000-000000000002', 'Mingau',  'cat')
ON CONFLICT (id) DO NOTHING;

-- Cria eventos de saúde
INSERT INTO linkapet.health_events (id, pet_id, event_type, notes)
VALUES
  ('evt-aaaa-0001', 'pet-aaaa-0000', 'vaccine', 'Raiva 2026'),
  ('evt-bbbb-0001', 'pet-bbbb-0000', 'vaccine', 'V10 2026')
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- TESTE 1: owner vê apenas os próprios pets
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Simula JWT do tutor_a
  PERFORM set_config('request.jwt.claims',
    '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}',
    true);

  SELECT COUNT(*) INTO v_count
  FROM linkapet.pets;

  IF v_count != 1 THEN
    RAISE EXCEPTION 'FALHA T1: tutor_a deve ver 1 pet, viu % pets', v_count;
  END IF;
  RAISE NOTICE 'PASSOU T1: tutor_a vê apenas o próprio pet (count=1)';
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- TESTE 2: cross-tenant isolation — tutor_b não lê dados do tutor_a
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Simula JWT do tutor_b tentando ler pets do tutor_a
  PERFORM set_config('request.jwt.claims',
    '{"sub": "00000000-0000-0000-0000-000000000002", "role": "authenticated"}',
    true);

  SELECT COUNT(*) INTO v_count
  FROM linkapet.pets
  WHERE owner_id = '00000000-0000-0000-0000-000000000001';  -- pet do tutor_a

  IF v_count != 0 THEN
    RAISE EXCEPTION 'FALHA T2: tutor_b não deve ver pets do tutor_a (viu %)', v_count;
  END IF;
  RAISE NOTICE 'PASSOU T2: tutor_b não acessa pets do tutor_a';
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- TESTE 3: viewer com share-token só vê o pet com que foi compartilhado
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_share_token TEXT;
  v_count INTEGER;
BEGIN
  -- Cria share-token para pet_a com escopo 'vaccines' e expiração futura
  INSERT INTO linkapet.share_tokens (id, pet_id, scope, expires_at, token_hash)
  VALUES (
    'tok-aaaa-0001',
    'pet-aaaa-0000',
    ARRAY['vaccines'],
    NOW() + INTERVAL '1 hour',
    encode(sha256('test-token-value' || 'PEPPER_PLACEHOLDER'), 'hex')
  ) ON CONFLICT (id) DO NOTHING;

  -- Simula request de viewer com o token
  PERFORM set_config('request.jwt.claims',
    '{"sub": "00000000-0000-0000-0000-000000000003", "role": "authenticated", "share_token": "tok-aaaa-0001"}',
    true);

  -- Viewer deve ver eventos de vacina do pet_a
  SELECT COUNT(*) INTO v_count
  FROM linkapet.health_events
  WHERE pet_id = 'pet-aaaa-0000' AND event_type = 'vaccine';

  IF v_count = 0 THEN
    RAISE EXCEPTION 'FALHA T3: viewer com token de vacinas não vê eventos de vacina';
  END IF;
  RAISE NOTICE 'PASSOU T3: viewer vê eventos autorizados pelo share-token';
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- TESTE 4: viewer NÃO acessa dados de outro pet (cross-tenant via token)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Ainda simulando o viewer com token do pet_a
  PERFORM set_config('request.jwt.claims',
    '{"sub": "00000000-0000-0000-0000-000000000003", "role": "authenticated", "share_token": "tok-aaaa-0001"}',
    true);

  -- Tenta acessar dados do pet_b (não incluído no token)
  SELECT COUNT(*) INTO v_count
  FROM linkapet.health_events
  WHERE pet_id = 'pet-bbbb-0000';

  IF v_count != 0 THEN
    RAISE EXCEPTION 'FALHA T4: viewer não deve acessar dados de outro pet (vazou %)!', v_count;
  END IF;
  RAISE NOTICE 'PASSOU T4: viewer com token do pet_a não acessa pet_b';
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- TESTE 5: token expirado é rejeitado
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Cria token expirado
  INSERT INTO linkapet.share_tokens (id, pet_id, scope, expires_at, token_hash)
  VALUES (
    'tok-expired-0001',
    'pet-aaaa-0000',
    ARRAY['vaccines'],
    NOW() - INTERVAL '1 hour',  -- expirado no passado
    encode(sha256('expired-token' || 'PEPPER_PLACEHOLDER'), 'hex')
  ) ON CONFLICT (id) DO NOTHING;

  PERFORM set_config('request.jwt.claims',
    '{"sub": "00000000-0000-0000-0000-000000000003", "role": "authenticated", "share_token": "tok-expired-0001"}',
    true);

  SELECT COUNT(*) INTO v_count
  FROM linkapet.health_events
  WHERE pet_id = 'pet-aaaa-0000';

  IF v_count != 0 THEN
    RAISE EXCEPTION 'FALHA T5: token expirado não deve conceder acesso (viu % eventos)', v_count;
  END IF;
  RAISE NOTICE 'PASSOU T5: token expirado é rejeitado';
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- CLEANUP: rollback de tudo — testes não deixam rastro
-- ─────────────────────────────────────────────────────────────────────────────
ROLLBACK;

DO $$
BEGIN
  RAISE NOTICE '=== Todos os testes RLS passaram. Isolamento cross-tenant verificado. ===';
END $$;
