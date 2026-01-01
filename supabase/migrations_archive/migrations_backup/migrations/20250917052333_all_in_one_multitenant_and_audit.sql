-- db/migrations/20250917_all_in_one_multitenant_and_audit.sql
-- Consolidado: tabelas (turmas, disciplinas), RLS/policies, auditorias, views, função RPC.

-- =========================================
-- Extensões necessárias
-- =========================================
create extension if not exists "pgcrypto";

-- =========================================
-- TABELAS DE DOMÍNIO (multi-tenant)
-- =========================================

-- TURMAS (idempotente)
create table if not exists public.turmas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  escola_id uuid not null references public.escolas(id) on delete cascade,
  created_at timestamptz default now()
);

-- DISCIPLINAS (idempotente)
create table if not exists public.disciplinas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  escola_id uuid not null references public.escolas(id) on delete cascade,
  created_at timestamptz default now()
);

-- =========================================
-- RLS + POLICIES (multi-tenant por profiles.escola_id)
-- =========================================

-- TURMAS
alter table public.turmas enable row level security;

drop policy if exists "select_own_turmas" on public.turmas;
drop policy if exists "insert_own_turmas" on public.turmas;
drop policy if exists "update_own_turmas" on public.turmas;
drop policy if exists "delete_own_turmas" on public.turmas;

create policy "select_own_turmas"
on public.turmas
for select
using (
  escola_id = (
    select escola_id from public.profiles where user_id = auth.uid()
  )
);

create policy "insert_own_turmas"
on public.turmas
for insert
with check (
  escola_id = (
    select escola_id from public.profiles where user_id = auth.uid()
  )
);

create policy "update_own_turmas"
on public.turmas
for update
using (
  escola_id = (
    select escola_id from public.profiles where user_id = auth.uid()
  )
);

create policy "delete_own_turmas"
on public.turmas
for delete
using (
  escola_id = (
    select escola_id from public.profiles where user_id = auth.uid()
  )
);

grant all on public.turmas to authenticated;
grant select on public.turmas to anon;

-- DISCIPLINAS
alter table public.disciplinas enable row level security;

drop policy if exists "select_own_disciplinas" on public.disciplinas;
drop policy if exists "insert_own_disciplinas" on public.disciplinas;
drop policy if exists "update_own_disciplinas" on public.disciplinas;
drop policy if exists "delete_own_disciplinas" on public.disciplinas;

create policy "select_own_disciplinas"
on public.disciplinas
for select
using (
  escola_id = (
    select escola_id from public.profiles where user_id = auth.uid()
  )
);

create policy "insert_own_disciplinas"
on public.disciplinas
for insert
with check (
  escola_id = (
    select escola_id from public.profiles where user_id = auth.uid()
  )
);

create policy "update_own_disciplinas"
on public.disciplinas
for update
using (
  escola_id = (
    select escola_id from public.profiles where user_id = auth.uid()
  )
);

create policy "delete_own_disciplinas"
on public.disciplinas
for delete
using (
  escola_id = (
    select escola_id from public.profiles where user_id = auth.uid()
  )
);

grant all on public.disciplinas to authenticated;
grant select on public.disciplinas to anon;

-- =========================================
-- AUDITORIAS
-- =========================================

-- ESCOLAS (ajuste de schema + triggers)
create table if not exists public.escola_auditoria (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references public.escolas(id) on delete cascade,
  acao text not null,         -- 'criada' | 'atualizada' | 'deletada' | 'reutilizada'
  mensagem text,
  criado_em timestamptz default now()
);

-- garantir coluna dados (snapshot)
alter table public.escola_auditoria
add column if not exists dados jsonb;

-- preencher registros antigos que não tenham snapshot básico
update public.escola_auditoria
set dados = jsonb_build_object(
  'escola_id', escola_id,
  'acao', acao,
  'mensagem', mensagem,
  'criado_em', criado_em
)
where dados is null;

-- função de log para escola_auditoria (cria/atualiza/deleta por triggers)
create or replace function public.log_escola_auditoria()
returns trigger
language plpgsql
security definer
as $$
begin
  if TG_OP = 'INSERT' then
    insert into public.escola_auditoria (escola_id, acao, mensagem, dados)
    values (NEW.id, 'criada', 'Escola criada', to_jsonb(NEW));
    return NEW;
  elsif TG_OP = 'UPDATE' then
    insert into public.escola_auditoria (escola_id, acao, mensagem, dados)
    values (NEW.id, 'atualizada', 'Escola atualizada', to_jsonb(NEW));
    return NEW;
  elsif TG_OP = 'DELETE' then
    insert into public.escola_auditoria (escola_id, acao, mensagem, dados)
    values (OLD.id, 'deletada', 'Escola removida', to_jsonb(OLD));
    return OLD;
  end if;
  return null;
end;
$$;

-- triggers na tabela escolas
drop trigger if exists escolas_audit_insert on public.escolas;
drop trigger if exists escolas_audit_update on public.escolas;
drop trigger if exists escolas_audit_delete on public.escolas;

create trigger escolas_audit_insert
after insert on public.escolas
for each row execute function public.log_escola_auditoria();

create trigger escolas_audit_update
after update on public.escolas
for each row execute function public.log_escola_auditoria();

create trigger escolas_audit_delete
after delete on public.escolas
for each row execute function public.log_escola_auditoria();

-- TURMAS auditoria
create table if not exists public.turmas_auditoria (
  id uuid primary key default gen_random_uuid(),
  turma_id uuid not null references public.turmas(id) on delete cascade,
  escola_id uuid not null references public.escolas(id) on delete cascade,
  acao text not null,   -- 'criada' | 'atualizada' | 'deletada'
  dados jsonb,
  criado_em timestamptz default now()
);

create or replace function public.log_turma_auditoria()
returns trigger
language plpgsql
security definer
as $$
begin
  if TG_OP = 'INSERT' then
    insert into public.turmas_auditoria (turma_id, escola_id, acao, dados)
    values (NEW.id, NEW.escola_id, 'criada', to_jsonb(NEW));
    return NEW;
  elsif TG_OP = 'UPDATE' then
    insert into public.turmas_auditoria (turma_id, escola_id, acao, dados)
    values (NEW.id, NEW.escola_id, 'atualizada', to_jsonb(NEW));
    return NEW;
  elsif TG_OP = 'DELETE' then
    insert into public.turmas_auditoria (turma_id, escola_id, acao, dados)
    values (OLD.id, OLD.escola_id, 'deletada', to_jsonb(OLD));
    return OLD;
  end if;
  return null;
end;
$$;

drop trigger if exists turmas_audit_insert on public.turmas;
drop trigger if exists turmas_audit_update on public.turmas;
drop trigger if exists turmas_audit_delete on public.turmas;

create trigger turmas_audit_insert
after insert on public.turmas
for each row execute function public.log_turma_auditoria();

create trigger turmas_audit_update
after update on public.turmas
for each row execute function public.log_turma_auditoria();

create trigger turmas_audit_delete
after delete on public.turmas
for each row execute function public.log_turma_auditoria();

-- DISCIPLINAS auditoria
create table if not exists public.disciplinas_auditoria (
  id uuid primary key default gen_random_uuid(),
  disciplina_id uuid not null references public.disciplinas(id) on delete cascade,
  escola_id uuid not null references public.escolas(id) on delete cascade,
  acao text not null,  -- 'criada' | 'atualizada' | 'deletada'
  dados jsonb,
  criado_em timestamptz default now()
);

create or replace function public.log_disciplina_auditoria()
returns trigger
language plpgsql
security definer
as $$
begin
  if TG_OP = 'INSERT' then
    insert into public.disciplinas_auditoria (disciplina_id, escola_id, acao, dados)
    values (NEW.id, NEW.escola_id, 'criada', to_jsonb(NEW));
    return NEW;
  elsif TG_OP = 'UPDATE' then
    insert into public.disciplinas_auditoria (disciplina_id, escola_id, acao, dados)
    values (NEW.id, NEW.escola_id, 'atualizada', to_jsonb(NEW));
    return NEW;
  elsif TG_OP = 'DELETE' then
    insert into public.disciplinas_auditoria (disciplina_id, escola_id, acao, dados)
    values (OLD.id, OLD.escola_id, 'deletada', to_jsonb(OLD));
    return OLD;
  end if;
  return null;
end;
$$;

drop trigger if exists disciplinas_audit_insert on public.disciplinas;
drop trigger if exists disciplinas_audit_update on public.disciplinas;
drop trigger if exists disciplinas_audit_delete on public.disciplinas;

create trigger disciplinas_audit_insert
after insert on public.disciplinas
for each row execute function public.log_disciplina_auditoria();

create trigger disciplinas_audit_update
after update on public.disciplinas
for each row execute function public.log_disciplina_auditoria();

create trigger disciplinas_audit_delete
after delete on public.disciplinas
for each row execute function public.log_disciplina_auditoria();

-- =========================================
-- RPC create_escola_with_admin (ajustada)
-- - evita duplicidade de NIF
-- - NÃO insere log 'criada' (deixa para trigger)
-- - insere log 'reutilizada' quando reaproveita
-- =========================================
create or replace function public.create_escola_with_admin(
  p_nome text,
  p_nif text default null,
  p_endereco text default null,
  p_admin_email text default null,
  p_admin_telefone text default null,
  p_admin_nome text default null
)
returns json
language plpgsql
security definer
as $$
declare
  v_escola_id uuid;
  v_escola_nome text;
  v_msg text := '';
  v_user_id uuid;
  v_user_escola_id uuid;
  v_exists int;
  v_reutilizada boolean := false;
begin
  if p_nome is null or trim(p_nome) = '' then
    raise exception 'nome obrigatório' using errcode = 'P0001';
  end if;

  if p_nif is not null then
    p_nif := regexp_replace(p_nif, '\\D', '', 'g');
    if length(p_nif) <> 9 then
      raise exception 'NIF inválido (9 dígitos)' using errcode = 'P0001';
    end if;

    -- verifica existência por NIF
    select id, nome
    into v_escola_id, v_escola_nome
    from public.escolas
    where nif = p_nif
    limit 1;

    if found then
      v_reutilizada := true;
      v_msg := 'ℹ️ Escola já existente com este NIF';

      -- log específico de reutilização (não há trigger para isso)
      insert into public.escola_auditoria (escola_id, acao, mensagem, dados)
      values (v_escola_id, 'reutilizada', 'Tenant reutilizado em criação via RPC', jsonb_build_object('nif', p_nif, 'nome_solicitado', p_nome));
    else
      insert into public.escolas (nome, nif, endereco, status, onboarding_finalizado)
      values (
        trim(p_nome),
        nullif(p_nif, ''),
        nullif(trim(coalesce(p_endereco, '')), ''),
        'ativa',
        false
      )
      returning id, nome into v_escola_id, v_escola_nome;
      -- log 'criada' sai pela trigger de escolas
    end if;
  else
    -- sem NIF informado, cria sempre
    insert into public.escolas (nome, nif, endereco, status, onboarding_finalizado)
    values (
      trim(p_nome),
      null,
      nullif(trim(coalesce(p_endereco, '')), ''),
      'ativa',
      false
    )
    returning id, nome into v_escola_id, v_escola_nome;
    -- trigger registra 'criada'
  end if;

  -- vínculo opcional do admin (se existe profile por email)
  if coalesce(trim(p_admin_email), '') <> '' then
    begin
      select user_id, escola_id
        into v_user_id, v_user_escola_id
      from public.profiles
      where email = lower(trim(p_admin_email))
      limit 1;

      if found and v_user_id is not null then
        update public.profiles
           set telefone = coalesce(regexp_replace(coalesce(p_admin_telefone, ''), '\\D', '', 'g'), telefone),
               nome = coalesce(nullif(trim(coalesce(p_admin_nome, '')), ''), nome),
               role = 'admin'::public.user_role,
               escola_id = coalesce(escola_id, v_escola_id)
         where user_id = v_user_id;

        select 1 into v_exists
        from public.escola_administradores
        where escola_id = v_escola_id and user_id = v_user_id
        limit 1;

        if not found then
          insert into public.escola_administradores (escola_id, user_id, cargo)
          values (v_escola_id, v_user_id, 'administrador_principal');
        end if;

        v_msg := v_msg || ' ✅ Administrador vinculado: ' || lower(trim(p_admin_email));
      else
        v_msg := v_msg || ' ⚠️ Usuário não encontrado. Vincule manualmente depois.';
      end if;
    exception when others then
      v_msg := v_msg || ' ⚠️ Erro ao vincular administrador.';
    end;
  end if;

  return json_build_object(
    'ok', true,
    'escolaId', v_escola_id,
    'escolaNome', v_escola_nome,
    'reutilizada', v_reutilizada,
    'mensagemAdmin', coalesce(v_msg, '')
  );
end;
$$;

grant execute on function public.create_escola_with_admin(text, text, text, text, text, text)
to anon, authenticated;

-- =========================================
-- VIEW unificada de auditoria
-- =========================================
create or replace view public.auditoria_unificada as
select 
  'escola' as tipo,
  a.id as log_id,
  a.escola_id,
  e.nome as entidade_nome,
  a.acao,
  a.criado_em,
  a.dados
from public.escola_auditoria a
join public.escolas e on e.id = a.escola_id

union all

select 
  'turma' as tipo,
  a.id as log_id,
  a.escola_id,
  t.nome as entidade_nome,
  a.acao,
  a.criado_em,
  a.dados
from public.turmas_auditoria a
join public.turmas t on t.id = a.turma_id

union all

select 
  'disciplina' as tipo,
  a.id as log_id,
  a.escola_id,
  d.nome as entidade_nome,
  a.acao,
  a.criado_em,
  a.dados
from public.disciplinas_auditoria a
join public.disciplinas d on d.id = a.disciplina_id;

grant select on public.auditoria_unificada to authenticated;
grant select on public.auditoria_unificada to anon;

-- =========================================
-- VIEW de RELATÓRIO resumido por escola
-- (criada/reutilizada + últimas criações)
-- =========================================
create or replace view public.auditoria_resumo_escolas as
with base as (
  select
    e.id as escola_id,
    e.nome,
    e.nif
  from public.escolas e
)
select
  b.escola_id,
  b.nome as escola_nome,
  b.nif,
  coalesce((
    select count(*) from public.escola_auditoria ea
    where ea.escola_id = b.escola_id and ea.acao = 'criada'
  ),0) as vezes_criada,
  coalesce((
    select count(*) from public.escola_auditoria ea
    where ea.escola_id = b.escola_id and ea.acao = 'reutilizada'
  ),0) as vezes_reutilizada,
  (select min(ea.criado_em) from public.escola_auditoria ea where ea.escola_id = b.escola_id) as primeira_acao,
  (select max(ea.criado_em) from public.escola_auditoria ea where ea.escola_id = b.escola_id) as ultima_acao,
  (
    select jsonb_agg(jsonb_build_object('nome', nome, 'criado_em', criado_em) order by criado_em desc)
    from (
      select t.nome, ta.criado_em
      from public.turmas_auditoria ta
      join public.turmas t on t.id = ta.turma_id
      where ta.escola_id = b.escola_id and ta.acao = 'criada'
      order by ta.criado_em desc
      limit 3
    ) as turmas_sub
  ) as ultimas_turmas,
  (
    select jsonb_agg(jsonb_build_object('nome', nome, 'criado_em', criado_em) order by criado_em desc)
    from (
      select d.nome, da.criado_em
      from public.disciplinas_auditoria da
      join public.disciplinas d on d.id = da.disciplina_id
      where da.escola_id = b.escola_id and da.acao = 'criada'
      order by da.criado_em desc
      limit 3
    ) as disciplinas_sub
  ) as ultimas_disciplinas
from base b;

grant select on public.auditoria_resumo_escolas to authenticated;
grant select on public.auditoria_resumo_escolas to anon;
