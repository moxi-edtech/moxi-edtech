BEGIN;

-- BL-003: GradeEngine de fecho sem filtro oficial completo
-- Aplicar filtro conta_para_media_med no cálculo final de situação
CREATE OR REPLACE FUNCTION public.gradeengine_calcular_situacao(
  p_matricula_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_escola_id uuid := public.current_tenant_escola_id();
  v_matricula record;
  v_missing_count bigint := 0;
  v_has_reprovacao boolean := false;
BEGIN
  IF v_escola_id IS NULL THEN
    RAISE EXCEPTION 'AUTH: escola_id inválido.';
  END IF;

  IF NOT public.user_has_role_in_school(v_escola_id, ARRAY['secretaria', 'admin', 'admin_escola', 'staff_admin']) THEN
    RAISE EXCEPTION 'AUTH: Permissão negada.';
  END IF;

  SELECT id, escola_id
  INTO v_matricula
  FROM public.matriculas
  WHERE id = p_matricula_id
    AND escola_id = v_escola_id;

  IF v_matricula.id IS NULL THEN
    RAISE EXCEPTION 'DATA: Matrícula não encontrada.';
  END IF;

  -- 1. Verificar se existem disciplinas que CONTAM para média sem notas/pautas
  SELECT COALESCE(SUM(missing_count), 0)
  INTO v_missing_count
  FROM public.vw_boletim_por_matricula
  WHERE matricula_id = p_matricula_id
    AND conta_para_media_med IS TRUE; -- BL-003 Filter applied

  IF v_missing_count > 0 THEN
    RETURN jsonb_build_object(
      'situacao_final', 'incompleto',
      'motivos', jsonb_build_array('Existem disciplinas oficiais sem notas lançadas ou pautas abertas.')
    );
  END IF;

  -- 2. Verificar se todas as disciplinas oficiais têm os 3 trimestres fechados
  IF EXISTS (
    SELECT 1
    FROM (
      SELECT disciplina_id,
             COUNT(*) FILTER (WHERE nota_final IS NOT NULL) AS trimestres_com_nota,
             AVG(nota_final) FILTER (WHERE nota_final IS NOT NULL) AS media_final
      FROM public.vw_boletim_por_matricula
      WHERE matricula_id = p_matricula_id
        AND conta_para_media_med IS TRUE -- BL-003 Filter applied
      GROUP BY disciplina_id
    ) s
    WHERE s.trimestres_com_nota < 3 OR s.media_final IS NULL
  ) THEN
    RETURN jsonb_build_object(
      'situacao_final', 'incompleto',
      'motivos', jsonb_build_array('Não existem notas fechadas para todos os trimestres das disciplinas oficiais.')
    );
  END IF;

  -- 3. Calcular reprovação apenas sobre disciplinas oficiais
  SELECT EXISTS (
    SELECT 1
    FROM (
      SELECT disciplina_id,
             AVG(nota_final) FILTER (WHERE nota_final IS NOT NULL) AS media_final
      FROM public.vw_boletim_por_matricula
      WHERE matricula_id = p_matricula_id
        AND conta_para_media_med IS TRUE -- BL-003 Filter applied
      GROUP BY disciplina_id
    ) s
    WHERE s.media_final < 10
  )
  INTO v_has_reprovacao;

  RETURN jsonb_build_object(
    'situacao_final', CASE WHEN v_has_reprovacao THEN 'reprovado' ELSE 'aprovado' END,
    'motivos', jsonb_build_array()
  );
END;
$$;

-- BL-004: Vínculo matrícula-financeiro com risco em rematrícula
-- Revisar chave de unicidade/conflito para incluir matricula_id
-- Isso permite que um aluno tenha múltiplas matrículas em regimes diferentes/sucessivas
-- garantindo que cada uma tenha seu fluxo financeiro independente por mês/ano.

-- Remover índice antigo que usava apenas aluno_id
DROP INDEX IF EXISTS public.ux_mensalidades_aluno_mes;

-- Criar novo índice garantindo unicidade por MATRÍCULA
-- Se matricula_id for NULL (o que não deve ocorrer em fluxos novos), o índice ainda funciona.
CREATE UNIQUE INDEX ux_mensalidades_matricula_mes 
ON public.mensalidades (escola_id, matricula_id, ano_referencia, mes_referencia);

COMMIT;
