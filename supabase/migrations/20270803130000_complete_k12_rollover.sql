BEGIN;

DO $migration$
DECLARE
  v_definition text;
  v_updated text;
BEGIN
  SELECT pg_get_functiondef('public.cutover_ano_letivo_v3(uuid,uuid,uuid)'::regprocedure)
    INTO v_definition;

  v_updated := replace(
    v_definition,
    'ARRAY[''admin'', ''admin_escola'']',
    'ARRAY[''admin'', ''admin_escola'', ''staff_admin'', ''admin_financeiro'', ''diretor'', ''super_admin'']'
  );

  IF v_updated = v_definition
     AND position('admin_financeiro' IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Definição inesperada de cutover_ano_letivo_v3; migração interrompida.';
  END IF;

  IF v_updated <> v_definition THEN
    EXECUTE v_updated;
  END IF;
END
$migration$;

CREATE OR REPLACE FUNCTION public.aplicar_virada_importacao(p_importacao_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_importacao public.virada_importacoes%ROWTYPE;
  v_linha public.virada_importacao_linhas%ROWTYPE;
  v_user_id uuid := auth.uid();
  v_avaliacao_id uuid;
  v_nota numeric(6,2);
  v_nota_max numeric(6,2);
  v_resultado text;
  v_status_matricula text;
  v_notas integer := 0;
  v_resultados integer := 0;
  v_linhas integer := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH: utilizador não autenticado';
  END IF;

  SELECT * INTO v_importacao
  FROM public.virada_importacoes
  WHERE id = p_importacao_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DATA: lote não encontrado';
  END IF;

  IF v_importacao.escola_id IS DISTINCT FROM public.current_tenant_escola_id() THEN
    RAISE EXCEPTION 'AUTH: lote fora do tenant atual';
  END IF;

  IF NOT public.user_has_role_in_school(
    v_importacao.escola_id,
    ARRAY['admin','admin_escola','staff_admin','admin_financeiro','diretor','super_admin']::text[]
  ) THEN
    RAISE EXCEPTION 'AUTH: perfil sem permissão para aplicar resultados';
  END IF;

  IF v_importacao.status = 'APLICADO' THEN
    RETURN jsonb_build_object('id', v_importacao.id, 'status', 'APLICADO', 'reused', true);
  END IF;

  IF v_importacao.status <> 'APROVADO' THEN
    RAISE EXCEPTION 'DATA: apenas lotes APROVADOS podem ser aplicados';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.virada_importacao_linhas vil
    WHERE vil.importacao_id = v_importacao.id
      AND vil.status <> 'VALIDA'
  ) THEN
    RAISE EXCEPTION 'DATA: lote contém linhas não válidas';
  END IF;

  FOR v_linha IN
    SELECT *
    FROM public.virada_importacao_linhas
    WHERE importacao_id = v_importacao.id
    ORDER BY linha, id
    FOR UPDATE
  LOOP
    IF v_linha.matricula_id IS NULL OR NOT EXISTS (
      SELECT 1
      FROM public.matriculas m
      WHERE m.id = v_linha.matricula_id
        AND m.aluno_id = v_linha.aluno_id
        AND m.escola_id = v_importacao.escola_id
        AND m.ano_letivo = v_importacao.ano_letivo_origem
    ) THEN
      RAISE EXCEPTION 'DATA: linha % sem matrícula válida no ano de origem', v_linha.linha;
    END IF;

    IF v_linha.normalized_data ? 'nota'
       AND nullif(v_linha.normalized_data->>'nota', '') IS NOT NULL THEN
      BEGIN
        v_avaliacao_id := nullif(v_linha.normalized_data->>'avaliacao_id', '')::uuid;
        v_nota := (v_linha.normalized_data->>'nota')::numeric;
      EXCEPTION WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'DATA: linha % contém nota ou avaliacao_id inválido', v_linha.linha;
      END;

      IF v_avaliacao_id IS NULL THEN
        RAISE EXCEPTION 'DATA: linha % exige avaliacao_id', v_linha.linha;
      END IF;

      SELECT a.nota_max INTO v_nota_max
      FROM public.avaliacoes a
      JOIN public.turma_disciplinas td
        ON td.id = a.turma_disciplina_id
       AND td.escola_id = a.escola_id
      JOIN public.matriculas m
        ON m.id = v_linha.matricula_id
       AND m.turma_id = td.turma_id
       AND m.escola_id = a.escola_id
      WHERE a.id = v_avaliacao_id
        AND a.escola_id = v_importacao.escola_id
        AND a.ano_letivo = v_importacao.ano_letivo_origem;

      IF v_nota_max IS NULL THEN
        RAISE EXCEPTION 'DATA: avaliação da linha % não pertence à matrícula, turma e ano informados', v_linha.linha;
      END IF;
      IF v_nota < 0 OR v_nota > v_nota_max THEN
        RAISE EXCEPTION 'DATA: nota da linha % deve estar entre 0 e %', v_linha.linha, v_nota_max;
      END IF;

      INSERT INTO public.notas (escola_id, avaliacao_id, matricula_id, valor)
      VALUES (v_importacao.escola_id, v_avaliacao_id, v_linha.matricula_id, v_nota)
      ON CONFLICT (matricula_id, avaliacao_id)
      DO UPDATE SET valor = EXCLUDED.valor, updated_at = now();
      v_notas := v_notas + 1;
    END IF;

    v_resultado := upper(nullif(v_linha.normalized_data->>'resultado_final', ''));
    IF v_resultado IS NOT NULL THEN
      IF v_resultado = 'PENDENTE' THEN
        RAISE EXCEPTION 'DATA: resultado PENDENTE na linha % não pode ser aplicado', v_linha.linha;
      ELSIF v_resultado IN ('TRANSITADO', 'CONCLUIDO') THEN
        v_status_matricula := 'concluido';
      ELSIF v_resultado = 'RETIDO' THEN
        v_status_matricula := 'reprovado';
      ELSE
        RAISE EXCEPTION 'DATA: resultado final inválido na linha %', v_linha.linha;
      END IF;

      UPDATE public.matriculas
      SET status = v_status_matricula,
          ativo = false,
          motivo_fecho = 'Importação aprovada na virada do ano letivo',
          data_fecho = now(),
          status_fecho_origem = 'virada_importacao',
          updated_at = now()
      WHERE id = v_linha.matricula_id
        AND escola_id = v_importacao.escola_id
        AND canonicalize_matricula_status_text(status) IN ('ativo', 'pendente');

      IF NOT FOUND AND NOT EXISTS (
        SELECT 1 FROM public.matriculas
        WHERE id = v_linha.matricula_id
          AND escola_id = v_importacao.escola_id
          AND canonicalize_matricula_status_text(status) = v_status_matricula
      ) THEN
        RAISE EXCEPTION 'DATA: matrícula da linha % não pode receber o resultado final', v_linha.linha;
      END IF;
      v_resultados := v_resultados + 1;
    END IF;

    UPDATE public.virada_importacao_linhas
    SET status = 'APLICADA', aplicado_em = now()
    WHERE id = v_linha.id;
    v_linhas := v_linhas + 1;
  END LOOP;

  UPDATE public.virada_importacoes
  SET status = 'APLICADO', aplicado_em = now(), updated_at = now()
  WHERE id = v_importacao.id;

  INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, portal, details)
  VALUES (
    v_importacao.escola_id,
    v_user_id,
    'VIRADA_IMPORTACAO_APLICADA',
    'virada_importacoes',
    v_importacao.id::text,
    'secretaria',
    jsonb_build_object('linhas', v_linhas, 'notas', v_notas, 'resultados', v_resultados)
  );

  RETURN jsonb_build_object(
    'id', v_importacao.id,
    'status', 'APLICADO',
    'reused', false,
    'linhas', v_linhas,
    'notas', v_notas,
    'resultados', v_resultados
  );
END
$function$;

REVOKE ALL ON FUNCTION public.aplicar_virada_importacao(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aplicar_virada_importacao(uuid) TO authenticated;

COMMIT;
