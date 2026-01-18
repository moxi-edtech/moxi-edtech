-- ============================================================
-- KLASSE — Admissão Finalization (Reject, Convert & Core Fixes)
-- - Fix legacy AuthZ functions (escola_usuarios -> escola_users)
-- - Overload: confirmar_matricula_core(p_candidatura_id uuid)
-- - RPCs: admissao_reject, admissao_convert_to_matricula
-- - Trigger: Status change guard
-- ============================================================

begin;

-- 1) Fix Legacy AuthZ Functions (Redirect to escola_users)
create or replace function public.is_escola_admin(p_escola_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.escola_users
    WHERE escola_id = p_escola_id
      AND user_id = auth.uid()
      AND papel IN ('admin', 'admin_escola')
  );
END;
$$;

create or replace function public.is_escola_member(p_escola_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.escola_users
    WHERE escola_id = p_escola_id
      AND user_id = auth.uid()
  );
END;
$$;

create or replace function public.is_escola_diretor(p_escola_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.escola_users
    WHERE escola_id = p_escola_id
      AND user_id = auth.uid()
      AND papel = 'diretor'
  );
END;
$$;


-- 2) Overload: confirmar_matricula_core(p_candidatura_id uuid)
-- Esta função orquestra a criação do aluno e chama o core de matrícula.
create or replace function public.confirmar_matricula_core(p_candidatura_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cand record;
  v_aluno_id uuid;
  v_matricula_id uuid;
  v_matricula_numero bigint;
begin
  -- Lock candidatura
  select * into v_cand
  from public.candidaturas
  where id = p_candidatura_id
  for update;

  if v_cand.id is null then
    raise exception 'Candidatura não encontrada';
  end if;

  -- 1. Garantir Aluno
  if v_cand.aluno_id is not null then
    v_aluno_id := v_cand.aluno_id;
  else
    insert into public.alunos (
      escola_id,
      nome,
      bi_numero,
      telefone_responsavel,
      email,
      status,
      created_at
    ) values (
      v_cand.escola_id,
      coalesce(v_cand.nome_candidato, v_cand.dados_candidato->>'nome_candidato'),
      v_cand.dados_candidato->>'bi_numero',
      v_cand.dados_candidato->>'telefone',
      v_cand.dados_candidato->>'email',
      'ativo',
      now()
    )
    returning id into v_aluno_id;

    update public.candidaturas
    set aluno_id = v_aluno_id
    where id = p_candidatura_id;
  end if;

  -- 2. Chamar Core (BigInt version)
  v_matricula_numero := public.confirmar_matricula_core(
    v_aluno_id,
    v_cand.ano_letivo,
    v_cand.turma_preferencial_id,
    v_cand.matricula_id
  );

  -- 3. Recuperar UUID da Matrícula criada/atualizada
  select m.id into v_matricula_id
  from public.matriculas m
  where m.aluno_id = v_aluno_id
    and m.ano_letivo = v_cand.ano_letivo
    and m.escola_id = v_cand.escola_id
    and m.numero_matricula = v_matricula_numero;

  return v_matricula_id;
end;
$$;


-- 3) Candidaturas: Colunas e Constraints
alter table public.candidaturas
  add column if not exists matricula_id uuid,
  add column if not exists matriculado_em timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'candidaturas_matricula_id_unique'
  ) then
    alter table public.candidaturas add constraint candidaturas_matricula_id_unique unique (matricula_id);
  end if;
end $$;

create index if not exists ix_candidaturas_matricula_id on public.candidaturas (matricula_id);


-- 4) RPC: admissao_reject
create or replace function public.admissao_reject(
  p_escola_id uuid,
  p_candidatura_id uuid,
  p_motivo text,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.current_tenant_escola_id();
  v_cand record;
  v_from text;
  v_to text := 'rejeitada';
begin
  if p_motivo is null or length(trim(p_motivo)) < 3 then
    raise exception 'Motivo de rejeição é obrigatório.';
  end if;

  -- Security Check
  if p_escola_id is null or p_escola_id <> v_tenant then
    raise exception 'Acesso negado: escola inválida.';
  end if;

  if not public.user_has_role_in_school(p_escola_id, array['secretaria','admin','admin_escola','staff_admin']) then
    raise exception 'Acesso negado: permissões insuficientes.';
  end if;

  -- Lock
  select status, escola_id into v_cand
  from public.candidaturas
  where id = p_candidatura_id and escola_id = v_tenant
  for update;

  if v_cand.status is null then
    raise exception 'Candidatura não encontrada.';
  end if;

  v_from := v_cand.status;

  if v_from = 'rejeitada' then
    return p_candidatura_id;
  end if;

  if v_from not in ('submetida','em_analise','aprovada') then
    raise exception 'Transição inválida: % -> rejeitada', v_from;
  end if;

  -- RPC internal bypass for status change guard
  perform set_config('app.rpc_internal', 'on', true);

  update public.candidaturas
  set status = v_to, updated_at = now()
  where id = p_candidatura_id;

  insert into public.candidaturas_status_log (
    escola_id, candidatura_id, from_status, to_status, motivo, metadata
  ) values (
    p_escola_id, p_candidatura_id, v_from, v_to, trim(p_motivo), p_metadata
  );

  return p_candidatura_id;
end;
$$;

revoke all on function public.admissao_reject(uuid, uuid, text, jsonb) from public;
grant execute on function public.admissao_reject(uuid, uuid, text, jsonb) to authenticated;


-- 5) RPC: admissao_convert_to_matricula
create or replace function public.admissao_convert_to_matricula(
  p_escola_id uuid,
  p_candidatura_id uuid,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.current_tenant_escola_id();
  v_cand record;
  v_from text;
  v_to text := 'matriculado';
  v_matricula_id uuid;
begin
  -- Security
  if p_escola_id is null or p_escola_id <> v_tenant then
    raise exception 'Acesso negado: escola inválida.';
  end if;

  if not public.user_has_role_in_school(p_escola_id, array['secretaria','admin','admin_escola','staff_admin']) then
    raise exception 'Acesso negado: permissões insuficientes.';
  end if;

  -- Lock
  select status, matricula_id, escola_id into v_cand
  from public.candidaturas
  where id = p_candidatura_id and escola_id = v_tenant
  for update;

  if v_cand.status is null then
    raise exception 'Candidatura não encontrada.';
  end if;

  v_from := v_cand.status;

  -- Idempotency
  if v_from = 'matriculado' then
    return v_cand.matricula_id;
  end if;

  if v_from <> 'aprovada' then
    raise exception 'Transição inválida: % -> matriculado (requer aprovada)', v_from;
  end if;

  -- Call Core Overload (Handles Aluno + Matricula UUID)
  v_matricula_id := public.confirmar_matricula_core(p_candidatura_id);

  if v_matricula_id is null then
    raise exception 'Falha ao gerar matrícula.';
  end if;

  -- Status Change Guard Bypass
  perform set_config('app.rpc_internal', 'on', true);

  update public.candidaturas
  set 
    status = v_to,
    matricula_id = v_matricula_id,
    matriculado_em = now(),
    updated_at = now()
  where id = p_candidatura_id;

  insert into public.candidaturas_status_log (
    escola_id, candidatura_id, from_status, to_status, metadata
  ) values (
    p_escola_id, p_candidatura_id, v_from, v_to, 
    jsonb_build_object('matricula_id', v_matricula_id) || coalesce(p_metadata, '{}'::jsonb)
  );

  return v_matricula_id;
end;
$$;

revoke all on function public.admissao_convert_to_matricula(uuid, uuid, jsonb) from public;
grant execute on function public.admissao_convert_to_matricula(uuid, uuid, jsonb) to authenticated;


-- 6) Trigger: Status Change Guard
create or replace function public._guard_candidaturas_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.status is distinct from old.status) then
    if (current_setting('app.rpc_internal', true) <> 'on') and (not public.check_super_admin_role()) then
      raise exception 'Mudança de status da candidatura permitida apenas via RPCs oficiais.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_candidaturas_status_change on public.candidaturas;
create trigger trg_guard_candidaturas_status_change
before update on public.candidaturas
for each row
execute function public._guard_candidaturas_status_change();

commit;
