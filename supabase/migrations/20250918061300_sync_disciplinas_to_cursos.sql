-- normalized migration version id
-- apps/web/supabase/migrations/20250918_sync_disciplinas_to_cursos.sql
-- If legacy table public.disciplinas exists, mirror changes into public.cursos
-- to ease deprecation while the app migrates.

do $$
begin
  if to_regclass('public.disciplinas') is not null and to_regclass('public.cursos') is not null then
    -- Comment for awareness
    begin
      comment on table public.disciplinas is 'LEGACY: mirrored into public.cursos via triggers. Prefer public.cursos.';
    exception when others then null;
    end;

    -- Helper function to generate a simple codigo from id
    execute $f$create or replace function public._curso_codigo_from_uuid(uuid)
    returns text language sql immutable as $b$
      select substr(md5(($1)::text), 1, 8)
    $b$;$f$;

    -- Trigger function: after insert on disciplinas -> upsert into cursos with same id
    execute $f$create or replace function public.trg_disciplinas_ai_sync_cursos()
    returns trigger language plpgsql as $b$
    begin
      insert into public.cursos (id, escola_id, codigo, nome)
      values (new.id, new.escola_id, public._curso_codigo_from_uuid(new.id), new.nome)
      on conflict (id) do update set
        escola_id = excluded.escola_id,
        nome = excluded.nome
      ;
      return new;
    end;
    $b$;$f$;

    -- Trigger function: after update on disciplinas -> update cursos by id
    execute $f$create or replace function public.trg_disciplinas_au_sync_cursos()
    returns trigger language plpgsql as $b$
    begin
      update public.cursos set escola_id = new.escola_id, nome = new.nome where id = new.id;
      return new;
    end;
    $b$;$f$;

    -- Trigger function: after delete on disciplinas -> delete from cursos by id
    execute $f$create or replace function public.trg_disciplinas_ad_sync_cursos()
    returns trigger language plpgsql as $b$
    begin
      delete from public.cursos where id = old.id;
      return old;
    end;
    $b$;$f$;

    -- Create triggers if not present
    if not exists (select 1 from pg_trigger where tgname = 'trg_disciplinas_ai_sync_cursos') then
      execute 'create trigger trg_disciplinas_ai_sync_cursos after insert on public.disciplinas for each row execute function public.trg_disciplinas_ai_sync_cursos()';
    end if;
    if not exists (select 1 from pg_trigger where tgname = 'trg_disciplinas_au_sync_cursos') then
      execute 'create trigger trg_disciplinas_au_sync_cursos after update on public.disciplinas for each row execute function public.trg_disciplinas_au_sync_cursos()';
    end if;
    if not exists (select 1 from pg_trigger where tgname = 'trg_disciplinas_ad_sync_cursos') then
      execute 'create trigger trg_disciplinas_ad_sync_cursos after delete on public.disciplinas for each row execute function public.trg_disciplinas_ad_sync_cursos()';
    end if;
  end if;
end$$;
