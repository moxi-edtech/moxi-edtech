-- ============================================================
-- KLASSE — Admissão Life-cycle (Unsubmit, Approve & Logging)
-- - Tabela de Log de Status: candidaturas_status_log
-- - Função de AuthZ: user_has_role_in_school
-- - RPCs: admissao_unsubmit, admissao_approve (SECURITY DEFINER)
-- ============================================================

begin;

-- 1) Tabela de Log de Status (Auditoria P1)
create table if not exists public.candidaturas_status_log (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references public.escolas(id) on delete cascade,
  candidatura_id uuid not null references public.candidaturas(id) on delete cascade,
  from_status text,
  to_status text not null,
  actor_user_id uuid default auth.uid(),
  motivo text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- Índices para performance
create index if not exists idx_cand_status_log_cand_id on public.candidaturas_status_log(candidatura_id);
create index if not exists idx_cand_status_log_escola_id on public.candidaturas_status_log(escola_id);

-- 2) Função de AuthZ robusta (usa escola_users que é a tabela real)
create or replace function public.user_has_role_in_school(
  p_escola_id uuid,
  p_roles text[]
)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  -- Super Admin bypass
  if public.check_super_admin_role() then
    return true;
  end if;

  return exists (
    select 1
    from public.escola_users
    where escola_id = p_escola_id
      and user_id = auth.uid()
      and papel = any(p_roles)
  );
end;
$$;

-- 3) RPC: admissao_unsubmit (Devolver para rascunho)
create or replace function public.admissao_unsubmit(
  p_escola_id uuid,
  p_candidatura_id uuid,
  p_motivo text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.current_tenant_escola_id();
  v_cand record;
begin
  -- Security check: Tenant isolation
  if p_escola_id is null or p_escola_id <> v_tenant then
    raise exception 'Acesso negado: escola inválida';
  end if;

  -- Security check: Permission (AuthZ)
  if not public.user_has_role_in_school(p_escola_id, array['secretaria','admin','admin_escola','staff_admin']) then
    raise exception 'Acesso negado: permissões insuficientes';
  end if;

  -- Lock & Load
  select status, escola_id
  into v_cand
  from public.candidaturas
  where id = p_candidatura_id
    and escola_id = v_tenant
  for update;

  if v_cand.status is null then
    raise exception 'Candidatura não encontrada ou acesso negado';
  end if;

  -- Idempotency
  if v_cand.status = 'rascunho' then
    return p_candidatura_id;
  end if;

  -- Validation: Só permite unsubmit se estiver submetida ou em_analise
  if v_cand.status not in ('submetida', 'em_analise') then
    raise exception 'Transição inválida: status atual = %', v_cand.status;
  end if;

  -- Status Log
  insert into public.candidaturas_status_log (
    escola_id,
    candidatura_id,
    from_status,
    to_status,
    motivo
  ) values (
    p_escola_id,
    p_candidatura_id,
    v_cand.status,
    'rascunho',
    p_motivo
  );

  -- Execute Update
  update public.candidaturas
  set
    status = 'rascunho',
    dados_candidato = coalesce(dados_candidato, '{}'::jsonb) || 
      jsonb_build_object(
        'last_unsubmit_motivo', p_motivo,
        'last_unsubmit_at', now()
      ),
    updated_at = now()
  where id = p_candidatura_id;

  return p_candidatura_id;
end;
$$;

-- 4) RPC: admissao_approve (Aprovar candidatura)
create or replace function public.admissao_approve(
  p_escola_id uuid,
  p_candidatura_id uuid,
  p_observacao text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.current_tenant_escola_id();
  v_cand record;
  v_turma record;
  v_classe record;
begin
  -- Security check: Tenant isolation
  if p_escola_id is null or p_escola_id <> v_tenant then
    raise exception 'Acesso negado: escola inválida';
  end if;

  -- Security check: Permission (AuthZ)
  if not public.user_has_role_in_school(p_escola_id, array['secretaria','admin','admin_escola','staff_admin']) then
    raise exception 'Acesso negado: permissões insuficientes';
  end if;

  -- Lock & Load
  select *
  into v_cand
  from public.candidaturas
  where id = p_candidatura_id
    and escola_id = v_tenant
  for update;

  if v_cand.status is null then
    raise exception 'Candidatura não encontrada ou acesso negado';
  end if;

  -- Idempotency
  if v_cand.status = 'aprovada' then
    return p_candidatura_id;
  end if;

  -- Transition check
  if v_cand.status not in ('submetida', 'em_analise') then
    raise exception 'Transição inválida: status atual = %', v_cand.status;
  end if;

  -- Business Validations (Re-check coherence before approval)
  if v_cand.curso_id is null or v_cand.ano_letivo is null then
    raise exception 'Candidatura incompleta para aprovação';
  end if;

  -- Valida Classe
  if v_cand.classe_id is not null then
    select cl.escola_id, cl.curso_id into v_classe
    from public.classes cl
    where cl.id = v_cand.classe_id;

    if v_classe.escola_id <> v_tenant then
      raise exception 'Classe inválida para esta escola';
    end if;
    
    if v_classe.curso_id is not null and v_classe.curso_id <> v_cand.curso_id then
      raise exception 'Incoerência: Classe não pertence ao curso selecionado';
    end if;
  end if;

  -- Valida Turma Preferencial
  if v_cand.turma_preferencial_id is not null then
    select t.escola_id, t.curso_id, t.classe_id, t.ano_letivo into v_turma
    from public.turmas t
    where t.id = v_cand.turma_preferencial_id;

    if v_turma.escola_id <> v_tenant then
      raise exception 'Turma preferencial inválida para esta escola';
    end if;

    if v_turma.curso_id <> v_cand.curso_id then
      raise exception 'Incoerência: Turma preferencial pertence a outro curso';
    end if;

    if v_cand.classe_id is not null and v_turma.classe_id <> v_cand.classe_id then
      raise exception 'Incoerência: Turma preferencial pertence a outra classe';
    end if;

    if v_turma.ano_letivo <> v_cand.ano_letivo then
      raise exception 'Incoerência: Turma preferencial pertence a outro ano letivo';
    end if;
  end if;

  -- Status Log
  insert into public.candidaturas_status_log (
    escola_id,
    candidatura_id,
    from_status,
    to_status,
    motivo
  ) values (
    p_escola_id,
    p_candidatura_id,
    v_cand.status,
    'aprovada',
    p_observacao
  );

  -- Execute Update
  update public.candidaturas
  set
    status = 'aprovada',
    dados_candidato = coalesce(dados_candidato, '{}'::jsonb) || 
      jsonb_build_object(
        'aprovacao_obs', p_observacao,
        'aprovada_at', now()
      ),
    updated_at = now()
  where id = p_candidatura_id;

  return p_candidatura_id;
end;
$$;

-- 5) Permissions (Hardening)
revoke all on function public.admissao_unsubmit(uuid, uuid, text) from public;
grant execute on function public.admissao_unsubmit(uuid, uuid, text) to authenticated;

revoke all on function public.admissao_approve(uuid, uuid, text) from public;
grant execute on function public.admissao_approve(uuid, uuid, text) to authenticated;

-- Grant permissions for log table
alter table public.candidaturas_status_log enable row level security;

create policy "candidaturas_status_log_isolation"
  on public.candidaturas_status_log
  for select
  to authenticated
  using (escola_id = public.current_tenant_escola_id());

commit;
