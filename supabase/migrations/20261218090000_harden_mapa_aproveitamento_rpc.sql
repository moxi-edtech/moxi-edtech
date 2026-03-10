BEGIN;

CREATE TABLE IF NOT EXISTS public.configuracoes_pedagogicas (
  escola_id uuid PRIMARY KEY REFERENCES public.escolas(id) ON DELETE CASCADE,
  negativas_para_reprovar integer NOT NULL DEFAULT 3,
  media_minima_aprovacao numeric NOT NULL DEFAULT 10.0,
  permitir_recurso boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT configuracoes_pedagogicas_negativas_ck CHECK (negativas_para_reprovar >= 0)
);

ALTER TABLE public.configuracoes_pedagogicas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS configuracoes_pedagogicas_select ON public.configuracoes_pedagogicas;

CREATE POLICY configuracoes_pedagogicas_select
  ON public.configuracoes_pedagogicas
  FOR SELECT
  TO authenticated
  USING (escola_id = public.current_tenant_escola_id());

CREATE OR REPLACE FUNCTION public.calcular_status_pedagogico(
  p_qtd_negativas integer,
  p_media_geral numeric,
  p_escola_id uuid
)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_config record;
BEGIN
  SELECT *
  INTO v_config
  FROM public.configuracoes_pedagogicas
  WHERE escola_id = p_escola_id;

  IF v_config.escola_id IS NULL THEN
    IF p_qtd_negativas >= 3 THEN
      RETURN 'Reprovado';
    END IF;
    IF p_qtd_negativas > 0 THEN
      RETURN 'Recurso';
    END IF;
    RETURN 'Aprovado';
  END IF;

  IF p_qtd_negativas >= v_config.negativas_para_reprovar THEN
    RETURN 'Reprovado';
  ELSIF p_qtd_negativas > 0 AND v_config.permitir_recurso THEN
    RETURN 'Recurso';
  ELSIF p_qtd_negativas > 0 AND NOT v_config.permitir_recurso THEN
    RETURN 'Reprovado';
  ELSE
    RETURN 'Aprovado';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.gerar_mapa_aproveitamento_turma(
  p_escola_id uuid,
  p_turma_id uuid,
  p_periodo_letivo_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_escola_id uuid := public.current_tenant_escola_id();
  v_colunas jsonb;
  v_linhas jsonb;
BEGIN
  IF v_user_escola_id IS NULL OR v_user_escola_id <> p_escola_id THEN
    RAISE EXCEPTION 'AUTH: Acesso negado. Violação de isolamento de Tenant.';
  END IF;

  IF NOT public.user_has_role_in_school(p_escola_id, ARRAY['admin_escola', 'secretaria', 'diretor_pedagogico']) THEN
    RAISE EXCEPTION 'AUTH: Permissão insuficiente para gerar mapas estatísticos.';
  END IF;

  CREATE TEMP TABLE tmp_base_notas ON COMMIT DROP AS
  WITH base_raw AS (
    SELECT
      m.id AS matricula_id,
      al.numero_processo,
      al.nome_completo AS nome_aluno,
      d.id AS disciplina_id,
      ('d_' || d.id::text) AS disciplina_key,
      d.sigla AS disciplina_sigla,
      d.nome AS disciplina_nome,
      vbm.nota_final
    FROM public.matriculas m
    JOIN public.alunos al ON al.id = m.aluno_id
    JOIN public.vw_boletim_por_matricula vbm ON vbm.matricula_id = m.id
    JOIN public.disciplinas d ON d.id = vbm.disciplina_id
    WHERE m.escola_id = p_escola_id
      AND m.turma_id = p_turma_id
      AND m.status = 'ativo'
      AND vbm.conta_para_media_med IS TRUE
      AND (p_periodo_letivo_id IS NULL OR vbm.periodo_letivo_id = p_periodo_letivo_id)
  )
  SELECT
    matricula_id,
    numero_processo,
    nome_aluno,
    disciplina_id,
    disciplina_key,
    disciplina_sigla,
    disciplina_nome,
    MAX(nota_final) AS nota_final
  FROM base_raw
  GROUP BY
    matricula_id,
    numero_processo,
    nome_aluno,
    disciplina_id,
    disciplina_key,
    disciplina_sigla,
    disciplina_nome;

  SELECT jsonb_agg(
    jsonb_build_object(
      'id', disciplina_id,
      'key', disciplina_key,
      'sigla', COALESCE(NULLIF(TRIM(disciplina_sigla), ''), 'N/A'),
      'nome', disciplina_nome
    )
    ORDER BY disciplina_nome
  )
  INTO v_colunas
  FROM (
    SELECT DISTINCT disciplina_id, disciplina_key, disciplina_sigla, disciplina_nome
    FROM tmp_base_notas
  ) colunas_src;

  SELECT jsonb_agg(
    jsonb_build_object(
      'matricula_id', matricula_id,
      'numero_processo', numero_processo,
      'nome_aluno', nome_aluno,
      'notas', notas_disciplinas,
      'estatisticas', jsonb_build_object(
        'media_geral', media_geral,
        'qtd_negativas', qtd_negativas,
        'status', public.calcular_status_pedagogico(qtd_negativas::int, media_geral, p_escola_id)
      )
    )
    ORDER BY nome_aluno
  )
  INTO v_linhas
  FROM (
    SELECT
      matricula_id,
      numero_processo,
      nome_aluno,
      jsonb_object_agg(disciplina_key, nota_final) AS notas_disciplinas,
      ROUND(AVG(nota_final)::numeric, 1) AS media_geral,
      COUNT(nota_final) FILTER (WHERE nota_final < 10) AS qtd_negativas
    FROM tmp_base_notas
    GROUP BY matricula_id, numero_processo, nome_aluno
  ) linhas_src;

  RETURN jsonb_build_object(
    'colunas', COALESCE(v_colunas, '[]'::jsonb),
    'linhas', COALESCE(v_linhas, '[]'::jsonb)
  );
END;
$$;

ALTER FUNCTION public.calcular_status_pedagogico(integer, numeric, uuid) OWNER TO postgres;
ALTER FUNCTION public.gerar_mapa_aproveitamento_turma(uuid, uuid, uuid) OWNER TO postgres;

GRANT EXECUTE ON FUNCTION public.calcular_status_pedagogico(integer, numeric, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gerar_mapa_aproveitamento_turma(uuid, uuid, uuid) TO authenticated;

COMMIT;
