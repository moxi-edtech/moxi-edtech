-- Corrige a origem das matrículas criadas sem session_id.
--
-- Sintoma: a emissão de documentos falha com "Matrícula ativa não encontrada"
-- (404, apps/web/src/app/api/secretaria/documentos/emitir/route.ts:179). A rota
-- filtra matriculas.session_id = ano letivo do contexto académico, e o cliente
-- envia sempre ano_letivo_id (DocumentosEmissaoHubClient.tsx:410). Uma matrícula
-- com session_id NULL nunca casa.
--
-- Causa: as funções abaixo inserem em public.matriculas sem session_id. A cadeia
-- provada é admissão -> admissao_finalizar_matricula -> admissao_convert_to_matricula
-- -> confirmar_matricula_core, mas as outras quatro atingem o mesmo INSERT.
--
-- Além de bloquear a impressão, session_id NULL é BLOCKER da virada de ano
-- (lib/operacoes-academicas/cutover-health.ts:303).
--
-- O valor é resolvido por (escola_id, ano) em public.anos_letivos. Verificou-se
-- que existe exactamente uma linha por (escola, ano) em toda a base, pelo que a
-- resolução é inequívoca; ainda assim leva limit 1 para que uma quebra futura
-- desse invariante não faça a admissão rebentar com "more than one row".
--
-- ÂMBITO: apenas o caminho de CRIAÇÃO. As cláusulas ON CONFLICT ... DO UPDATE e
-- os ramos de UPDATE sobre matrícula existente continuam a não preencher um
-- session_id que já esteja NULL. Isso não é um defeito novo — é uma lacuna
-- conhecida e deliberada, para manter o diff mínimo em funções partilhadas.
--
-- As definições abaixo foram geradas a partir de pg_get_functiondef em produção,
-- não dos ficheiros de migração, para não reintroduzir corpos desactualizados.

CREATE OR REPLACE FUNCTION public.confirmar_matricula_core(p_aluno_id uuid, p_ano_letivo integer, p_turma_id uuid DEFAULT NULL::uuid, p_matricula_id uuid DEFAULT NULL::uuid)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      session_id,
      status, numero_matricula, data_matricula, created_at
    ) values (
      gen_random_uuid(), v_escola_id, p_aluno_id, p_turma_id, p_ano_letivo,
      (select al.id from public.anos_letivos al where al.escola_id = v_escola_id and al.ano = p_ano_letivo limit 1),
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

  update public.alunos
  set status = 'ativo'
  where id = p_aluno_id
    and (status is null or status <> 'ativo');

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
$function$;

CREATE OR REPLACE FUNCTION public.matricular_lista_alunos(p_escola_id uuid, p_turma_id uuid, p_ano_letivo integer, p_aluno_ids uuid[])
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sucesso int := 0;
  v_erros int := 0;
  v_aluno_id uuid;
  v_processo text;
BEGIN
  PERFORM 1 FROM public.turmas WHERE id = p_turma_id AND escola_id = p_escola_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Turma não pertence a esta escola'; END IF;

  FOREACH v_aluno_id IN ARRAY p_aluno_ids LOOP
    BEGIN
      SELECT numero_processo INTO v_processo FROM public.alunos WHERE id = v_aluno_id;

      INSERT INTO public.matriculas (
        escola_id, aluno_id, turma_id, ano_letivo, session_id, status, ativo,
        numero_matricula, data_matricula
      )
      VALUES (
        p_escola_id, v_aluno_id, p_turma_id, p_ano_letivo,
        (select al.id from public.anos_letivos al where al.escola_id = p_escola_id and al.ano = p_ano_letivo limit 1),
        'ativo', true,
        v_processo || '/' || p_ano_letivo, now()
      )
      ON CONFLICT (escola_id, aluno_id, ano_letivo)
      DO UPDATE SET
        turma_id = EXCLUDED.turma_id,
        status = 'ativo',
        ativo = true,
        data_matricula = COALESCE(public.matriculas.data_matricula, EXCLUDED.data_matricula);

      v_sucesso := v_sucesso + 1;
    EXCEPTION WHEN OTHERS THEN
      v_erros := v_erros + 1;
    END;
  END LOOP;

  RETURN json_build_object('sucesso', v_sucesso, 'erros', v_erros);
END;
$function$;

CREATE OR REPLACE FUNCTION public.transferir_matricula(p_escola_id uuid, p_matricula_id uuid, p_target_turma_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  -- Variáveis de validação e controle
  v_actor_id uuid := auth.uid();
  v_matricula_origem record;
  v_turma_destino record;
  v_nova_matricula_id uuid;
  v_has_permission boolean;
BEGIN
  -- 1. Validação de Permissões
  SELECT public.user_has_role_in_school(p_escola_id, ARRAY['secretaria', 'admin', 'admin_escola', 'staff_admin'])
  INTO v_has_permission;
  IF NOT v_has_permission THEN
    RAISE EXCEPTION 'AUTH: Permissão negada.';
  END IF;

  -- 2. Validar Matrícula de Origem
  SELECT * INTO v_matricula_origem FROM public.matriculas WHERE id = p_matricula_id AND escola_id = p_escola_id FOR UPDATE;
  IF v_matricula_origem.id IS NULL THEN
    RAISE EXCEPTION 'DATA: Matrícula de origem não encontrada.';
  END IF;
  IF v_matricula_origem.turma_id = p_target_turma_id THEN
    RAISE EXCEPTION 'LOGIC: A turma de destino deve ser diferente da turma de origem.';
  END IF;

  -- 3. Validar Turma de Destino
  SELECT * INTO v_turma_destino FROM public.turmas WHERE id = p_target_turma_id AND escola_id = p_escola_id;
  IF v_turma_destino.id IS NULL THEN
    RAISE EXCEPTION 'DATA: Turma de destino não encontrada.';
  END IF;

  -- 4. Verificar se já existe matrícula ativa para o aluno na turma de destino
  IF EXISTS (
    SELECT 1 FROM public.matriculas
    WHERE escola_id = p_escola_id
      AND aluno_id = v_matricula_origem.aluno_id
      AND turma_id = p_target_turma_id
      AND status = 'ativa'
  ) THEN
    RAISE EXCEPTION 'LOGIC: Aluno já possui matrícula ativa na turma de destino.';
  END IF;

  -- 5. Criar a nova matrícula como 'ativa'
  INSERT INTO public.matriculas (
    escola_id,
    aluno_id,
    turma_id,
    ano_letivo,
    session_id,
    status,
    data_matricula
  )
  VALUES (
    p_escola_id,
    v_matricula_origem.aluno_id,
    p_target_turma_id,
    v_turma_destino.ano_letivo,
    (select al.id from public.anos_letivos al where al.escola_id = p_escola_id and al.ano = v_turma_destino.ano_letivo limit 1),
    'ativa',
    now()
  )
  RETURNING id INTO v_nova_matricula_id;

  -- 6. Atualizar a matrícula antiga para 'transferido'
  UPDATE public.matriculas
  SET status = 'transferido', updated_at = now()
  WHERE id = p_matricula_id;

  -- 7. Auditoria
  INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, portal, details)
  VALUES (
    p_escola_id,
    v_actor_id,
    'MATRICULA_TRANSFERIDA',
    'matriculas',
    p_matricula_id::text,
    'secretaria',
    jsonb_build_object(
      'matricula_origem_id', p_matricula_id,
      'matricula_destino_id', v_nova_matricula_id,
      'turma_origem_id', v_matricula_origem.turma_id,
      'turma_destino_id', p_target_turma_id
    )
  );

  RETURN jsonb_build_object('ok', true, 'matricula_id', v_nova_matricula_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.importar_alunos(p_import_id uuid, p_escola_id uuid, p_ano_letivo integer)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r RECORD;
  v_aluno_id uuid;
  v_turma_id uuid;
  v_curso_id uuid;
  
  v_total_imported int := 0;
  v_total_errors int := 0;
  v_turmas_created int := 0;
  v_cursos_created int := 0;
  
  v_clean_nome text;
  v_clean_telefone text;
  v_clean_aluno_telefone text;
  v_clean_turma_codigo text;
  v_clean_curso_codigo text;
  v_curso_codigo_mapeado text;
  v_clean_responsavel text;
  v_clean_nif text;
  v_clean_email text;
  v_clean_data_nascimento date;
  v_clean_sexo text;

  v_user_role text;
  v_new_curso_status text;
BEGIN
  SELECT current_setting('request.jwt.claims', true)::jsonb ->> 'role' INTO v_user_role;
  IF v_user_role = 'admin' OR v_user_role = 'super_admin' THEN
    v_new_curso_status := 'aprovado';
  ELSE
    v_new_curso_status := 'pendente';
  END IF;

  FOR r IN SELECT * FROM public.staging_alunos WHERE import_id = p_import_id LOOP
    BEGIN
      v_clean_nome := public.initcap_angola(r.nome);
      v_clean_responsavel := public.initcap_angola(r.encarregado_nome);
      v_clean_telefone := regexp_replace(r.encarregado_telefone, '[^0-9+]', '', 'g');
      v_clean_aluno_telefone := regexp_replace(r.telefone, '[^0-9+]', '', 'g');
      v_clean_turma_codigo := upper(regexp_replace(r.turma_codigo, '[^a-zA-Z0-9]', '', 'g'));
      v_clean_curso_codigo := upper(regexp_replace(r.curso_codigo, '[^a-zA-Z0-9]', '', 'g'));

      -- Map common Excel siglas to official curriculum presets
      v_curso_codigo_mapeado := coalesce(v_clean_curso_codigo, '');
      IF v_curso_codigo_mapeado <> '' THEN
        v_curso_codigo_mapeado := CASE v_curso_codigo_mapeado
          WHEN 'TI' THEN 'tecnico_informatica'
          WHEN 'INF' THEN 'tecnico_informatica'
          WHEN 'INFORMATICA' THEN 'tecnico_informatica'
          WHEN 'TINF' THEN 'tecnico_informatica'
          WHEN 'TG' THEN 'tecnico_gestao'
          WHEN 'GESTAO' THEN 'tecnico_gestao'
          WHEN 'TECGEST' THEN 'tecnico_gestao'
          WHEN 'EP' THEN 'primario_base'
          WHEN 'EPB' THEN 'primario_base'
          WHEN 'EPU' THEN 'primario_base'
          WHEN 'EB' THEN 'primario_base'
          WHEN 'CFB' THEN 'puniv'
          WHEN 'PUNIV' THEN 'puniv'
          ELSE v_curso_codigo_mapeado
        END;
      END IF;

      v_clean_nif := NULLIF(upper(trim(r.nif)), '');
      v_clean_email := lower(NULLIF(trim(r.email), ''));
      v_clean_data_nascimento := NULLIF(r.data_nascimento, '')::date;
      v_clean_sexo := UPPER(NULLIF(trim(r.sexo), ''));

      IF v_clean_telefone IS NULL OR v_clean_telefone = '' THEN 
         RAISE EXCEPTION 'Telefone do encarregado é inválido ou vazio.'; 
      END IF;
      
      IF v_clean_turma_codigo IS NULL OR v_clean_turma_codigo = '' THEN
        RAISE EXCEPTION 'O código da turma é obrigatório.';
      END IF;

      INSERT INTO public.alunos (
        escola_id, numero_processo, nome, nome_completo, data_nascimento, sexo,
        telefone, bi_numero, nif, email,
        encarregado_nome, encarregado_telefone, encarregado_email,
        responsavel, responsavel_nome, responsavel_contato, telefone_responsavel,
        status, import_id
      )
      VALUES (
        p_escola_id, r.numero_processo, v_clean_nome, v_clean_nome, v_clean_data_nascimento, v_clean_sexo,
        NULLIF(v_clean_aluno_telefone, ''), upper(trim(r.bi_numero)), v_clean_nif, v_clean_email,
        v_clean_responsavel,
        v_clean_telefone,
        lower(trim(r.encarregado_email)),
        v_clean_responsavel, v_clean_responsavel, v_clean_telefone, v_clean_telefone,
        'ativo', p_import_id
      )
      ON CONFLICT (escola_id, numero_processo) DO UPDATE SET
        nome = EXCLUDED.nome,
        nome_completo = EXCLUDED.nome_completo,
        data_nascimento = COALESCE(EXCLUDED.data_nascimento, public.alunos.data_nascimento),
        sexo = COALESCE(EXCLUDED.sexo, public.alunos.sexo),
        telefone = COALESCE(EXCLUDED.telefone, public.alunos.telefone),
        bi_numero = EXCLUDED.bi_numero,
        nif = COALESCE(EXCLUDED.nif, public.alunos.nif),
        email = COALESCE(EXCLUDED.email, public.alunos.email),
        encarregado_nome = COALESCE(EXCLUDED.encarregado_nome, public.alunos.encarregado_nome),
        encarregado_telefone = COALESCE(EXCLUDED.encarregado_telefone, public.alunos.encarregado_telefone),
        encarregado_email = COALESCE(EXCLUDED.encarregado_email, public.alunos.encarregado_email),
        responsavel = COALESCE(EXCLUDED.responsavel, public.alunos.responsavel),
        responsavel_nome = COALESCE(EXCLUDED.responsavel_nome, public.alunos.responsavel_nome),
        responsavel_contato = COALESCE(EXCLUDED.responsavel_contato, public.alunos.responsavel_contato),
        telefone_responsavel = COALESCE(EXCLUDED.telefone_responsavel, public.alunos.telefone_responsavel),
        status = COALESCE(EXCLUDED.status, public.alunos.status),
        import_id = COALESCE(EXCLUDED.import_id, public.alunos.import_id),
        updated_at = now()
      RETURNING id INTO v_aluno_id;

      v_curso_id := NULL;
      IF v_curso_codigo_mapeado IS NOT NULL AND v_curso_codigo_mapeado <> '' THEN
        SELECT id INTO v_curso_id FROM public.cursos
        WHERE escola_id = p_escola_id
          AND upper(regexp_replace(codigo, '[^a-zA-Z0-9]', '', 'g')) = v_curso_codigo_mapeado;

        IF v_curso_id IS NULL THEN
          INSERT INTO public.cursos (escola_id, nome, codigo, status_aprovacao, import_id)
          VALUES (
            p_escola_id,
            'Curso ' || v_curso_codigo_mapeado,
            v_curso_codigo_mapeado,
            v_new_curso_status,
            p_import_id
          )
          RETURNING id INTO v_curso_id;
          v_cursos_created := v_cursos_created + 1;
        END IF;
      END IF;

      v_turma_id := NULL;
      SELECT id INTO v_turma_id FROM public.turmas 
      WHERE escola_id = p_escola_id 
        AND ano_letivo = p_ano_letivo
        AND upper(regexp_replace(turma_codigo, '[^a-zA-Z0-9]', '', 'g')) = v_clean_turma_codigo;

      IF v_turma_id IS NULL THEN
        INSERT INTO public.turmas (
          escola_id, ano_letivo, turma_codigo, nome, 
          status_validacao, curso_id, import_id
        )
        VALUES (
          p_escola_id, p_ano_letivo, r.turma_codigo, 
          r.turma_codigo || ' (Imp. Auto)', 'rascunho', 
          v_curso_id,
          p_import_id
        )
        RETURNING id INTO v_turma_id;
        
        v_turmas_created := v_turmas_created + 1;
      END IF;

      INSERT INTO public.matriculas (
        escola_id, aluno_id, turma_id, ano_letivo, session_id, status, ativo, 
        numero_matricula, data_matricula
      )
      VALUES (
        p_escola_id, v_aluno_id, v_turma_id, p_ano_letivo,
        (select al.id from public.anos_letivos al where al.escola_id = p_escola_id and al.ano = p_ano_letivo limit 1),
        'ativo', true,
        (SELECT numero_processo FROM public.alunos WHERE id = v_aluno_id) || '/' || p_ano_letivo, now()
      )
      ON CONFLICT (escola_id, aluno_id, ano_letivo) DO NOTHING;

      v_total_imported := v_total_imported + 1;

    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public.import_errors (import_id, row_number, message, raw_value)
      VALUES (p_import_id, r.row_number, SQLERRM, r.nome);
      v_total_errors := v_total_errors + 1;
    END;
  END LOOP;

  RETURN json_build_object(
    'imported', v_total_imported, 
    'errors', v_total_errors, 
    'turmas_created', v_turmas_created,
    'cursos_created', v_cursos_created
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.importar_alunos_v4(p_import_id uuid, p_escola_id uuid, p_modo text DEFAULT 'migracao'::text, p_data_inicio_financeiro date DEFAULT NULL::date)
 RETURNS TABLE(ok boolean, imported integer, turmas_created integer, matriculas_pendentes integer, errors integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r record;
  v_aluno_id uuid;
  v_turma_id uuid;
  v_turma_status text;
  v_turma_curso_id uuid;
  v_turma_classe_id uuid;
  v_curso_id uuid;
  v_classe_id uuid;
  v_imported int := 0;
  v_matriculas_pendentes int := 0;
  v_erros int := 0;
  v_turmas_created int := 0;
  v_code text;
  v_course_code text;
  v_class_num int;
  v_shift text;
  v_section text;
  v_ano_letivo int;
  v_rowcount int;
  v_curriculo_publicado boolean := false;
  v_matricula_status text := 'pendente';
  v_matricula_ativo boolean := false;
  v_existing_turmas_count int := 0;
  v_existing_classes_count int := 0;
begin
  for r in
    select
      sa.*,
      sa.encarregado_nome as nome_encarregado,
      sa.encarregado_telefone as telefone_encarregado,
      sa.encarregado_email as email_encarregado
    from public.staging_alunos sa
    where sa.import_id = p_import_id
  loop
    begin
      v_aluno_id := null;

      if nullif(btrim(r.bi_numero), '') is not null then
        select a.id into v_aluno_id
        from public.alunos a
        where a.escola_id = p_escola_id
          and a.bi_numero = btrim(r.bi_numero)
        limit 1;
      end if;

      if v_aluno_id is null
         and nullif(btrim(r.nome), '') is not null
         and r.data_nascimento is not null
      then
        select a.id into v_aluno_id
        from public.alunos a
        where a.escola_id = p_escola_id
          and lower(a.nome_completo) = lower(btrim(r.nome))
          and a.data_nascimento = r.data_nascimento::date
        limit 1;
      end if;

      if v_aluno_id is null then
        insert into public.alunos (
          escola_id, nome, nome_completo, data_nascimento,
          bi_numero, nif, sexo, telefone,
          encarregado_nome, encarregado_telefone, encarregado_email,
          numero_processo_legado,
          status, import_id
        ) values (
          p_escola_id,
          coalesce(nullif(btrim(r.nome), ''), nullif(btrim(r.raw_data->>'NOME_COMPLETO'), '')),
          coalesce(nullif(btrim(r.nome), ''), nullif(btrim(r.raw_data->>'NOME_COMPLETO'), '')),
          coalesce(r.data_nascimento::date, (r.raw_data->>'DATA_NASCIMENTO')::date),
          coalesce(nullif(btrim(r.bi_numero), ''), nullif(btrim(r.raw_data->>'BI_NUMERO'), '')),
          coalesce(nullif(btrim(r.nif), ''), nullif(btrim(r.raw_data->>'NIF'), '')),
          coalesce(nullif(upper(btrim(r.sexo)), ''), nullif(upper(btrim(r.raw_data->>'GENERO')), '')),
          coalesce(nullif(btrim(r.telefone), ''), nullif(btrim(r.raw_data->>'TELEFONE'), '')),
          coalesce(nullif(btrim(r.nome_encarregado), ''), nullif(btrim(r.raw_data->>'NOME_ENCARREGADO'), '')),
          coalesce(nullif(btrim(r.telefone_encarregado), ''), nullif(btrim(r.raw_data->>'TELEFONE_ENCARREGADO'), '')),
          lower(coalesce(nullif(btrim(r.email_encarregado), ''), nullif(btrim(r.raw_data->>'EMAIL_ENCARREGADO'), ''))),
          coalesce(nullif(btrim(r.numero_processo), ''), nullif(btrim(r.raw_data->>'NUMERO_PROCESSO'), '')),
          'ativo',
          p_import_id
        )
        returning id into v_aluno_id;
      else
        update public.alunos a
        set
          nome = coalesce(nullif(btrim(r.nome), ''), nullif(btrim(r.raw_data->>'NOME_COMPLETO'), ''), a.nome),
          nome_completo = coalesce(nullif(btrim(r.nome), ''), nullif(btrim(r.raw_data->>'NOME_COMPLETO'), ''), a.nome_completo),
          data_nascimento = coalesce(r.data_nascimento::date, (r.raw_data->>'DATA_NASCIMENTO')::date, a.data_nascimento),
          bi_numero = coalesce(nullif(btrim(r.bi_numero), ''), nullif(btrim(r.raw_data->>'BI_NUMERO'), ''), a.bi_numero),
          nif = coalesce(nullif(btrim(r.nif), ''), nullif(btrim(r.raw_data->>'NIF'), ''), a.nif),
          sexo = coalesce(nullif(upper(btrim(r.sexo)), ''), nullif(upper(btrim(r.raw_data->>'GENERO')), ''), a.sexo),
          telefone = coalesce(nullif(btrim(r.telefone), ''), nullif(btrim(r.raw_data->>'TELEFONE'), ''), a.telefone),
          encarregado_nome = coalesce(nullif(btrim(r.nome_encarregado), ''), nullif(btrim(r.raw_data->>'NOME_ENCARREGADO'), ''), a.encarregado_nome),
          encarregado_telefone = coalesce(nullif(btrim(r.telefone_encarregado), ''), nullif(btrim(r.raw_data->>'TELEFONE_ENCARREGADO'), ''), a.encarregado_telefone),
          encarregado_email = coalesce(lower(nullif(btrim(r.email_encarregado), '')), lower(nullif(btrim(r.raw_data->>'EMAIL_ENCARREGADO'), '')), a.encarregado_email),
          numero_processo_legado = coalesce(a.numero_processo_legado, nullif(btrim(r.numero_processo), ''), nullif(btrim(r.raw_data->>'NUMERO_PROCESSO'), '')),
          updated_at = now(),
          import_id = p_import_id
        where a.id = v_aluno_id;
      end if;

      v_imported := v_imported + 1;

      if p_modo = 'migracao' and (
        nullif(btrim(r.turma_codigo), '') is not null
        or r.classe_numero is not null
        or nullif(btrim(r.turno_codigo), '') is not null
        or nullif(btrim(r.turma_letra), '') is not null
      ) then
        v_turma_id := null;
        v_turma_status := null;
        v_turma_curso_id := null;
        v_turma_classe_id := null;
        v_curso_id := null;
        v_classe_id := null;
        v_existing_turmas_count := 0;
        v_existing_classes_count := 0;
        v_ano_letivo := coalesce(r.ano_letivo, extract(year from now())::int);

        v_code := nullif(upper(regexp_replace(trim(coalesce(r.turma_codigo, '')), '\s+', '', 'g')), '');
        v_course_code := nullif(upper(regexp_replace(coalesce(r.curso_codigo, ''), '[^A-Za-z0-9]', '', 'g')), '');
        v_class_num := r.classe_numero;
        v_shift := case
          when upper(coalesce(r.turno_codigo, '')) in ('M', 'MANHA', 'MANHÃ', 'MATUTINO') then 'M'
          when upper(coalesce(r.turno_codigo, '')) in ('T', 'TARDE', 'VESPERTINO') then 'T'
          when upper(coalesce(r.turno_codigo, '')) in ('N', 'NOITE', 'NOTURNO') then 'N'
          when left(upper(coalesce(r.turno_codigo, '')), 1) in ('M', 'T', 'N') then left(upper(coalesce(r.turno_codigo, '')), 1)
          else null
        end;
        v_section := nullif(upper(regexp_replace(coalesce(r.turma_letra, ''), '[^A-Za-z0-9]', '', 'g')), '');

        if v_code is not null and v_code ~ '^[A-Z0-9]{2,8}-\d{1,2}-(M|T|N)-[A-Z0-9]{1,3}$' then
          v_course_code := coalesce(v_course_code, split_part(v_code, '-', 1));
          v_class_num := coalesce(v_class_num, split_part(v_code, '-', 2)::int);
          v_shift := coalesce(v_shift, split_part(v_code, '-', 3));
          v_section := coalesce(v_section, split_part(v_code, '-', 4));
        elsif v_course_code is not null and v_class_num is not null and v_shift is not null and v_section is not null then
          v_code := format('%s-%s-%s-%s', v_course_code, v_class_num, v_shift, v_section);
        else
          v_code := null;
        end if;

        if v_code is null and v_class_num is not null and v_shift is not null and v_section is not null then
          select
            count(*),
            max(t.id),
            max(t.status_validacao),
            max(t.curso_id),
            max(t.classe_id),
            max(t.turma_codigo)
          into
            v_existing_turmas_count,
            v_turma_id,
            v_turma_status,
            v_turma_curso_id,
            v_turma_classe_id,
            v_code
          from public.turmas t
          where t.escola_id = p_escola_id
            and t.ano_letivo = v_ano_letivo
            and t.classe_num = v_class_num
            and upper(coalesce(t.turno, '')) = v_shift
            and upper(coalesce(t.letra, '')) = v_section;

          if v_existing_turmas_count > 1 then
            raise exception 'Turma ambígua para %ª classe % turno turma % no ano %. Informe CURSO_CODIGO ou TURMA_CODIGO.',
              v_class_num, v_shift, v_section, v_ano_letivo;
          end if;

          if v_existing_turmas_count = 1 then
            v_curso_id := v_turma_curso_id;
            v_classe_id := v_turma_classe_id;
          end if;
        end if;

        if v_code is null and v_course_code is null and v_class_num is not null then
          select
            count(*),
            max(cl.id),
            max(cl.curso_id),
            max(coalesce(nullif(c.course_code, ''), nullif(c.codigo, '')))
          into
            v_existing_classes_count,
            v_classe_id,
            v_curso_id,
            v_course_code
          from public.classes cl
          join public.cursos c on c.id = cl.curso_id
          where cl.escola_id = p_escola_id
            and cl.numero = v_class_num;

          if v_existing_classes_count > 1 then
            raise exception 'Classe % encontrada em múltiplos cursos. Informe CURSO_CODIGO ou TURMA_CODIGO para concluir a importação.', v_class_num;
          end if;

          if v_existing_classes_count = 1 and v_shift is not null and v_section is not null and v_course_code is not null then
            v_course_code := upper(regexp_replace(v_course_code, '[^A-Za-z0-9]', '', 'g'));
            v_code := format('%s-%s-%s-%s', v_course_code, v_class_num, v_shift, v_section);
          end if;
        end if;

        if v_code is null then
          raise exception 'Dados de turma insuficientes para %s. Informe TURMA_CODIGO ou mapeie CURSO_CODIGO + CLASSE_NUMERO + TURNO_CODIGO + TURMA_LETRA.',
            coalesce(r.nome, 'aluno sem nome');
        end if;

        if v_course_code is null then
          v_course_code := split_part(v_code, '-', 1);
        end if;
        if v_class_num is null then
          v_class_num := split_part(v_code, '-', 2)::int;
        end if;
        if v_shift is null then
          v_shift := split_part(v_code, '-', 3);
        end if;
        if v_section is null then
          v_section := split_part(v_code, '-', 4);
        end if;

        if v_curso_id is null then
          select c.id into v_curso_id
          from public.cursos c
          where c.escola_id = p_escola_id
            and upper(regexp_replace(coalesce(nullif(c.course_code, ''), nullif(c.codigo, '')), '[^A-Za-z0-9]', '', 'g')) = v_course_code
          limit 1;
        end if;

        select t.id, t.status_validacao, t.curso_id, t.classe_id
        into v_turma_id, v_turma_status, v_turma_curso_id, v_turma_classe_id
        from public.turmas t
        where t.escola_id = p_escola_id
          and t.ano_letivo = v_ano_letivo
          and t.turma_codigo = v_code
        limit 1;

        if v_turma_id is not null and v_turma_curso_id is not null then
          v_curso_id := v_turma_curso_id;
        end if;

        if v_turma_id is not null and v_turma_classe_id is not null then
          v_classe_id := v_turma_classe_id;
        end if;

        if v_curso_id is null then
          raise exception 'Curso não encontrado para sigla % na turma %.', v_course_code, v_code;
        end if;

        if v_classe_id is null then
          select cl.id into v_classe_id
          from public.classes cl
          where cl.escola_id = p_escola_id
            and cl.curso_id = v_curso_id
            and cl.numero = v_class_num
          limit 1;
        end if;

        if v_classe_id is null then
          raise exception 'Classe % não encontrada para o curso % na turma %.', v_class_num, v_course_code, v_code;
        end if;

        v_curriculo_publicado := false;
        if v_curso_id is not null then
          select exists (
            select 1
            from public.curso_curriculos cc
            join public.anos_letivos al on al.id = cc.ano_letivo_id
            where cc.escola_id = p_escola_id
              and cc.curso_id = v_curso_id
              and al.ano = v_ano_letivo
              and cc.status = 'published'
          ) into v_curriculo_publicado;
        end if;

        if v_turma_id is null then
          insert into public.turmas (
            escola_id, ano_letivo, turma_code, curso_id, classe_id, classe_num, turno, letra,
            turma_codigo, nome, status_validacao, import_id
          )
          values (
            p_escola_id, v_ano_letivo, v_code, v_curso_id, v_classe_id, v_class_num, v_shift, v_section,
            v_code, v_code || ' (Auto)',
            case when v_curriculo_publicado then 'ativo' else 'rascunho' end,
            p_import_id
          )
          on conflict (escola_id, ano_letivo, turma_codigo)
          do update set
            curso_id = excluded.curso_id,
            classe_id = coalesce(public.turmas.classe_id, excluded.classe_id),
            classe_num = excluded.classe_num,
            turno = excluded.turno,
            letra = excluded.letra
          returning id, status_validacao into v_turma_id, v_turma_status;

          v_turmas_created := v_turmas_created + 1;
        end if;

        if v_turma_id is not null then
          v_matricula_status := 'pendente';
          v_matricula_ativo := false;
          if v_turma_status = 'ativo' and v_curriculo_publicado then
            v_matricula_status := 'ativo';
            v_matricula_ativo := true;
          end if;

          insert into public.matriculas (
            escola_id, aluno_id, turma_id, ano_letivo,
            session_id,
            status, ativo, data_matricula,
            numero_matricula,
            data_inicio_financeiro,
            import_id
          ) values (
            p_escola_id, v_aluno_id, v_turma_id, v_ano_letivo,
            (select al.id from public.anos_letivos al where al.escola_id = p_escola_id and al.ano = v_ano_letivo limit 1),
            v_matricula_status, v_matricula_ativo, current_date,
            null,
            p_data_inicio_financeiro,
            p_import_id
          )
          on conflict (escola_id, aluno_id, ano_letivo) do nothing;

          get diagnostics v_rowcount = row_count;
          if v_rowcount > 0 and v_matricula_status = 'pendente' then
            v_matriculas_pendentes := v_matriculas_pendentes + 1;
          end if;
        end if;
      end if;

    exception when others then
      v_erros := v_erros + 1;
      insert into public.import_errors(import_id, message, raw_value)
      values (p_import_id, sqlerrm, coalesce(r.nome, ''));
    end;
  end loop;

  return query select true, v_imported, v_turmas_created, v_matriculas_pendentes, v_erros;
end;
$function$;

CREATE OR REPLACE FUNCTION public.fn_transitar_alunos(p_escola_id uuid, p_turma_origem_id uuid, p_turma_destino_id uuid, p_ano_letivo_origem integer, p_ano_letivo_dest integer, p_aluno_ids uuid[])
 RETURNS TABLE(aluno_id uuid, sucesso boolean, erro text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_escola_id uuid := public.current_tenant_escola_id();
  v_aluno_id uuid;
  v_matricula_origem record;
  v_turma_destino record;
  v_tem_curriculo_publicado boolean;
  v_total_em_atraso numeric(14,2);
BEGIN
  IF v_escola_id IS NULL OR p_escola_id IS DISTINCT FROM v_escola_id THEN
    RAISE EXCEPTION 'AUTH: escola_id inválido.';
  END IF;

  IF NOT public.user_has_role_in_school(v_escola_id, ARRAY['secretaria', 'admin', 'admin_escola', 'staff_admin']) THEN
    RAISE EXCEPTION 'AUTH: Permissão negada.';
  END IF;

  SELECT t.id, t.curso_id, t.classe_id, t.ano_letivo
  INTO v_turma_destino
  FROM public.turmas t
  WHERE t.id = p_turma_destino_id
    AND t.escola_id = p_escola_id;

  IF v_turma_destino.id IS NULL THEN
    RAISE EXCEPTION 'DATA: Turma de destino não encontrada.';
  END IF;

  IF v_turma_destino.ano_letivo <> p_ano_letivo_dest THEN
    RAISE EXCEPTION 'LOGIC: Turma de destino fora do ano letivo de destino.';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.anos_letivos al
    JOIN public.curso_curriculos cc ON cc.ano_letivo_id = al.id
    WHERE al.escola_id = p_escola_id
      AND al.ano = p_ano_letivo_dest
      AND cc.escola_id = p_escola_id
      AND cc.curso_id = v_turma_destino.curso_id
      AND (cc.classe_id IS NULL OR cc.classe_id = v_turma_destino.classe_id)
      AND cc.status = 'published'
  ) INTO v_tem_curriculo_publicado;

  IF NOT v_tem_curriculo_publicado THEN
    RAISE EXCEPTION 'LOGIC: Estrutura académica do ano destino não está pronta (currículo não publicado).';
  END IF;

  FOREACH v_aluno_id IN ARRAY p_aluno_ids LOOP
    BEGIN
      SELECT m.id, m.status, m.aluno_id
      INTO v_matricula_origem
      FROM public.matriculas m
      WHERE m.aluno_id = v_aluno_id
        AND m.turma_id = p_turma_origem_id
        AND m.ano_letivo = p_ano_letivo_origem
        AND m.escola_id = p_escola_id
      LIMIT 1;

      IF v_matricula_origem.id IS NULL THEN
        RETURN QUERY SELECT v_aluno_id, false, 'Matrícula de origem não encontrada';
        CONTINUE;
      END IF;

      IF public.canonicalize_matricula_status_text(v_matricula_origem.status) <> 'concluido' THEN
        IF public.canonicalize_matricula_status_text(v_matricula_origem.status) = 'reprovado' THEN
          RETURN QUERY SELECT v_aluno_id, false, 'Aluno reprovado na classe de origem';
        ELSE
          RETURN QUERY SELECT v_aluno_id, false, 'Notas incompletas ou matrícula não concluída';
        END IF;
        CONTINUE;
      END IF;

      SELECT COALESCE(SUM(GREATEST(COALESCE(m.valor_previsto, m.valor, 0) - COALESCE(m.valor_pago_total, 0), 0)), 0)
      INTO v_total_em_atraso
      FROM public.mensalidades m
      WHERE m.escola_id = p_escola_id
        AND m.matricula_id = v_matricula_origem.id
        AND m.status NOT IN ('pago', 'isento', 'cancelado');

      IF COALESCE(v_total_em_atraso, 0) > 0 THEN
        RETURN QUERY SELECT v_aluno_id, false, 'Dívidas em aberto na matrícula anterior';
        CONTINUE;
      END IF;

      IF EXISTS (
        SELECT 1
        FROM public.matriculas m
        WHERE m.escola_id = p_escola_id
          AND m.aluno_id = v_aluno_id
          AND m.ano_letivo = p_ano_letivo_dest
          AND m.turma_id = p_turma_destino_id
      ) THEN
        RETURN QUERY SELECT v_aluno_id, false, 'Aluno já possui matrícula na turma de destino';
        CONTINUE;
      END IF;

      INSERT INTO public.matriculas (
        escola_id,
        aluno_id,
        turma_id,
        ano_letivo,
        session_id,
        status,
        ativo,
        data_matricula,
        origem_transicao_matricula_id,
        created_at,
        updated_at
      )
      VALUES (
        p_escola_id,
        v_aluno_id,
        p_turma_destino_id,
        p_ano_letivo_dest,
        (select al.id from public.anos_letivos al where al.escola_id = p_escola_id and al.ano = p_ano_letivo_dest limit 1),
        'pendente',
        true,
        CURRENT_DATE,
        v_matricula_origem.id,
        now(),
        now()
      );

      RETURN QUERY SELECT v_aluno_id, true, NULL::text;
    EXCEPTION
      WHEN OTHERS THEN
        RETURN QUERY SELECT v_aluno_id, false, SQLERRM;
    END;
  END LOOP;
END;
$function$;

