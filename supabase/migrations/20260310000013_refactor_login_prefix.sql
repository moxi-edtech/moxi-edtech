BEGIN;

CREATE OR REPLACE FUNCTION public.get_escola_sigla(p_escola_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_nome text;
  v_clean text;
  v_words text[];
  v_word text;
  v_sigla text := '';
  v_concat text;
  v_stopwords text[] := ARRAY['DE','DA','DO','DOS','DAS','E','A','O'];
BEGIN
  SELECT nome INTO v_nome FROM public.escolas WHERE id = p_escola_id;
  IF v_nome IS NULL THEN
    RAISE EXCEPTION 'Escola não encontrada para sigla.';
  END IF;

  v_clean := upper(translate(v_nome,
    'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç',
    'AAAAAEEEEIIIIOOOOOUUUUCaaaaaeeeeiiiiooooouuuuc'
  ));
  v_clean := regexp_replace(v_clean, '[^A-Z ]', ' ', 'g');
  v_clean := regexp_replace(v_clean, '\s+', ' ', 'g');

  v_words := regexp_split_to_array(trim(v_clean), '\s+');
  FOREACH v_word IN ARRAY v_words LOOP
    IF v_word = '' THEN
      CONTINUE;
    END IF;
    IF v_word = ANY(v_stopwords) THEN
      CONTINUE;
    END IF;
    v_sigla := v_sigla || left(v_word, 1);
    IF length(v_sigla) >= 3 THEN
      EXIT;
    END IF;
  END LOOP;

  IF length(v_sigla) < 3 THEN
    v_concat := regexp_replace(v_clean, '\s+', '', 'g');
    v_sigla := left(v_concat, 3);
  END IF;

  RETURN v_sigla;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_escola_sigla(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.build_numero_login(
  p_escola_id uuid,
  p_ano_letivo integer,
  p_numero bigint
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_sigla text;
  v_year text;
  v_pad int;
BEGIN
  v_sigla := public.get_escola_sigla(p_escola_id);
  IF v_sigla IS NULL OR v_sigla = '' THEN
    RAISE EXCEPTION 'Sigla inválida para escola.';
  END IF;

  v_year := right(COALESCE(p_ano_letivo::text, extract(year from now())::int::text), 2);

  IF p_numero >= 100000 THEN
    v_pad := 6;
  ELSIF p_numero >= 10000 THEN
    v_pad := 5;
  ELSE
    v_pad := 4;
  END IF;

  RETURN v_sigla || '-' || v_year || '-' || lpad(p_numero::text, v_pad, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION public.build_numero_login(uuid, integer, bigint) TO authenticated;

CREATE OR REPLACE FUNCTION public.generate_unique_numero_login(
  p_escola_id uuid,
  p_role public.user_role,
  p_prefix text,
  p_start integer
)
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_max_suffix integer := 0;
  v_next integer;
  v_next_role_start integer;
  role_starts integer[];
  v_counter_key text := 'login:' || p_role::text || ':' || p_prefix;
  v_prefix text := trim(coalesce(p_prefix, ''));
  v_pad int;
BEGIN
  IF v_prefix = '' THEN
    RAISE EXCEPTION 'Prefixo inválido para numero_login.';
  END IF;
  IF right(v_prefix, 1) <> '-' THEN
    v_prefix := v_prefix || '-';
  END IF;

  SELECT COALESCE(MAX(CAST(SUBSTRING(numero_login FROM '(\d+)$') AS INTEGER)), 0)
  INTO v_max_suffix
  FROM profiles
  WHERE escola_id = p_escola_id
    AND role = p_role
    AND numero_login LIKE v_prefix || '%'
    AND SUBSTRING(numero_login FROM '(\d+)$') ~ '^\d{4,6}$';

  role_starts := ARRAY[1, 1001, 2001, 3001, 4001, 5001];

  SELECT MIN(start_val) INTO v_next_role_start
  FROM unnest(role_starts) AS start_val
  WHERE start_val > p_start;

  v_next := public.next_numero_counter(
    p_escola_id,
    v_counter_key,
    GREATEST(p_start, v_max_suffix + 1)
  );

  IF v_next_role_start IS NOT NULL AND v_next >= v_next_role_start THEN
    RAISE EXCEPTION 'Limite de números para o role % (faixa %-%) atingido',
      p_role, p_start, v_next_role_start - 1;
  END IF;

  IF v_next >= 100000 THEN
    v_pad := 6;
  ELSIF v_next >= 10000 THEN
    v_pad := 5;
  ELSE
    v_pad := 4;
  END IF;

  RETURN v_prefix || LPAD(v_next::TEXT, v_pad, '0');
END;
$$;

ALTER FUNCTION public.generate_unique_numero_login(uuid, public.user_role, text, integer) OWNER TO postgres;

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

  v_login := public.build_numero_login(v_escola_id, p_ano_letivo, v_numero_matricula);

  update public.profiles p
  set numero_login = v_login
  from public.alunos a
  where a.id = p_aluno_id
    and p.user_id = a.profile_id
    and p.role = 'aluno'
    and (p.numero_login is distinct from v_login);

  return v_numero_matricula;
END;
$$;

ALTER FUNCTION public.confirmar_matricula_core(uuid, integer, uuid, uuid) OWNER TO postgres;

COMMIT;
