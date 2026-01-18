-- ============================================================
-- KLASSE — RPC: admissao_submit (blindado) + RLS Hardening
-- - SECURITY INVOKER (respeita RLS)
-- - Tenant guard: p_escola_id deve bater com current_tenant_escola_id()
-- - Lock anti-race: SELECT FOR UPDATE
-- - Validações: curso_id, ano_letivo e coerência curso/classe/turma
-- - RLS Hardening: Impede edição após submissão (exceto via fluxos autorizados)
-- ============================================================

begin;

-- 1) RPC: admissao_submit
create or replace function public.admissao_submit(
  p_escola_id uuid,
  p_candidatura_id uuid,
  p_source text default null
)
returns uuid
language plpgsql
as $$
declare
  v_tenant_escola_id uuid := public.current_tenant_escola_id();
  v_cand record;
  v_turma record;
  v_classe record;
begin
  -- 1. Security Check: Tenant Isolation
  if p_escola_id is null or p_escola_id <> v_tenant_escola_id then
    raise exception 'Acesso negado: escola inválida';
  end if;

  if p_candidatura_id is null then
    raise exception 'p_candidatura_id é obrigatório';
  end if;

  -- 2. Lock & Load: Anti-race condition
  select
    c.status,
    c.curso_id,
    c.ano_letivo,
    c.classe_id,
    c.turma_preferencial_id,
    c.source
  into v_cand
  from public.candidaturas c
  where c.id = p_candidatura_id
    and c.escola_id = v_tenant_escola_id
  for update;

  if v_cand.status is null then
    raise exception 'Candidatura não encontrada ou acesso negado';
  end if;

  -- 3. Idempotency: Já submetida? Retorna OK.
  if v_cand.status = 'submetida' then
    return p_candidatura_id;
  end if;

  -- 4. State Transition Check: Só permite rascunho -> submetida
  if v_cand.status <> 'rascunho' then
    raise exception 'Transição inválida: status atual = %', v_cand.status;
  end if;

  -- 5. Business Validations (Hard Requirements for Submission)
  if v_cand.curso_id is null then
    raise exception 'Não é possível submeter: curso_id obrigatório';
  end if;

  if v_cand.ano_letivo is null then
    raise exception 'Não é possível submeter: ano_letivo obrigatório';
  end if;

  -- 6. Coherence Checks (P1)
  
  -- Valida Classe
  if v_cand.classe_id is not null then
    select cl.escola_id, cl.curso_id into v_classe
    from public.classes cl
    where cl.id = v_cand.classe_id;

    if v_classe.escola_id <> v_tenant_escola_id then
      raise exception 'Classe inválida para esta escola';
    end if;
    
    -- Se a classe tem curso vinculado, deve bater
    if v_classe.curso_id is not null and v_classe.curso_id <> v_cand.curso_id then
      raise exception 'Incoerência: Classe não pertence ao curso selecionado';
    end if;
  end if;

  -- Valida Turma Preferencial
  if v_cand.turma_preferencial_id is not null then
    select t.escola_id, t.curso_id, t.classe_id, t.ano_letivo into v_turma
    from public.turmas t
    where t.id = v_cand.turma_preferencial_id;

    if v_turma.escola_id <> v_tenant_escola_id then
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

  -- 7. Execute Transition
  update public.candidaturas c
  set
    status = 'submetida',
    source = coalesce(nullif(p_source, ''), v_cand.source, 'walkin'),
    updated_at = now()
  where c.id = p_candidatura_id
    and c.escola_id = v_tenant_escola_id;

  return p_candidatura_id;
end;
$$;

-- 2) RLS Hardening: Lock editing for non-drafts
-- Atualiza a política existente para impedir edições se não for rascunho.
-- Nota: O RPC acima funciona porque no momento do UPDATE o status ainda é 'rascunho'.
drop policy if exists "candidaturas_tenant_isolation" on public.candidaturas;

create policy "candidaturas_tenant_isolation_select"
  on public.candidaturas for select
  to authenticated
  using (escola_id = public.current_tenant_escola_id());

create policy "candidaturas_tenant_isolation_insert"
  on public.candidaturas for insert
  to authenticated
  with check (escola_id = public.current_tenant_escola_id());

create policy "candidaturas_tenant_isolation_update"
  on public.candidaturas for update
  to authenticated
  using (
    escola_id = public.current_tenant_escola_id() 
    and (status = 'rascunho' or public.check_super_admin_role())
  )
  with check (
    escola_id = public.current_tenant_escola_id()
  );

create policy "candidaturas_tenant_isolation_delete"
  on public.candidaturas for delete
  to authenticated
  using (
    escola_id = public.current_tenant_escola_id() 
    and (status = 'rascunho' or public.check_super_admin_role())
  );

commit;
