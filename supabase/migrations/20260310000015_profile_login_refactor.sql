BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS numero_processo_login text,
  ADD COLUMN IF NOT EXISTS email_real text,
  ADD COLUMN IF NOT EXISTS email_auth text;

CREATE OR REPLACE FUNCTION public.build_numero_login(
  p_escola_id uuid,
  p_numero_processo text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_sigla text;
  v_numero text := trim(coalesce(p_numero_processo, ''));
BEGIN
  v_sigla := public.get_escola_sigla(p_escola_id);
  IF v_sigla IS NULL OR v_sigla = '' THEN
    RAISE EXCEPTION 'Sigla inválida para escola.';
  END IF;
  IF v_numero = '' THEN
    RAISE EXCEPTION 'Numero_processo inválido.';
  END IF;
  RETURN v_sigla || '-' || v_numero;
END;
$$;

GRANT EXECUTE ON FUNCTION public.build_numero_login(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.confirmar_matricula_core(
  p_aluno_id uuid,
  p_ano_letivo integer,
  p_turma_id uuid DEFAULT NULL::uuid,
  p_matricula_id uuid DEFAULT NULL::uuid
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_escola_id uuid;
  v_matricula_id uuid;
  v_numero_matricula bigint;
  v_login text;
  v_numero_processo text;
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

  select a.numero_processo into v_numero_processo
  from public.alunos a
  where a.id = p_aluno_id;

  if v_numero_processo is null or v_numero_processo = '' then
    v_numero_processo := public.next_numero_processo(v_escola_id, p_ano_letivo);
    update public.alunos
      set numero_processo = v_numero_processo
    where id = p_aluno_id;
  end if;

  v_login := public.build_numero_login(v_escola_id, v_numero_processo);

  update public.profiles p
  set
    numero_processo_login = v_login,
    email_auth = lower(v_login || '@klasse.ao')
  from public.alunos a
  where a.id = p_aluno_id
    and p.user_id = a.profile_id
    and p.role = 'aluno'
    and (p.numero_processo_login is distinct from v_login or p.email_auth is distinct from lower(v_login || '@klasse.ao'));

  return v_numero_matricula;
END;
$$;

ALTER FUNCTION public.confirmar_matricula_core(uuid, integer, uuid, uuid) OWNER TO postgres;

UPDATE public.profiles p
SET email_real = COALESCE(email_real, email)
WHERE p.role = 'aluno' AND email_real IS NULL;

UPDATE public.profiles p
SET numero_processo_login = public.build_numero_login(p.escola_id, a.numero_processo),
    email_auth = lower(public.build_numero_login(p.escola_id, a.numero_processo) || '@klasse.ao')
FROM public.alunos a
WHERE p.user_id = a.profile_id
  AND p.role = 'aluno'
  AND a.numero_processo IS NOT NULL
  AND (p.numero_processo_login IS NULL OR p.numero_processo_login = '');

COMMIT;
