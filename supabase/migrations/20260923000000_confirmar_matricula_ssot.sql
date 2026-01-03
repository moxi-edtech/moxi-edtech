begin;

-- 0) (Opcional) garantir que canonicalize aceita 'pendente' e 'ativo'

-- 1) Core: confirma e garante número
create or replace function public.confirmar_matricula_core(
  p_aluno_id uuid,
  p_ano_letivo int,
  p_turma_id uuid default null,
  p_matricula_id uuid default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
DECLARE
  v_escola_id uuid;
  v_matricula_id uuid;
  v_numero_matricula bigint;
BEGIN
  -- A) Validar aluno
  select a.escola_id into v_escola_id
  from public.alunos a
  where a.id = p_aluno_id;

  if not found then
    raise exception 'Aluno não encontrado';
  end if;

  -- B) Validar turma se enviada
  if p_turma_id is not null then
    perform 1
    from public.turmas t
    where t.id = p_turma_id
      and t.escola_id = v_escola_id;

    if not found then
      raise exception 'Turma não pertence à escola do aluno';
    end if;
  end if;

  -- C) Buscar matrícula existente (determinístico) e lock
  if p_matricula_id is not null then
    select m.id, m.numero_matricula
      into v_matricula_id, v_numero_matricula
    from public.matriculas m
    where m.id = p_matricula_id
      and m.escola_id = v_escola_id
    for update;
  else
    select m.id, m.numero_matricula
      into v_matricula_id, v_numero_matricula
    from public.matriculas m
    where m.aluno_id = p_aluno_id
      and m.ano_letivo = p_ano_letivo
      and m.escola_id = v_escola_id
    order by
      (m.status in ('ativo','pendente')) desc,
      m.created_at desc nulls last
    limit 1
    for update;
  end if;

  -- D) Confirmar (gera número se preciso)
  if v_matricula_id is null then
    v_numero_matricula := public.next_matricula_number(v_escola_id);

    insert into public.matriculas (
      id, escola_id, aluno_id, turma_id, ano_letivo,
      status, numero_matricula, data_matricula, created_at
    ) values (
      gen_random_uuid(), v_escola_id, p_aluno_id, p_turma_id, p_ano_letivo,
      'ativo', v_numero_matricula, current_date, now()
    )
    returning id into v_matricula_id;
  else
    if v_numero_matricula is null then
      v_numero_matricula := public.next_matricula_number(v_escola_id);
    end if;

    update public.matriculas
    set
      numero_matricula = v_numero_matricula,
      status = 'ativo',
      turma_id = coalesce(p_turma_id, turma_id),
      updated_at = now()
    where id = v_matricula_id;
  end if;

  -- E) sincronizar login do profile (se existir)
  update public.profiles p
  set numero_login = v_numero_matricula::text
  from public.alunos a
  where a.id = p_aluno_id
    and p.user_id = a.profile_id
    and p.role = 'aluno'
    and (p.numero_login is distinct from v_numero_matricula::text);

  return v_numero_matricula;
END;
$$;

-- 2) Wrapper compatível (2 params), mas o front não precisa usar
drop function if exists public.confirmar_matricula(uuid, boolean);
create or replace function public.confirmar_matricula(
  p_matricula_id uuid,
  p_force boolean default false
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_aluno_id uuid;
  v_turma_id uuid;
  v_ano_letivo int;
begin
  select m.aluno_id, m.turma_id, m.ano_letivo
    into v_aluno_id, v_turma_id, v_ano_letivo
  from public.matriculas m
  where m.id = p_matricula_id
  for update;

  if not found then
    raise exception 'Matrícula não encontrada';
  end if;

  return public.confirmar_matricula_core(
    v_aluno_id,
    v_ano_letivo,
    v_turma_id,
    p_matricula_id
  );
end;
$$;

-- 3) Assinatura final recomendada pro front (1 param)
drop function if exists public.confirmar_matricula(uuid);
create or replace function public.confirmar_matricula(p_matricula_id uuid)
returns bigint
language sql
security definer
set search_path = public
as $$
  select public.confirmar_matricula($1, false);
$$;

-- 4) Guardião: impede "ativo sem número" (e impede gerar número fora do fluxo)
create or replace function public.guard_matricula_status_numero()
returns trigger
language plpgsql
as $$
begin
  -- normaliza status antes (se teu canonicalize roda em trigger separado, ok)
  if new.status in ('ativo','ativa') then
    if new.numero_matricula is null or btrim(new.numero_matricula::text) = '' then
      raise exception 'Matrícula não pode ficar ativa sem numero_matricula. Use confirmar_matricula().';
    end if;
  end if;

  -- se for pendente, força numero_matricula NULL (evita "pendente com número")
  if new.status in ('pendente','rascunho','indefinido') then
    new.numero_matricula := null;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_matricula_status_numero on public.matriculas;
create trigger trg_guard_matricula_status_numero
before insert or update on public.matriculas
for each row execute function public.guard_matricula_status_numero();

-- 5) IMPORTANTE: neutralizar o auto-number trigger (se você quer número só na confirmação)
create or replace function public.trg_set_matricula_number()
returns trigger
language plpgsql
as $$
declare
  v_num bigint;
begin
  if (new.status in ('ativo','ativa')) and new.numero_matricula is null then
    v_num := public.next_matricula_number(new.escola_id);
    new.numero_matricula := v_num;
  end if;
  return new;
end;
$$;

-- 6) View para secretaria: pendentes vs ativas (rápida)
create or replace view public.vw_matriculas_secretaria as
select
  m.id as matricula_id,
  m.escola_id,
  m.ano_letivo,
  m.status as matricula_status,
  m.numero_matricula,
  m.created_at,
  a.id as aluno_id,
  a.nome as aluno_nome,
  a.status as aluno_status,
  t.id as turma_id,
  t.nome as turma_nome
from public.matriculas m
join public.alunos a on a.id = m.aluno_id
left join public.turmas t on t.id = m.turma_id;

-- 7) Forçar PostgREST atualizar cache do schema
notify pgrst, 'reload schema';

commit;
