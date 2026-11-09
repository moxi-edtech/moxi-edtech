-- Permitir apuramento normal de matrículas administrativamente pendentes,
-- sem alterar matriculas.status ou inferir aprovação.
-- Critério RAA: resolver disciplina canónica pela matriz do curso quando
-- a configuração herdada não utiliza avaliacao_disciplina_id.
-- A escrita continua sujeita ao ano letivo ativo, calendário, locks e papéis.
-- Origem com resultado histórico definitivo nunca recebe novas notas por esta via.
-- Gerado a partir das definições de produção verificadas em 2026-11-09.
-- Aplicar após a cadeia existente 20271105; não antecipar estas redefinições.
BEGIN;

-- lancar_notas_batch
CREATE OR REPLACE FUNCTION public.lancar_notas_batch(p_escola_id uuid, p_turma_id uuid, p_disciplina_id uuid, p_turma_disciplina_id uuid, p_trimestre integer, p_tipo_avaliacao text, p_notas jsonb, p_is_isento boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth'
AS $function$
DECLARE
  v_actor_id uuid := public.safe_auth_uid();
  v_claims jsonb := '{}'::jsonb;
  v_is_service_role boolean := false;
  v_is_staff boolean := false;
  v_can_write_pending boolean := false;
  v_professor_id uuid;
  v_turma record;
  v_turma_disciplina record;
  v_disciplina_matriz_id uuid;
  v_ano_ativo boolean := false;
  v_periodo_letivo_id uuid;
  v_regime jsonb;
  v_escala text;
  v_nota_max numeric(6,2);
  v_avaliacao_id uuid;
  v_matricula_id uuid;
  v_aluno_id uuid;
  v_valor numeric;
  v_rows_to_upsert jsonb[] := '{}';
  nota_record jsonb;
  v_inserted_count bigint := 0;
  v_updated_count bigint := 0;
  v_portal text := 'professor';
BEGIN
  BEGIN
    v_claims := COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
  EXCEPTION WHEN OTHERS THEN
    v_claims := '{}'::jsonb;
  END;

  v_is_service_role :=
    COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''), '') = 'service_role'
    OR COALESCE(v_claims->>'role', '') = 'service_role';

  IF p_notas IS NULL OR jsonb_typeof(p_notas) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'DATA: O lote de notas deve ser um array.';
  END IF;

  IF jsonb_array_length(p_notas) < 1 OR jsonb_array_length(p_notas) > 50 THEN
    RAISE EXCEPTION 'DATA: O lote de notas deve conter entre 1 e 50 alunos.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM (
      SELECT item->>'aluno_id' AS aluno_id
      FROM jsonb_array_elements(p_notas) AS item
      GROUP BY item->>'aluno_id'
      HAVING count(*) > 1
    ) duplicated
  ) THEN
    RAISE EXCEPTION 'DATA: O lote contém aluno_id duplicado.';
  END IF;

  IF p_trimestre NOT BETWEEN 1 AND 3 THEN
    RAISE EXCEPTION 'DATA: Trimestre inválido.';
  END IF;

  IF NULLIF(btrim(COALESCE(p_tipo_avaliacao, '')), '') IS NULL
     OR length(btrim(p_tipo_avaliacao)) > 40 THEN
    RAISE EXCEPTION 'DATA: Tipo de avaliação inválido.';
  END IF;

  IF NOT v_is_service_role THEN
    IF v_actor_id IS NULL THEN
      RAISE EXCEPTION 'AUTH: Utilizador não autenticado.';
    END IF;

    IF public.current_tenant_escola_id() IS DISTINCT FROM p_escola_id THEN
      RAISE EXCEPTION 'AUTH: Escola fora do tenant ativo.';
    END IF;

    v_is_staff := public.user_has_role_in_school(
      p_escola_id,
      ARRAY[
        'secretaria',
        'secretaria_financeiro',
        'admin_financeiro',
        'admin_secretaria',
        'admin',
        'admin_escola',
        'staff_admin',
        'diretor'
      ]
    );

    -- The existing staff set includes financial roles. Those roles must
    -- NOT gain new powers over a pending academic record.
    -- user_has_role_in_school expands 'secretaria' to financial roles.
    -- For an exceptional pending-grade write we intentionally use exact roles.
    v_can_write_pending := EXISTS (
      SELECT 1 FROM public.escola_users eu
      WHERE eu.escola_id = p_escola_id AND eu.user_id = v_actor_id
        AND eu.papel IN ('secretaria','admin_secretaria','admin','admin_escola','staff_admin','diretor')
    );

    IF NOT v_is_staff THEN
      SELECT p.id
      INTO v_professor_id
      FROM public.professores p
      WHERE p.profile_id = v_actor_id
        AND p.escola_id = p_escola_id
      LIMIT 1;

      IF v_professor_id IS NULL THEN
        RAISE EXCEPTION 'AUTH: Professor não encontrado para este utilizador.';
      END IF;
    ELSE
      v_portal := 'secretaria';
    END IF;
  ELSE
    v_portal := 'service_role';
  END IF;

  SELECT
    t.id,
    t.escola_id,
    t.session_id,
    t.ano_letivo,
    t.status_fecho
  INTO v_turma
  FROM public.turmas t
  WHERE t.id = p_turma_id
    AND t.escola_id = p_escola_id;

  IF v_turma.id IS NULL THEN
    RAISE EXCEPTION 'DATA: Turma não encontrada.';
  END IF;

  IF v_turma.session_id IS NULL THEN
    RAISE EXCEPTION 'DATA: Turma sem vínculo ao ano letivo canónico.';
  END IF;

  SELECT COALESCE(al.ativo, false)
  INTO v_ano_ativo
  FROM public.anos_letivos al
  WHERE al.id = v_turma.session_id
    AND al.escola_id = p_escola_id
    AND al.ano = v_turma.ano_letivo;

  IF NOT COALESCE(v_ano_ativo, false) THEN
    RAISE EXCEPTION 'ACADEMIC_YEAR_READ_ONLY: O ano letivo não está ativo para lançamento de notas.';
  END IF;

  SELECT
    td.id,
    td.professor_id,
    td.curso_matriz_id,
    td.periodos_ativos
  INTO v_turma_disciplina
  FROM public.turma_disciplinas td
  WHERE td.id = p_turma_disciplina_id
    AND td.escola_id = p_escola_id
    AND td.turma_id = p_turma_id;

  IF v_turma_disciplina.id IS NULL THEN
    RAISE EXCEPTION 'DATA: Disciplina não atribuída a esta turma.';
  END IF;
  IF COALESCE(cardinality(v_turma_disciplina.periodos_ativos),0) > 0
     AND NOT p_trimestre = ANY(v_turma_disciplina.periodos_ativos) THEN
    RAISE EXCEPTION 'DATA: Disciplina não lecionada neste trimestre.';
  END IF;

  SELECT cm.disciplina_id
  INTO v_disciplina_matriz_id
  FROM public.curso_matriz cm
  WHERE cm.id = v_turma_disciplina.curso_matriz_id
    AND cm.escola_id = p_escola_id;

  IF v_disciplina_matriz_id IS DISTINCT FROM p_disciplina_id THEN
    RAISE EXCEPTION 'DATA: A disciplina não corresponde à matriz atribuída à turma.';
  END IF;

  IF NOT v_is_service_role AND NOT v_is_staff THEN
    IF v_turma_disciplina.professor_id IS DISTINCT FROM v_professor_id THEN
      IF NOT EXISTS (
        SELECT 1
        FROM public.turma_disciplinas_professores tdp
        WHERE tdp.escola_id = p_escola_id
          AND tdp.turma_id = p_turma_id
          AND tdp.disciplina_id = p_disciplina_id
          AND tdp.professor_id = v_professor_id
      ) THEN
        RAISE EXCEPTION 'AUTH: Professor não atribuído a esta disciplina/turma.';
      END IF;
    END IF;
  END IF;

  SELECT pl.id
  INTO v_periodo_letivo_id
  FROM public.periodos_letivos pl
  WHERE pl.escola_id = p_escola_id
    AND pl.ano_letivo_id = v_turma.session_id
    AND pl.tipo = 'TRIMESTRE'
    AND pl.numero = p_trimestre
    AND pl.offering_id IS NULL
  LIMIT 1;

  IF v_periodo_letivo_id IS NULL THEN
    RAISE EXCEPTION 'DATA: Período letivo não encontrado para o ano selecionado.';
  END IF;

  v_regime := public.resolve_regime_academico(p_turma_id);
  v_escala := COALESCE(v_regime->>'escala', '');

  IF v_escala = 'quantitativa_primario' THEN
    v_nota_max := 10;
  ELSIF v_escala = 'quantitativa_secundario' THEN
    v_nota_max := 20;
  ELSE
    RAISE EXCEPTION 'DATA: A escala académica % não aceita lançamento numérico neste fluxo.', NULLIF(v_escala, '');
  END IF;

  INSERT INTO public.avaliacoes (
    escola_id,
    turma_disciplina_id,
    periodo_letivo_id,
    ano_letivo,
    trimestre,
    nome,
    tipo,
    peso,
    nota_max
  )
  VALUES (
    p_escola_id,
    p_turma_disciplina_id,
    v_periodo_letivo_id,
    v_turma.ano_letivo,
    p_trimestre,
    btrim(p_tipo_avaliacao),
    btrim(p_tipo_avaliacao),
    1,
    v_nota_max
  )
  ON CONFLICT (escola_id, turma_disciplina_id, ano_letivo, trimestre, tipo)
  DO UPDATE SET
    nome = EXCLUDED.nome,
    periodo_letivo_id = EXCLUDED.periodo_letivo_id,
    nota_max = EXCLUDED.nota_max
  RETURNING id INTO v_avaliacao_id;

  FOR nota_record IN SELECT value FROM jsonb_array_elements(p_notas)
  LOOP
    IF jsonb_typeof(nota_record) IS DISTINCT FROM 'object'
       OR NULLIF(nota_record->>'aluno_id', '') IS NULL THEN
      RAISE EXCEPTION 'DATA: aluno_id é obrigatório em todas as notas.';
    END IF;

    BEGIN
      v_aluno_id := (nota_record->>'aluno_id')::uuid;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'DATA: aluno_id inválido: %.', nota_record->>'aluno_id';
    END;

    IF p_is_isento THEN
      v_valor := NULL;
    ELSIF nota_record->'valor' IS NULL OR jsonb_typeof(nota_record->'valor') = 'null' THEN
      v_valor := NULL;
    ELSE
      BEGIN
        v_valor := (nota_record->>'valor')::numeric;
      EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'DATA: Nota inválida para o aluno %.', nota_record->>'aluno_id';
      END;

      IF v_valor < 0 OR v_valor > v_nota_max THEN
        RAISE EXCEPTION 'DATA: Nota deve estar entre 0 e % para esta turma.', v_nota_max;
      END IF;
    END IF;

    SELECT m.id
    INTO v_matricula_id
    FROM public.matriculas m
    WHERE m.escola_id = p_escola_id
      AND m.turma_id = p_turma_id
      AND m.aluno_id = v_aluno_id
      AND m.session_id = v_turma.session_id
      AND (
        m.ativo IS TRUE
        OR (
          v_can_write_pending
          AND m.status = 'pendente'
          AND m.ativo IS FALSE
          AND m.status_fecho_origem IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM public.historico_anos h
            WHERE h.escola_id = m.escola_id AND h.matricula_id = m.id
              AND h.resultado_final IS NOT NULL
          )
        )
      )
    ORDER BY m.ativo DESC, m.created_at DESC
    LIMIT 1;

    IF v_matricula_id IS NULL THEN
      RAISE EXCEPTION 'DATA: Aluno % não possui matrícula ativa nesta turma e ano letivo.', nota_record->>'aluno_id';
    END IF;

    v_rows_to_upsert := array_append(
      v_rows_to_upsert,
      jsonb_build_object(
        'escola_id', p_escola_id,
        'avaliacao_id', v_avaliacao_id,
        'matricula_id', v_matricula_id,
        'valor', v_valor,
        'is_isento', COALESCE(p_is_isento, false)
      )
    );
  END LOOP;

  WITH upserted AS (
    INSERT INTO public.notas (
      escola_id,
      avaliacao_id,
      matricula_id,
      valor,
      is_isento
    )
    SELECT
      (value->>'escola_id')::uuid,
      (value->>'avaliacao_id')::uuid,
      (value->>'matricula_id')::uuid,
      (value->>'valor')::numeric,
      (value->>'is_isento')::boolean
    FROM unnest(v_rows_to_upsert) AS value
    ON CONFLICT (escola_id, matricula_id, avaliacao_id)
    DO UPDATE SET
      valor = EXCLUDED.valor,
      is_isento = EXCLUDED.is_isento,
      updated_at = now()
    RETURNING (xmax = 0) AS inserted
  )
  SELECT
    count(*) FILTER (WHERE inserted),
    count(*) FILTER (WHERE NOT inserted)
  INTO v_inserted_count, v_updated_count
  FROM upserted;

  INSERT INTO public.audit_logs (
    escola_id,
    actor_id,
    action,
    entity,
    entity_id,
    portal,
    details
  )
  VALUES (
    p_escola_id,
    v_actor_id,
    'NOTA_LANCADA_BATCH',
    'notas',
    v_avaliacao_id::text,
    v_portal,
    jsonb_build_object(
      'is_isento', COALESCE(p_is_isento, false),
      'trimestre', p_trimestre,
      'tipo', btrim(p_tipo_avaliacao),
      'turma_id', p_turma_id,
      'disciplina_id', p_disciplina_id,
      'session_id', v_turma.session_id,
      'escala', v_escala,
      'nota_max', v_nota_max,
      'inserted', v_inserted_count,
      'updated', v_updated_count
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'inserted', v_inserted_count,
    'updated', v_updated_count,
    'escala', v_escala,
    'nota_max', v_nota_max
  );
END;
$function$;

-- guard_grade_period_source_and_window
CREATE OR REPLACE FUNCTION public.guard_grade_period_source_and_window()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth'
AS $function$
DECLARE
  v record;
  v_today date := (now() AT TIME ZONE 'Africa/Luanda')::date;
BEGIN
  SELECT a.escola_id, a.ano_letivo, a.trimestre,
         pl.id AS period_id, pl.numero AS period_num, pl.ano_letivo_id AS period_year_id,
         pl.data_inicio AS begins, pl.data_fim AS ends, pl.trava_notas_em AS lock_at,
         pl.source_template_id AS source_template_id,
         pl.source_item_id AS source_item_id,
         ct.is_oficial AS template_official, ct.estado::text AS template_status,
         ct.ano_base AS template_year,
         ci.numero AS item_number, ci.tipo::text AS item_type,
         ci.data_inicio AS item_start, ci.data_fim AS item_end,
         td.turma_id, t.session_id AS turma_year_id, t.ano_letivo AS turma_year,
         m.turma_id AS matricula_turma_id, m.session_id AS matricula_year_id, m.ano_letivo AS matricula_year,
         m.ativo AS matricula_active, m.status AS matricula_status,
         m.status_fecho_origem AS matricula_origin_closed
    INTO v
    FROM public.avaliacoes a
    JOIN public.turma_disciplinas td ON td.id = a.turma_disciplina_id
    JOIN public.turmas t ON t.id = td.turma_id
    JOIN public.periodos_letivos pl ON pl.id = a.periodo_letivo_id
    LEFT JOIN public.calendario_templates ct ON ct.id = pl.source_template_id
    LEFT JOIN public.calendario_template_items ci ON ci.id = pl.source_item_id
         AND ci.template_id = ct.id
    JOIN public.matriculas m ON m.id = NEW.matricula_id
   WHERE a.id = NEW.avaliacao_id
     AND a.escola_id = NEW.escola_id
     AND td.escola_id = NEW.escola_id
     AND t.escola_id = NEW.escola_id
     AND pl.escola_id = NEW.escola_id
     AND m.escola_id = NEW.escola_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'DATA: Contexto de avaliação não encontrado.';
  END IF;
  IF v.period_year_id IS DISTINCT FROM v.turma_year_id
     OR v.matricula_year_id IS DISTINCT FROM v.turma_year_id
     OR v.matricula_turma_id IS DISTINCT FROM v.turma_id
     OR v.ano_letivo IS DISTINCT FROM v.turma_year
     OR v.matricula_year IS DISTINCT FROM v.turma_year
     OR v.trimestre IS DISTINCT FROM v.period_num
     OR NOT (
       v.matricula_active IS TRUE
       OR (
         v.matricula_status = 'pendente'
         AND v.matricula_active IS FALSE
         AND v.matricula_origin_closed IS NULL
         AND auth.uid() IS NOT NULL
         AND public.current_tenant_escola_id() = NEW.escola_id
         AND EXISTS (
           SELECT 1 FROM public.escola_users eu
           WHERE eu.escola_id = NEW.escola_id AND eu.user_id = auth.uid()
             AND eu.papel IN ('secretaria','admin_secretaria','admin',
                              'admin_escola','staff_admin','diretor')
         )
         AND NOT EXISTS (
           SELECT 1 FROM public.historico_anos h
           WHERE h.escola_id = NEW.escola_id AND h.matricula_id = NEW.matricula_id
             AND h.resultado_final IS NOT NULL
         )
       )
     ) THEN
    RAISE EXCEPTION 'DATA: Avaliação, matrícula, turma, ano ou trimestre incompatíveis.';
  END IF;
  IF v.turma_year = 2026 AND (
       v.source_template_id IS NULL OR v.source_item_id IS NULL
       OR v.template_official IS DISTINCT FROM TRUE
       OR v.template_status IS DISTINCT FROM 'PUBLICADO'
       OR v.template_year IS DISTINCT FROM v.turma_year
       OR v.item_type IS DISTINCT FROM 'PERIODO_LETIVO'
       OR v.item_number IS DISTINCT FROM v.trimestre
       OR v.item_start IS DISTINCT FROM v.begins
       OR v.item_end IS DISTINCT FROM v.ends
     ) THEN
    RAISE EXCEPTION 'OFFICIAL_CALENDAR_NOT_RECONCILED: O trimestre não corresponde ao calendário oficial publicado.';
  END IF;
  IF v.begins IS NULL OR v.ends IS NULL OR v.begins > v.ends THEN
    RAISE EXCEPTION 'DATA: Datas do trimestre não configuradas.';
  END IF;
  IF v_today < v.begins THEN
    RAISE EXCEPTION 'DATA: O trimestre ainda não começou.';
  END IF;
  IF (v_today > v.ends OR (v.lock_at IS NOT NULL AND now() >= v.lock_at))
     AND NOT public.can_bypass_pauta_lock(NEW.escola_id, v.turma_id, NEW.avaliacao_id, auth.uid()) THEN
    RAISE EXCEPTION 'ACADEMIC_PERIOD_LOCKED: Período concluído. Solicite reabertura à direção.';
  END IF;
  RETURN NEW;
END;
$function$;

-- raa_nota_percurso_atual
CREATE OR REPLACE FUNCTION public.raa_nota_percurso_atual(p_escola_id uuid, p_matricula_id uuid, p_disciplina_id uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
 DECLARE result numeric;
 BEGIN
   IF auth.uid() IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.escola_users eu
     WHERE eu.escola_id=p_escola_id AND eu.user_id=auth.uid()) AND NOT EXISTS(
     SELECT 1 FROM public.matriculas m WHERE m.escola_id=p_escola_id AND m.id=p_matricula_id
     AND public.portal_user_can_access_aluno(m.aluno_id)) THEN
     RAISE EXCEPTION 'ACADEMIC_FORBIDDEN' USING ERRCODE='42501';
   END IF;
   SELECT avg(q.nota_final) INTO result FROM ( WITH configuracoes AS (
         SELECT configuracoes_escola.escola_id,
            COALESCE(configuracoes_escola.modelo_avaliacao, 'SIMPLIFICADO'::text) AS modelo_avaliacao,
            configuracoes_escola.avaliacao_config
           FROM configuracoes_escola
        ), componentes_escola AS (
         SELECT c.escola_id,
            upper(comp.code) AS code,
            comp.peso,
            COALESCE(comp.ativo, true) AS ativo
           FROM configuracoes c
             LEFT JOIN LATERAL jsonb_to_recordset(
                CASE
                    WHEN jsonb_typeof(c.avaliacao_config -> 'componentes'::text) = 'array'::text THEN c.avaliacao_config -> 'componentes'::text
                    ELSE '[]'::jsonb
                END) comp(code text, peso numeric, ativo boolean) ON true
        ), componentes_modelo AS (
         SELECT ma.id AS modelo_id,
            upper(comp.code) AS code,
            comp.peso,
            COALESCE(comp.ativo, true) AS ativo
           FROM modelos_avaliacao ma
             LEFT JOIN LATERAL jsonb_to_recordset(
                CASE
                    WHEN jsonb_typeof(ma.componentes) = 'array'::text THEN ma.componentes
                    ELSE '[]'::jsonb
                END) comp(code text, peso numeric, ativo boolean) ON true
        ), base AS (
         SELECT m.id AS matricula_id,
            m.aluno_id,
            m.turma_id,
            m.escola_id,
            m.ano_letivo,
            td.id AS turma_disciplina_id,
            COALESCE(td.conta_para_media_med, true) AS conta_para_media_med,
            cm.disciplina_id,
            cm.curso_id,
            cm.classe_id,
            cm.avaliacao_mode,
            cm.avaliacao_modelo_id,
            cm.avaliacao_disciplina_id,
            cm.modelo_excecao_id,
            dc.nome AS disciplina_nome,
            dc.sigla AS disciplina_sigla
           FROM matriculas m
             JOIN turma_disciplinas td ON td.turma_id = m.turma_id AND td.escola_id = m.escola_id
             JOIN curso_matriz cm ON cm.id = td.curso_matriz_id
             JOIN disciplinas_catalogo dc ON dc.id = cm.disciplina_id
          WHERE m.status = ANY (ARRAY['ativo'::text, 'ativa'::text, 'active'::text, 'pendente'::text])
        ), matriz_base AS (
         SELECT cm.escola_id,
            cm.curso_id,
            cm.classe_id,
            cm.disciplina_id,
            cm.avaliacao_modelo_id
           FROM curso_matriz cm
          WHERE cm.ativo = true
        ), avaliacoes AS (
         SELECT b.matricula_id,
            b.aluno_id,
            b.turma_id,
            b.escola_id,
            b.ano_letivo,
            b.turma_disciplina_id,
            b.conta_para_media_med,
            b.disciplina_id,
            b.curso_id,
            b.classe_id,
            b.avaliacao_mode,
            b.avaliacao_modelo_id,
            b.avaliacao_disciplina_id,
            b.modelo_excecao_id,
            b.disciplina_nome,
            b.disciplina_sigla,
            a.id AS avaliacao_id,
            a.nome AS avaliacao_nome,
            a.tipo AS avaliacao_tipo,
            a.trimestre,
            a.peso AS avaliacao_peso
           FROM base b
             LEFT JOIN public.avaliacoes a ON a.turma_disciplina_id = b.turma_disciplina_id AND a.ano_letivo = b.ano_letivo
        ), notas AS (
         SELECT a.matricula_id,
            a.aluno_id,
            a.turma_id,
            a.escola_id,
            a.ano_letivo,
            a.turma_disciplina_id,
            a.conta_para_media_med,
            a.disciplina_id,
            a.curso_id,
            a.classe_id,
            a.avaliacao_mode,
            a.avaliacao_modelo_id,
            a.avaliacao_disciplina_id,
            a.modelo_excecao_id,
            a.disciplina_nome,
            a.disciplina_sigla,
            a.avaliacao_id,
            a.avaliacao_nome,
            a.avaliacao_tipo,
            a.trimestre,
            a.avaliacao_peso,
            n.valor AS nota,
            COALESCE(n.is_isento, false) AS is_isento
           FROM avaliacoes a
             LEFT JOIN public.notas n ON n.matricula_id = a.matricula_id AND n.avaliacao_id = a.avaliacao_id
        ), calc AS (
         SELECT n.matricula_id,
            n.aluno_id,
            n.turma_id,
            n.escola_id,
            n.ano_letivo,
            n.turma_disciplina_id,
            n.conta_para_media_med,
            n.disciplina_id,
            n.curso_id,
            n.classe_id,
            n.avaliacao_mode,
            n.avaliacao_modelo_id,
            n.avaliacao_disciplina_id,
            n.modelo_excecao_id,
            n.disciplina_nome,
            n.disciplina_sigla,
            n.avaliacao_id,
            n.avaliacao_nome,
            n.avaliacao_tipo,
            n.trimestre,
            n.avaliacao_peso,
            n.nota,
            n.is_isento,
            COALESCE(
                CASE
                    WHEN n.avaliacao_mode = 'custom'::text AND n.avaliacao_modelo_id IS NOT NULL THEN 'CUSTOM'::text
                    WHEN n.avaliacao_mode = 'inherit_disciplina'::text AND mb.avaliacao_modelo_id IS NOT NULL THEN 'CUSTOM'::text
                    ELSE NULL::text
                END, cfg.modelo_avaliacao, 'SIMPLIFICADO'::text) AS modelo_avaliacao,
            COALESCE(cmc.peso, comp.peso, n.avaliacao_peso, 1::numeric) AS peso_aplicado,
            COALESCE(ma_excecao.formula, ma_curso.formula, ma_global.formula, '{"tipo": "aritmetica_simples", "mt_formula": ["MAC", "NPP", "PT"]}'::jsonb) AS formula_avaliacao
           FROM notas n
             LEFT JOIN configuracoes cfg ON cfg.escola_id = n.escola_id
             LEFT JOIN matriz_base mb ON mb.escola_id = n.escola_id AND mb.curso_id = n.curso_id AND mb.classe_id = n.classe_id AND mb.disciplina_id = n.avaliacao_disciplina_id
             LEFT JOIN modelos_avaliacao ma_excecao ON ma_excecao.id = n.modelo_excecao_id
             LEFT JOIN modelos_avaliacao ma_curso ON ma_curso.escola_id = n.escola_id AND ma_curso.curso_id = n.curso_id AND ma_curso.is_default IS TRUE
             LEFT JOIN modelos_avaliacao ma_global ON ma_global.escola_id = n.escola_id AND (ma_global.id::text = cfg.modelo_avaliacao OR ma_global.nome = cfg.modelo_avaliacao)
             LEFT JOIN componentes_modelo cmc ON cmc.modelo_id =
                CASE
                    WHEN n.avaliacao_mode = 'custom'::text THEN n.avaliacao_modelo_id
                    WHEN n.avaliacao_mode = 'inherit_disciplina'::text THEN mb.avaliacao_modelo_id
                    ELSE NULL::uuid
                END AND cmc.ativo IS TRUE AND cmc.code = upper(COALESCE(n.avaliacao_tipo, n.avaliacao_nome))
             LEFT JOIN componentes_escola comp ON comp.escola_id = n.escola_id AND comp.ativo IS TRUE AND comp.code = upper(COALESCE(n.avaliacao_tipo, n.avaliacao_nome))
        )
 SELECT escola_id,
    matricula_id,
    aluno_id,
    turma_id,
    ano_letivo,
    disciplina_id,
    disciplina_nome,
    disciplina_sigla,
    trimestre,
    conta_para_media_med,
    jsonb_object_agg(COALESCE(avaliacao_tipo, avaliacao_nome), nota) FILTER (WHERE COALESCE(avaliacao_tipo, avaliacao_nome) IS NOT NULL) AS notas_por_tipo,
        CASE
            WHEN conta_para_media_med IS FALSE THEN NULL::numeric
            WHEN bool_or(is_isento) THEN NULL::numeric
            WHEN count(nota) FILTER (WHERE nota IS NOT NULL) = 0 THEN NULL::numeric
            WHEN modelo_avaliacao = 'DEPOIS'::text THEN NULL::numeric
            ELSE calcular_media_trimestral(jsonb_object_agg(COALESCE(avaliacao_tipo, avaliacao_nome), nota) FILTER (WHERE COALESCE(avaliacao_tipo, avaliacao_nome) IS NOT NULL), formula_avaliacao)
        END AS nota_final,
        CASE
            WHEN conta_para_media_med IS FALSE THEN 'NAO_CONTA'::text
            WHEN bool_or(is_isento) THEN 'ISENTO'::text
            WHEN modelo_avaliacao = 'DEPOIS'::text THEN 'PENDENTE_CONFIG'::text
            ELSE NULL::text
        END AS status,
    modelo_avaliacao = 'DEPOIS'::text AND conta_para_media_med IS TRUE AS needs_config,
        CASE
            WHEN conta_para_media_med IS FALSE THEN 0::bigint
            WHEN bool_or(is_isento) THEN 0::bigint
            ELSE count(avaliacao_id) FILTER (WHERE avaliacao_id IS NOT NULL)
        END AS total_avaliacoes,
        CASE
            WHEN conta_para_media_med IS FALSE THEN 0::bigint
            WHEN bool_or(is_isento) THEN 0::bigint
            ELSE count(nota) FILTER (WHERE nota IS NOT NULL)
        END AS total_notas,
        CASE
            WHEN conta_para_media_med IS FALSE THEN 0::bigint
            WHEN bool_or(is_isento) THEN 0::bigint
            WHEN count(avaliacao_id) FILTER (WHERE avaliacao_id IS NOT NULL) = 0 THEN 1::bigint
            ELSE GREATEST(count(avaliacao_id) FILTER (WHERE avaliacao_id IS NOT NULL) - count(nota) FILTER (WHERE nota IS NOT NULL), 0::bigint)
        END AS missing_count,
        CASE
            WHEN conta_para_media_med IS FALSE THEN false
            WHEN bool_or(is_isento) THEN false
            WHEN count(nota) FILTER (WHERE nota IS NOT NULL) = 0 THEN true
            ELSE count(nota) FILTER (WHERE nota IS NOT NULL) < count(avaliacao_id) FILTER (WHERE avaliacao_id IS NOT NULL)
        END AS has_missing
   FROM calc
  GROUP BY escola_id, matricula_id, aluno_id, turma_id, ano_letivo, disciplina_id, disciplina_nome, disciplina_sigla, trimestre, modelo_avaliacao, conta_para_media_med, formula_avaliacao) q
     WHERE q.escola_id=p_escola_id AND q.matricula_id=p_matricula_id AND q.disciplina_id=p_disciplina_id;
   RETURN result;
 END; $function$;

-- resolve_estado_resultado_academico_base
CREATE OR REPLACE FUNCTION public.resolve_estado_resultado_academico_base(p_matricula_id uuid, p_disciplina_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_escola_id uuid;
  v_turma_id uuid;
  v_ano_letivo_id uuid;
  v_turma_disciplina_id uuid;
  v_regime jsonb;
  v_nota numeric;
  v_nota_final numeric;
  v_exame_nota numeric;
  v_exame_componentes integer := 0;
  v_exame_componentes_completos integer := 0;
  v_exame_sessao_id uuid;
  v_exame_tipo text;
  v_corte numeric;
  v_escala text;
  v_peso_percurso numeric;
  v_peso_exame numeric;
BEGIN
  SELECT m.escola_id, m.turma_id, al.id
  INTO v_escola_id, v_turma_id, v_ano_letivo_id
  FROM public.matriculas m
  LEFT JOIN public.anos_letivos al
    ON al.escola_id = m.escola_id
   AND al.ano = m.ano_letivo
  WHERE m.id = p_matricula_id
    AND m.aluno_id IS NOT NULL;

  IF v_escola_id IS NULL OR v_turma_id IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'pendente_dados',
      'positivo', NULL,
      'cor', NULL,
      'motivo', 'matricula_nao_encontrada'
    );
  END IF;

  SELECT td.id
  INTO v_turma_disciplina_id
  FROM public.turma_disciplinas td
  JOIN public.curso_matriz cm ON cm.id = td.curso_matriz_id
    AND cm.escola_id = td.escola_id
  WHERE td.escola_id = v_escola_id
    AND td.turma_id = v_turma_id
    AND COALESCE(td.avaliacao_disciplina_id, cm.avaliacao_disciplina_id, cm.disciplina_id) = p_disciplina_id
  ORDER BY td.id
  LIMIT 1;

  v_regime := public.resolve_regime_academico(v_turma_id);
  v_escala := COALESCE(v_regime->>'escala', 'quantitativa_secundario');
  v_corte := CASE WHEN v_escala = 'quantitativa_primario' THEN 5 ELSE 10 END;
  v_peso_percurso := COALESCE((v_regime#>>'{formula_mfd,peso_percurso}')::numeric, 1);
  v_peso_exame := COALESCE((v_regime#>>'{formula_mfd,peso_exame}')::numeric, 0);

  v_nota := public.raa_nota_percurso_atual(v_escola_id,p_matricula_id,p_disciplina_id);

  -- Recurso/extraordinário substitutivo também resolve dependências de
  -- classes que não são classes de exame. O SSOT continua sendo este
  -- resolvedor; o lifecycle apenas materializa o seu resultado.
  SELECT es.id, es.tipo
  INTO v_exame_sessao_id, v_exame_tipo
  FROM public.exame_sessoes es
  WHERE es.escola_id = v_escola_id
    AND es.turma_id = v_turma_id
    AND es.ano_letivo_id = v_ano_letivo_id
    AND es.estado IN ('publicada', 'encerrada')
    AND es.tipo IN ('recurso', 'extraordinario')
    AND EXISTS (
      SELECT 1
      FROM public.exame_resultados er
      WHERE er.escola_id = v_escola_id
        AND er.exame_sessao_id = es.id
        AND er.matricula_id = p_matricula_id
        AND er.turma_disciplina_id = v_turma_disciplina_id
        AND er.estado IN ('submetido', 'validado')
    )
  ORDER BY es.updated_at DESC, es.id DESC
  LIMIT 1;

  IF v_exame_sessao_id IS NOT NULL AND v_turma_disciplina_id IS NOT NULL THEN
    SELECT COUNT(DISTINCT ec.id), COUNT(DISTINCT ec.id) FILTER (WHERE er.nota IS NOT NULL)
    INTO v_exame_componentes, v_exame_componentes_completos
    FROM public.exame_componentes ec
    LEFT JOIN public.exame_resultados er
      ON er.exame_componente_id = ec.id
     AND er.exame_sessao_id = ec.exame_sessao_id
     AND er.matricula_id = p_matricula_id
     AND er.turma_disciplina_id = v_turma_disciplina_id
     AND er.estado IN ('submetido', 'validado')
    WHERE ec.escola_id = v_escola_id
      AND ec.exame_sessao_id = v_exame_sessao_id;

    IF v_exame_componentes = 0 OR v_exame_componentes <> v_exame_componentes_completos THEN
      RETURN jsonb_build_object(
        'status', 'pendente_formula',
        'positivo', NULL,
        'cor', NULL,
        'nota', v_nota,
        'corte', v_corte,
        'escala', v_escala,
        'regime', v_regime,
        'exame_sessao_id', v_exame_sessao_id,
        'exame_tipo', v_exame_tipo,
        'exame_componentes', v_exame_componentes,
        'exame_componentes_completos', v_exame_componentes_completos,
        'motivo', 'exame_substitutivo_aguarda_componentes'
      );
    END IF;

    SELECT SUM(er.nota * ec.peso) / NULLIF(SUM(ec.peso), 0)
    INTO v_exame_nota
    FROM public.exame_componentes ec
    JOIN public.exame_resultados er
      ON er.exame_componente_id = ec.id
     AND er.exame_sessao_id = ec.exame_sessao_id
     AND er.matricula_id = p_matricula_id
     AND er.turma_disciplina_id = v_turma_disciplina_id
     AND er.estado IN ('submetido', 'validado')
    WHERE ec.escola_id = v_escola_id
      AND ec.exame_sessao_id = v_exame_sessao_id;

    v_nota_final := round(v_exame_nota, 1);
    RETURN jsonb_build_object(
      'status', CASE WHEN v_nota_final >= v_corte THEN 'aprovado' ELSE 'reprovado' END,
      'positivo', (v_nota_final >= v_corte),
      'cor', CASE WHEN v_nota_final >= v_corte THEN 'azul' ELSE 'vermelho' END,
      'nota', v_nota_final,
      'corte', v_corte,
      'escala', v_escala,
      'regime', v_regime,
      'exame_sessao_id', v_exame_sessao_id,
      'exame_tipo', v_exame_tipo,
      'exame_nota', round(v_exame_nota, 1),
      'motivo', 'exame_substitutivo_resolvido'
    );
  END IF;

  v_exame_sessao_id := NULL;
  v_exame_tipo := NULL;
  v_exame_componentes := 0;
  v_exame_componentes_completos := 0;

  IF COALESCE((v_regime->>'eh_classe_exame')::boolean, false) THEN
    SELECT es.id, es.tipo
    INTO v_exame_sessao_id, v_exame_tipo
    FROM public.exame_sessoes es
    WHERE es.escola_id = v_escola_id
      AND es.turma_id = v_turma_id
      AND es.ano_letivo_id = v_ano_letivo_id
      AND es.estado IN ('publicada', 'encerrada')
      AND es.tipo = 'exame_nacional'
    ORDER BY CASE es.tipo
      WHEN 'recurso' THEN 1
      WHEN 'extraordinario' THEN 2
      ELSE 3
    END, es.updated_at DESC
    LIMIT 1;

    IF v_exame_sessao_id IS NULL OR v_turma_disciplina_id IS NULL THEN
      RETURN jsonb_build_object(
        'status', 'pendente_formula',
        'positivo', NULL,
        'cor', NULL,
        'nota', v_nota,
        'corte', v_corte,
        'escala', v_escala,
        'regime', v_regime,
        'motivo', 'exame_sem_sessao'
      );
    END IF;

    SELECT
      COUNT(ec.id)::integer,
      COUNT(er.id)::integer
    INTO
      v_exame_componentes,
      v_exame_componentes_completos
    FROM public.exame_componentes ec
    LEFT JOIN public.exame_resultados er
      ON er.exame_componente_id = ec.id
     AND er.exame_sessao_id = ec.exame_sessao_id
     AND er.matricula_id = p_matricula_id
     AND er.turma_disciplina_id = v_turma_disciplina_id
     AND er.estado IN ('submetido', 'validado')
    WHERE ec.escola_id = v_escola_id
      AND ec.exame_sessao_id = v_exame_sessao_id;

    IF v_exame_componentes = 0 OR v_exame_componentes <> v_exame_componentes_completos THEN
      RETURN jsonb_build_object(
        'status', 'pendente_formula',
        'positivo', NULL,
        'cor', NULL,
        'nota', v_nota,
        'corte', v_corte,
        'escala', v_escala,
        'regime', v_regime,
        'exame_sessao_id', v_exame_sessao_id,
        'exame_componentes', v_exame_componentes,
        'exame_componentes_completos', v_exame_componentes_completos,
        'motivo', 'exame_aguarda_componentes'
      );
    END IF;

    SELECT SUM(er.nota * ec.peso) / NULLIF(SUM(ec.peso), 0)
    INTO v_exame_nota
    FROM public.exame_componentes ec
    JOIN public.exame_resultados er
      ON er.exame_componente_id = ec.id
     AND er.exame_sessao_id = ec.exame_sessao_id
     AND er.matricula_id = p_matricula_id
     AND er.turma_disciplina_id = v_turma_disciplina_id
     AND er.estado IN ('submetido', 'validado')
    WHERE ec.escola_id = v_escola_id
      AND ec.exame_sessao_id = v_exame_sessao_id;

    IF v_exame_tipo IN ('recurso', 'extraordinario') THEN
      v_nota_final := v_exame_nota;
    ELSE
      IF v_nota IS NULL THEN
        RETURN jsonb_build_object(
          'status', 'pendente_formula',
          'positivo', NULL,
          'cor', NULL,
          'nota', NULL,
          'corte', v_corte,
          'escala', v_escala,
          'regime', v_regime,
          'exame_sessao_id', v_exame_sessao_id,
          'motivo', 'percurso_aguarda_mt3'
        );
      END IF;
      v_nota_final := (v_nota * v_peso_percurso) + (v_exame_nota * v_peso_exame);
    END IF;

    v_nota_final := round(v_nota_final, 1);
    RETURN jsonb_build_object(
      'status', CASE WHEN v_nota_final >= v_corte THEN 'aprovado' ELSE 'reprovado' END,
      'positivo', (v_nota_final >= v_corte),
      'cor', CASE WHEN v_nota_final >= v_corte THEN 'azul' ELSE 'vermelho' END,
      'nota', v_nota_final,
      'corte', v_corte,
      'escala', v_escala,
      'regime', v_regime,
      'exame_sessao_id', v_exame_sessao_id,
      'exame_nota', round(v_exame_nota, 1),
      'motivo', 'mfd_exame_resolvida'
    );
  END IF;

  IF v_nota IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'pendente_dados',
      'positivo', NULL,
      'cor', NULL,
      'nota', NULL,
      'corte', v_corte,
      'escala', v_escala,
      'regime', v_regime,
      'motivo', 'nota_nao_disponivel'
    );
  END IF;

  RETURN jsonb_build_object(
    'status', CASE WHEN v_nota >= v_corte THEN 'aprovado' ELSE 'reprovado' END,
    'positivo', (v_nota >= v_corte),
    'cor', CASE WHEN v_nota >= v_corte THEN 'azul' ELSE 'vermelho' END,
    'nota', round(v_nota, 1),
    'corte', v_corte,
    'escala', v_escala,
    'regime', v_regime,
    'motivo', 'nota_resolvida'
  );
END;
$function$;

-- resolve_raa_decreto_for_matricula
CREATE OR REPLACE FUNCTION public.resolve_raa_decreto_for_matricula(p_escola_id uuid, p_matricula_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_matricula record;
  v_regime jsonb;
  v_nivel text;
  v_classe integer;
  v_ano integer;
  v_modulo integer;
  v_regime_codigo text;
  v_statuses jsonb := '[]'::jsonb;
  v_ids_negativos jsonb := '[]'::jsonb;
  v_total integer := 0;
  v_negativas integer := 0;
  v_notas_completas boolean := true;
  v_lp boolean := false;
  v_math boolean := false;
  v_especificas integer := 0;
  v_proibida boolean := false;
  v_decision text;
  v_destino text;
  v_motivo text;
  v_base_legal text;
  v_bloqueada boolean := false;
  v_terminal boolean := false;
  v_disciplina record;
  v_result jsonb;
  v_nota numeric;
  v_nome text;
  v_nome_norm text;
  v_classificacao text;
  v_area text; v_absences jsonb; v_attendance_blocked boolean:=false; v_pending_ids jsonb;
BEGIN
  SELECT m.id, m.turma_id, m.escola_id
    INTO v_matricula
  FROM public.matriculas m
  WHERE m.id = p_matricula_id
    AND m.escola_id = p_escola_id
    AND m.aluno_id IS NOT NULL;

  IF v_matricula.id IS NULL THEN
    RETURN NULL;
  END IF;

  v_regime := public.resolve_regime_academico(v_matricula.turma_id);
  v_nivel := v_regime->>'nivel_ensino';
  v_classe := NULLIF(v_regime->>'classe_num', '')::integer;
  v_ano := NULLIF(v_regime->>'ano_numero', '')::integer;
  v_modulo := NULLIF(v_regime->>'modulo_numero', '')::integer;

  IF v_nivel = 'eja' THEN
    v_regime_codigo := CASE
      WHEN v_modulo = 1 THEN 'eja_modulo_1'
      WHEN v_modulo = 2 THEN 'eja_modulo_2'
      WHEN v_modulo = 3 THEN 'eja_modulo_3'
      WHEN v_ano = 1 THEN 'eja_ano_1'
      WHEN v_ano = 2 THEN 'eja_ano_2'
    END;
  ELSIF v_classe BETWEEN 6 AND 12 THEN
    v_regime_codigo := 'classe_' || v_classe;
  END IF;

  IF v_nivel = 'eja' AND v_regime->>'escala' = 'qualitativa' THEN
    RETURN public.resolve_raa_eja_oficial(p_escola_id,p_matricula_id);
  END IF;
  IF v_regime_codigo IS NULL THEN
    RETURN NULL;
  END IF;

  FOR v_disciplina IN
    SELECT DISTINCT
      COALESCE(td.avaliacao_disciplina_id, cm.avaliacao_disciplina_id, cm.disciplina_id) AS disciplina_id,
      COALESCE(dc.nome, '') AS nome,
      COALESCE(td.classificacao, cm.classificacao, '') AS classificacao,
      COALESCE(dc.area, '') AS area
    FROM public.turma_disciplinas td
    LEFT JOIN public.curso_matriz cm ON cm.id = td.curso_matriz_id
      AND cm.escola_id = p_escola_id
    LEFT JOIN public.disciplinas_catalogo dc ON dc.id = COALESCE(td.avaliacao_disciplina_id, cm.avaliacao_disciplina_id, cm.disciplina_id)
      AND dc.escola_id = p_escola_id
    WHERE td.escola_id = p_escola_id
      AND td.turma_id = v_matricula.turma_id
      AND COALESCE(td.conta_para_media_med, cm.conta_para_media_med, true)
      AND COALESCE(td.avaliacao_disciplina_id, cm.avaliacao_disciplina_id, cm.disciplina_id) IS NOT NULL
  LOOP
    v_total := v_total + 1;
    v_result := public.resolve_estado_resultado(p_matricula_id, v_disciplina.disciplina_id);
    v_nota := NULLIF(v_result->>'nota', '')::numeric;
    v_nome := v_disciplina.nome;
    v_nome_norm := lower(public.immutable_unaccent(v_nome));
    v_classificacao := lower(v_disciplina.classificacao);
    v_area := lower(v_disciplina.area);

    IF v_nota IS NULL THEN
      v_notas_completas := false;
    ELSE
      IF v_regime_codigo NOT IN ('eja_modulo_1', 'eja_modulo_2') AND v_nota < (CASE WHEN v_regime_codigo IN ('classe_6','eja_modulo_3') THEN 5 ELSE 10 END) THEN
        v_negativas := v_negativas + 1;
        v_ids_negativos := v_ids_negativos || jsonb_build_array(v_disciplina.disciplina_id);
        IF (v_regime_codigo IN ('classe_7', 'classe_8', 'classe_10', 'classe_11', 'eja_ano_1') AND v_nota < 7) OR (v_regime_codigo IN ('classe_9', 'classe_12', 'eja_ano_2') AND v_nota < 6) OR (v_nota < 3 AND v_regime_codigo IN ('classe_6', 'eja_modulo_3')) THEN
          v_proibida := true;
        END IF;
        IF v_nota < 6 AND v_regime_codigo IN ('classe_9', 'classe_12', 'eja_ano_2') THEN
          v_proibida := true;
        END IF;
        v_lp := v_lp OR v_nome_norm LIKE '%lingua portuguesa%' OR v_nome_norm = 'portugues';
        v_math := v_math OR v_nome_norm LIKE '%matemat%';
        v_especificas := v_especificas + CASE WHEN v_classificacao = 'especifica' OR v_area LIKE '%especific%' THEN 1 ELSE 0 END;
      END IF;
    END IF;

    v_statuses := v_statuses || jsonb_build_array(jsonb_build_object(
      'disciplina_id', v_disciplina.disciplina_id,
      'status', COALESCE(v_result->>'status', 'pendente_dados'),
      'nota_final', v_nota
    ));
  END LOOP;

  IF v_total = 0 OR NOT v_notas_completas THEN
    RETURN NULL;
  END IF;

  IF EXISTS(SELECT 1 FROM jsonb_array_elements(v_statuses) item WHERE item->>'status'='reprovado_por_indisciplina') THEN
    RETURN jsonb_build_object('decision','retido_por_indisciplina','destino','mesma_etapa','motivo','indisciplina_grave','efetivacao_matricula_bloqueada',true,'regime',v_regime,'disciplinas',v_statuses,'disciplina_ids_pendentes',v_ids_negativos,'etapa_destino',v_regime);
  END IF;
  v_absences:=public.raa_faltas_atuais(p_escola_id,p_matricula_id);
  SELECT EXISTS(SELECT 1 FROM public.turma_disciplinas td JOIN public.disciplinas_catalogo dc ON dc.id=td.avaliacao_disciplina_id AND dc.escola_id=p_escola_id
    CROSS JOIN LATERAL jsonb_array_elements_text(coalesce(v_absences->'faltas_por_turma_disciplina'->td.id::text,'[]'::jsonb)) value
    WHERE td.escola_id=p_escola_id AND td.turma_id=v_matricula.turma_id
      AND value::numeric >= CASE WHEN coalesce(td.carga_horaria_semanal,dc.carga_horaria_semana,0)<=1 THEN 3 WHEN coalesce(td.carga_horaria_semanal,dc.carga_horaria_semana,0)=2 THEN 4 ELSE 5 END) INTO v_attendance_blocked;
  IF v_attendance_blocked THEN
    RETURN jsonb_build_object('decision','retido_por_faltas','destino','mesma_etapa','motivo','faltas','efetivacao_matricula_bloqueada',true,'regime',v_regime,'disciplinas',v_statuses,'disciplina_ids_pendentes',v_ids_negativos,'etapa_destino',v_regime);
  END IF;
  v_terminal := v_regime_codigo IN ('classe_6', 'classe_9', 'classe_12', 'eja_modulo_3', 'eja_ano_2');

  IF v_regime_codigo IN ('classe_7', 'classe_8', 'eja_ano_1') THEN
    v_proibida := v_proibida OR (v_lp AND v_math) OR v_negativas > 2;
    IF v_negativas = 0 THEN
      v_decision := 'transitou'; v_destino := 'proxima_etapa'; v_motivo := 'sem_pendencias'; v_base_legal := 'Arts. 23.º/1 e 26.º/4.';
    ELSIF NOT v_proibida THEN
      v_decision := 'inscricao_condicional'; v_destino := 'proxima_etapa'; v_motivo := 'negativas_faixa_legal'; v_base_legal := 'Arts. 23.º/2-5 e 26.º/5-7.';
      v_bloqueada := v_regime_codigo IN ('classe_8', 'eja_ano_1');
    ELSE
      v_decision := 'retido'; v_destino := 'mesma_etapa'; v_motivo := 'combinacao_proibida'; v_base_legal := 'Arts. 23.º/2 e 26.º/5.'; v_bloqueada := true;
    END IF;
  ELSIF v_regime_codigo IN ('classe_10', 'classe_11') THEN
    v_proibida := v_proibida OR v_negativas > 3 OR (v_lp AND v_especificas >= 2);
    IF v_negativas = 0 THEN
      v_decision := 'transitou'; v_destino := 'proxima_etapa'; v_motivo := 'sem_pendencias'; v_base_legal := 'Art. 23.º/9.';
    ELSIF NOT v_proibida THEN
      v_decision := 'inscricao_condicional'; v_destino := 'proxima_etapa'; v_motivo := 'negativas_faixa_legal'; v_base_legal := 'Art. 23.º/9-13.';
      v_bloqueada := v_regime_codigo = 'classe_11';
    ELSE
      v_decision := 'retido'; v_destino := 'mesma_etapa'; v_motivo := 'combinacao_proibida'; v_base_legal := 'Art. 23.º/10.'; v_bloqueada := true;
    END IF;
  ELSIF v_regime_codigo = 'classe_6' THEN
    v_proibida := v_proibida OR v_negativas <> 2 OR (v_lp AND v_math);
    IF v_negativas = 0 THEN
      v_decision := 'concluiu'; v_destino := 'conclusao'; v_motivo := 'sem_pendencias'; v_base_legal := 'Art. 23.º/6.';
    ELSIF NOT v_proibida THEN
      v_decision := 'recurso'; v_destino := 'mesma_etapa'; v_motivo := 'negativas_faixa_legal'; v_base_legal := 'Art. 33.º/1-5.'; v_bloqueada := true;
    ELSE
      v_decision := 'retido'; v_destino := 'mesma_etapa'; v_motivo := 'combinacao_proibida'; v_base_legal := 'Art. 33.º/5.'; v_bloqueada := true;
    END IF;
  ELSIF v_regime_codigo = 'eja_modulo_3' THEN
    v_proibida := v_proibida OR v_negativas <> 1;
    IF v_negativas = 0 THEN
      v_decision := 'concluiu'; v_destino := 'conclusao'; v_motivo := 'sem_pendencias'; v_base_legal := 'Art. 26.º/1.';
    ELSIF NOT v_proibida THEN
      v_decision := 'recurso'; v_destino := 'mesma_etapa'; v_motivo := 'negativas_faixa_legal'; v_base_legal := 'Art. 33.º/6.'; v_bloqueada := true;
    ELSE
      v_decision := 'retido'; v_destino := 'mesma_etapa'; v_motivo := 'combinacao_proibida'; v_base_legal := 'Art. 33.º/6.'; v_bloqueada := true;
    END IF;
  ELSIF v_regime_codigo IN ('classe_9', 'eja_ano_2') THEN
    v_proibida := v_proibida OR v_negativas > 3 OR (v_lp AND v_math);
    IF v_negativas = 0 THEN
      v_decision := 'concluiu'; v_destino := 'conclusao'; v_motivo := 'sem_pendencias'; v_base_legal := 'Arts. 23.º/14 e 26.º/8.';
    ELSIF NOT v_proibida THEN
      v_decision := 'recurso'; v_destino := 'mesma_etapa'; v_motivo := 'negativas_faixa_legal'; v_base_legal := 'Art. 33.º/7.'; v_bloqueada := true;
    ELSE
      v_decision := 'retido'; v_destino := 'mesma_etapa'; v_motivo := 'combinacao_proibida'; v_base_legal := 'Art. 33.º/7.'; v_bloqueada := true;
    END IF;
  ELSIF v_regime_codigo = 'classe_12' THEN
    v_proibida := v_proibida OR v_negativas > 3 OR (v_lp AND v_math AND v_especificas >= 1) OR (v_lp AND v_especificas >= 2) OR (v_math AND v_especificas >= 2);
    IF v_negativas = 0 THEN
      v_decision := 'concluiu'; v_destino := 'conclusao'; v_motivo := 'sem_pendencias'; v_base_legal := 'Art. 23.º/14.';
    ELSIF NOT v_proibida THEN
      v_decision := 'recurso'; v_destino := 'mesma_etapa'; v_motivo := 'negativas_faixa_legal'; v_base_legal := 'Art. 33.º/8.'; v_bloqueada := true;
    ELSE
      v_decision := 'retido'; v_destino := 'mesma_etapa'; v_motivo := 'combinacao_proibida'; v_base_legal := 'Art. 33.º/8/a-c.'; v_bloqueada := true;
    END IF;
  ELSE
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'decision', v_decision,
    'destino', v_destino,
    'motivo', v_motivo,
    'base_legal', v_base_legal,
    'efetivacao_matricula_bloqueada', v_bloqueada,
    'disciplina_ids_pendentes', v_ids_negativos,
    'disciplinas', v_statuses,
    'regime', v_regime,
    'etapa_destino', CASE WHEN v_destino = 'proxima_etapa' THEN jsonb_build_object('nivel_ensino', v_nivel, 'classe_num', CASE WHEN v_classe IS NOT NULL THEN v_classe + 1 ELSE v_classe END, 'ano_numero', CASE WHEN v_ano IS NOT NULL THEN v_ano + 1 ELSE v_ano END, 'modulo_numero', CASE WHEN v_modulo IS NOT NULL THEN v_modulo + 1 ELSE v_modulo END) ELSE v_regime END
  );
END;
$function$;

-- resolve_raa_progression_for_matricula_generic
CREATE OR REPLACE FUNCTION public.resolve_raa_progression_for_matricula_generic(p_escola_id uuid, p_matricula_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_matricula record;
  v_regime jsonb;
  v_config record;
  v_statuses jsonb := '[]'::jsonb;
  v_status text;
  v_disciplina_id uuid;
  v_has_pending boolean := false;
  v_has_reprovado boolean := false;
  v_has_recurso boolean := false;
  v_has_indisciplina boolean := false;
  v_presenca numeric;
  v_frequencia_min numeric := 75;
  v_decision text;
  v_destino text;
  v_motivo text;
  v_etapa_destino jsonb := NULL;
  v_nivel text;
  v_classe integer;
  v_ano integer;
  v_modulo integer;
  v_exame boolean := false;
BEGIN
  SELECT m.id, m.escola_id, m.turma_id, m.aluno_id
    INTO v_matricula
  FROM public.matriculas m
  WHERE m.id = p_matricula_id
    AND m.escola_id = p_escola_id
    AND m.aluno_id IS NOT NULL;

  IF v_matricula.id IS NULL THEN
    RETURN jsonb_build_object('decision', 'pendente', 'destino', 'aguardar_dados',
      'motivo', 'dados_pendentes', 'disciplina_ids_pendentes', '[]'::jsonb);
  END IF;

  SELECT cp.permitir_inscricao_condicional, cp.permitir_progressao_com_recurso
    INTO v_config
  FROM public.configuracoes_pedagogicas cp
  WHERE cp.escola_id = p_escola_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'RAA_PROGRESSION_POLICY_NOT_CONFIGURED: política de progressão não configurada';
  END IF;

  v_regime := public.resolve_regime_academico(v_matricula.turma_id);
  v_nivel := v_regime->>'nivel_ensino';
  v_classe := (v_regime->>'classe_num')::integer;
  v_ano := (v_regime->>'ano_numero')::integer;
  v_modulo := (v_regime->>'modulo_numero')::integer;
  v_exame := coalesce((v_regime->>'eh_classe_exame')::boolean, false);

  FOR v_disciplina_id IN
    SELECT DISTINCT COALESCE(td.avaliacao_disciplina_id, cm.avaliacao_disciplina_id, cm.disciplina_id)
    FROM public.turma_disciplinas td
    JOIN public.curso_matriz cm ON cm.id = td.curso_matriz_id
      AND cm.escola_id = td.escola_id
    WHERE td.escola_id = p_escola_id
      AND td.turma_id = v_matricula.turma_id
      AND COALESCE(td.conta_para_media_med, cm.conta_para_media_med, true)
      AND COALESCE(td.avaliacao_disciplina_id, cm.avaliacao_disciplina_id, cm.disciplina_id) IS NOT NULL
  LOOP
    SELECT coalesce(public.resolve_estado_resultado(p_matricula_id, v_disciplina_id)->>'status', 'pendente_dados')
      INTO v_status;

    IF v_status NOT IN ('aprovado', 'recurso', 'reprovado', 'reprovado_por_faltas',
                        'reprovado_por_indisciplina', 'pendente_dados', 'pendente_formula') THEN
      RAISE EXCEPTION 'ACADEMIC_RESULT_INVALID: estado académico inválido (%)', v_status;
    END IF;

    v_statuses := v_statuses || jsonb_build_array(jsonb_build_object(
      'disciplina_id', v_disciplina_id, 'status', v_status
    ));
    v_has_pending := v_has_pending OR v_status IN ('pendente_dados', 'pendente_formula');
    v_has_reprovado := v_has_reprovado OR v_status = 'reprovado';
    v_has_recurso := v_has_recurso OR v_status = 'recurso';
    v_has_indisciplina := v_has_indisciplina OR v_status = 'reprovado_por_indisciplina';
  END LOOP;

  SELECT CASE WHEN sum(coalesce(fsp.aulas_previstas, 0)) > 0
    THEN round((sum(coalesce(fsp.aulas_previstas, 0)) - sum(coalesce(fsp.faltas, 0))) * 100.0 /
      sum(coalesce(fsp.aulas_previstas, 0)), 2)
    ELSE NULL END,
    coalesce(max(fsp.frequencia_min_percent), 75)
    INTO v_presenca, v_frequencia_min
  FROM public.frequencia_status_periodo fsp
  WHERE fsp.escola_id = p_escola_id
    AND fsp.matricula_id = p_matricula_id;

  IF jsonb_array_length(v_statuses) = 0 OR v_has_pending THEN
    v_decision := 'pendente'; v_destino := 'aguardar_dados'; v_motivo := 'dados_pendentes';
  ELSIF v_has_indisciplina THEN
    v_decision := 'retido_por_indisciplina'; v_destino := 'mesma_etapa'; v_motivo := 'indisciplina_grave';
    v_etapa_destino := v_regime;
  ELSIF coalesce(v_presenca < v_frequencia_min, false) THEN
    v_decision := 'retido_por_faltas'; v_destino := 'mesma_etapa'; v_motivo := 'faltas';
    v_etapa_destino := v_regime;
  ELSIF v_has_reprovado THEN
    v_decision := 'retido'; v_destino := 'mesma_etapa'; v_motivo := 'aproveitamento';
    v_etapa_destino := v_regime;
  ELSIF v_has_recurso THEN
    IF v_config.permitir_inscricao_condicional AND v_config.permitir_progressao_com_recurso
       AND NOT v_exame THEN
      v_decision := 'inscricao_condicional'; v_destino := 'proxima_etapa'; v_motivo := 'recurso';
    ELSE
      v_decision := 'recurso'; v_destino := 'mesma_etapa'; v_motivo := 'recurso';
      v_etapa_destino := v_regime;
    END IF;
  ELSIF (v_nivel = 'primario' AND v_classe = 6)
     OR (v_nivel = 'secundario' AND v_classe = 12)
     OR (v_nivel = 'eja' AND (v_modulo = 3 OR v_ano = 2))
     OR v_exame THEN
    v_decision := 'concluiu'; v_destino := 'conclusao'; v_motivo := 'sem_pendencias';
  ELSE
    v_decision := 'transitou'; v_destino := 'proxima_etapa'; v_motivo := 'sem_pendencias';
    v_etapa_destino := jsonb_build_object(
      'nivel_ensino', v_nivel,
      'classe_num', CASE WHEN v_nivel IN ('primario', 'secundario') THEN v_classe + 1 ELSE v_classe END,
      'ano_numero', CASE WHEN v_nivel = 'eja' THEN v_ano + 1 ELSE v_ano END,
      'modulo_numero', CASE WHEN v_nivel = 'eja' THEN v_modulo + 1 ELSE v_modulo END
    );
  END IF;

  RETURN jsonb_build_object(
    'decision', v_decision,
    'destino', v_destino,
    'motivo', v_motivo,
    'disciplina_ids_pendentes', coalesce((
      SELECT jsonb_agg(item->>'disciplina_id')
      FROM jsonb_array_elements(v_statuses) item
      WHERE item->>'status' <> 'aprovado'
    ), '[]'::jsonb),
    'disciplinas', v_statuses,
    'frequencia', jsonb_build_object('percentual_presenca', v_presenca, 'frequencia_min_percent', v_frequencia_min),
    'regime', v_regime,
    'etapa_destino', v_etapa_destino
  );
END;
$function$;

COMMIT;
