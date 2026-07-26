-- CodeRacer · allowlist de language/difficulty (cinto e suspensório do banco)
-- A validação primária é server-side (src/lib/room.ts, rotas de sala). Estas
-- constraints são a segunda linha de defesa: impedem difficulty fora do enum e
-- um `language` gigante (storage abuse) mesmo que a fronteira seja contornada.
--
-- Idempotente: cada constraint só é criada se ainda não existir.
-- NOT VALID de propósito: valida INSERT/UPDATE novos sem falhar a aplicação por
-- causa de linhas legadas gravadas antes da allowlist. O dono pode limpar o dado
-- histórico e rodar `alter table ... validate constraint ...` depois, se quiser.

do $$
declare
  t   text;
  tbl text;
begin
  foreach t in array array['rooms', 'matches', 'scores']
  loop
    tbl := format('public.%I', t);

    -- difficulty ∈ {easy, medium, hard}
    if not exists (
      select 1 from pg_constraint
      where conrelid = tbl::regclass
        and conname = format('%s_difficulty_allowed', t)
    ) then
      execute format(
        'alter table %s add constraint %I check (difficulty in (''easy'',''medium'',''hard'')) not valid',
        tbl, format('%s_difficulty_allowed', t)
      );
    end if;

    -- teto de comprimento de language (nomes suportados têm ≤ 10 chars; 32 é folga)
    if not exists (
      select 1 from pg_constraint
      where conrelid = tbl::regclass
        and conname = format('%s_language_len', t)
    ) then
      execute format(
        'alter table %s add constraint %I check (char_length(language) <= 32) not valid',
        tbl, format('%s_language_len', t)
      );
    end if;
  end loop;
end $$;
