begin;

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
  select a.escola_id into v_escola_id
  from public.alunos a
  where a.id = p_aluno_id;

  if not found then
    raise exception 'Aluno não encontrado';
  end if;

  if p_turma_id is not null then
    perform 1
    from public.turmas t
    where t.id = p_turma_id
      and t.escola_id = v_escola_id;

    if not found then
      raise exception 'Turma não pertence à escola do aluno';
    end if;
  end if;

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

notify pgrst, 'reload schema';

commit;
