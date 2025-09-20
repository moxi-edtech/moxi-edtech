-- apps/web/supabase/migrations/20250918_drop_legacy_disciplinas.sql
-- Removes legacy disciplinas artifacts now that the app uses cursos.

-- 1) Drop auditing table first if it exists (it references disciplinas)
do $$
begin
  if to_regclass('public.disciplinas_auditoria') is not null then
    drop table public.disciplinas_auditoria;
  end if;
end$$;

-- 2) Drop sync triggers (created earlier) and the disciplinas table
do $$
begin
  if to_regclass('public.disciplinas') is not null then
    -- Drop triggers if present
    if exists (select 1 from pg_trigger where tgname = 'trg_disciplinas_ai_sync_cursos') then
      drop trigger trg_disciplinas_ai_sync_cursos on public.disciplinas;
    end if;
    if exists (select 1 from pg_trigger where tgname = 'trg_disciplinas_au_sync_cursos') then
      drop trigger trg_disciplinas_au_sync_cursos on public.disciplinas;
    end if;
    if exists (select 1 from pg_trigger where tgname = 'trg_disciplinas_ad_sync_cursos') then
      drop trigger trg_disciplinas_ad_sync_cursos on public.disciplinas;
    end if;

    -- Finally drop the table
    drop table public.disciplinas;
  end if;
end$$;

-- 3) Drop helper/trigger functions if they exist
do $$
begin
  -- Drop trigger functions
  begin
    drop function if exists public.trg_disciplinas_ai_sync_cursos();
  exception when undefined_function then
    null;
  end;
  begin
    drop function if exists public.trg_disciplinas_au_sync_cursos();
  exception when undefined_function then
    null;
  end;
  begin
    drop function if exists public.trg_disciplinas_ad_sync_cursos();
  exception when undefined_function then
    null;
  end;
  -- Drop helper
  begin
    drop function if exists public._curso_codigo_from_uuid(uuid);
  exception when undefined_function then
    null;
  end;
end$$;

