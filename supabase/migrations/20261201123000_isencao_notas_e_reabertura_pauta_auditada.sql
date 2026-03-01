BEGIN;

-- BL-008: Aluno Paraquedista (Entrada Tardia)
-- Adicionar suporte a isenção de notas
ALTER TABLE public.notas 
  ADD COLUMN IF NOT EXISTS is_isento boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- BL-009: O Arrependimento do Professor (Destrancar Pautas)
-- Tabela para gerir exceções temporárias de abertura de pauta
CREATE TABLE IF NOT EXISTS public.excecoes_pauta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  turma_id uuid NOT NULL REFERENCES public.turmas(id) ON DELETE CASCADE,
  disciplina_id uuid REFERENCES public.disciplinas_catalogo(id) ON DELETE CASCADE,
  trimestre smallint CHECK (trimestre >= 1 AND trimestre <= 3),
  user_id uuid NOT NULL REFERENCES auth.users(id), -- O professor ou admin que terá acesso
  motivo text NOT NULL,
  expira_em timestamptz NOT NULL, -- Janela de tempo (ex: 24h)
  criado_por uuid NOT NULL REFERENCES auth.users(id), -- O Diretor que autorizou
  created_at timestamptz DEFAULT now()
);

-- Ativar RLS na tabela de exceções
ALTER TABLE public.excecoes_pauta ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_all_access" ON public.excecoes_pauta
  FOR ALL TO authenticated
  USING (escola_id = current_tenant_escola_id() OR is_super_admin())
  WITH CHECK (escola_id = current_tenant_escola_id() OR is_super_admin());

-- Função para verificar se existe uma exceção ativa
CREATE OR REPLACE FUNCTION public.can_bypass_pauta_lock(
  p_escola_id uuid,
  p_turma_id uuid,
  p_avaliacao_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_trimestre smallint;
  v_disciplina_id uuid;
BEGIN
  -- Obter dados da avaliação para bater com a exceção
  SELECT a.trimestre, td.disciplina_id 
  INTO v_trimestre, v_disciplina_id
  FROM public.avaliacoes a
  JOIN public.turma_disciplinas td ON td.id = a.turma_disciplina_id
  WHERE a.id = p_avaliacao_id;

  RETURN EXISTS (
    SELECT 1 FROM public.excecoes_pauta
    WHERE escola_id = p_escola_id
      AND turma_id = p_turma_id
      AND user_id = p_user_id
      AND expira_em > now()
      AND (trimestre IS NULL OR trimestre = v_trimestre)
      AND (disciplina_id IS NULL OR disciplina_id = v_disciplina_id)
  );
END;
$$;

-- Atualizar o Trigger de bloqueio de notas para considerar exceções
CREATE OR REPLACE FUNCTION public.guard_notas_when_turma_fechada()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
DECLARE
  v_turma_id uuid;
  v_status text;
  v_periodo_id uuid;
  v_trava timestamptz;
  v_user_id uuid := auth.uid();
  v_escola_id uuid;
BEGIN
  SELECT td.turma_id, a.escola_id INTO v_turma_id, v_escola_id
  FROM public.avaliacoes a
  JOIN public.turma_disciplinas td ON td.id = a.turma_disciplina_id
  WHERE a.id = NEW.avaliacao_id;

  IF v_turma_id IS NULL THEN
    RAISE EXCEPTION 'Turma não encontrada para validação de notas.';
  END IF;

  -- 1. Verificar se existe uma exceção ativa para este utilizador/turma/trimestre
  IF public.can_bypass_pauta_lock(v_escola_id, v_turma_id, NEW.avaliacao_id, v_user_id) THEN
    RETURN NEW; -- Bypassa todos os outros bloqueios
  END IF;

  -- 2. Bloqueio por status da Turma
  SELECT status_fecho INTO v_status FROM public.turmas WHERE id = v_turma_id;
  IF v_status IS DISTINCT FROM 'ABERTO' THEN
    RAISE EXCEPTION 'Turma fechada para lançamento de notas. Solicite reabertura ao Diretor.';
  END IF;

  -- 3. Bloqueio por trava de calendário (periodos_letivos)
  SELECT a.periodo_letivo_id INTO v_periodo_id
  FROM public.avaliacoes a
  WHERE a.id = NEW.avaliacao_id;

  IF v_periodo_id IS NOT NULL THEN
    SELECT trava_notas_em INTO v_trava
    FROM public.periodos_letivos
    WHERE id = v_periodo_id;

    IF v_trava IS NOT NULL AND v_trava <= now() THEN
      RAISE EXCEPTION 'Período letivo fechado pelo calendário oficial. Solicite reabertura ao Diretor.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Atualizar o Boletim (Materialized View) para suportar ISENÇÕES
DROP VIEW IF EXISTS public.vw_boletim_por_matricula;
DROP MATERIALIZED VIEW IF EXISTS internal.mv_boletim_por_matricula;

CREATE MATERIALIZED VIEW internal.mv_boletim_por_matricula AS
WITH configuracoes AS (
  SELECT configuracoes_escola.escola_id,
     COALESCE(configuracoes_escola.modelo_avaliacao, 'SIMPLIFICADO'::text) AS modelo_avaliacao,
     configuracoes_escola.avaliacao_config
    FROM public.configuracoes_escola
 ), componentes_escola AS (
  SELECT c.escola_id,
     upper(comp.code) AS code,
     comp.peso,
     COALESCE(comp.ativo, true) AS ativo
    FROM (configuracoes c
      LEFT JOIN LATERAL jsonb_to_recordset((c.avaliacao_config -> 'componentes'::text)) comp(code text, peso numeric, ativo boolean) ON true)
 ), componentes_modelo AS (
  SELECT ma.id AS modelo_id,
     upper(comp.code) AS code,
     comp.peso,
     COALESCE(comp.ativo, true) AS ativo
    FROM (public.modelos_avaliacao ma
      LEFT JOIN LATERAL jsonb_to_recordset(ma.componentes) comp(code text, peso numeric, ativo boolean) ON true)
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
     dc.nome AS disciplina_nome,
     dc.sigla AS disciplina_sigla
    FROM (((public.matriculas m
      JOIN public.turma_disciplinas td ON ((td.turma_id = m.turma_id) AND (td.escola_id = m.escola_id)))
      JOIN public.curso_matriz cm ON (cm.id = td.curso_matriz_id))
      JOIN public.disciplinas_catalogo dc ON (dc.id = cm.disciplina_id))
   WHERE (m.status = ANY (ARRAY['ativo'::text, 'ativa'::text, 'active'::text]))
 ), matriz_base AS (
  SELECT cm.escola_id,
     cm.curso_id,
     cm.classe_id,
     cm.disciplina_id,
     cm.avaliacao_modelo_id
    FROM public.curso_matriz cm
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
     b.disciplina_nome,
     b.disciplina_sigla,
     a.id AS avaliacao_id,
     a.nome AS avaliacao_nome,
     a.tipo AS avaliacao_tipo,
     a.trimestre,
     a.peso AS avaliacao_peso
    FROM (base b
      LEFT JOIN public.avaliacoes a ON ((a.turma_disciplina_id = b.turma_disciplina_id) AND (a.ano_letivo = b.ano_letivo)))
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
     a.disciplina_nome,
     a.disciplina_sigla,
     a.avaliacao_id,
     a.avaliacao_nome,
     a.avaliacao_tipo,
     a.trimestre,
     a.avaliacao_peso,
     n.valor AS nota,
     COALESCE(n.is_isento, false) AS is_isento -- BL-008
    FROM (avaliacoes a
      LEFT JOIN public.notas n ON ((n.matricula_id = a.matricula_id) AND (n.avaliacao_id = a.avaliacao_id)))
 ), calc AS (
  SELECT n.matricula_id,
     n.aluno_id,
     n.turma_id,
     n.escola_id,
     n.ano_letivo,
     n.turma_disciplina_id,
     n.conta_para_media_med,
     n.disciplina_id,
     n.disciplina_nome,
     n.disciplina_sigla,
     n.avaliacao_id,
     n.avaliacao_nome,
     n.avaliacao_tipo,
     n.trimestre,
     n.avaliacao_peso,
     n.nota,
     n.is_isento, -- BL-008
     COALESCE(
       CASE
         WHEN n.avaliacao_mode = 'custom' AND n.avaliacao_modelo_id IS NOT NULL THEN 'CUSTOM'
         WHEN n.avaliacao_mode = 'inherit_disciplina' AND mb.avaliacao_modelo_id IS NOT NULL THEN 'CUSTOM'
         ELSE NULL
       END,
       cfg.modelo_avaliacao,
       'SIMPLIFICADO'::text
     ) AS modelo_avaliacao,
     COALESCE(
       cmc.peso,
       comp.peso,
       n.avaliacao_peso,
       1::numeric
     ) AS peso_aplicado
    FROM notas n
      LEFT JOIN configuracoes cfg ON (cfg.escola_id = n.escola_id)
      LEFT JOIN matriz_base mb ON (
        mb.escola_id = n.escola_id
        AND mb.curso_id = n.curso_id
        AND mb.classe_id = n.classe_id
        AND mb.disciplina_id = n.avaliacao_disciplina_id
      )
      LEFT JOIN componentes_modelo cmc ON (
        cmc.modelo_id = CASE
          WHEN n.avaliacao_mode = 'custom' THEN n.avaliacao_modelo_id
          WHEN n.avaliacao_mode = 'inherit_disciplina' THEN mb.avaliacao_modelo_id
          ELSE NULL
        END
        AND cmc.ativo IS TRUE
        AND cmc.code = upper(COALESCE(n.avaliacao_tipo, n.avaliacao_nome))
      )
      LEFT JOIN componentes_escola comp ON (
        comp.escola_id = n.escola_id
        AND comp.ativo IS TRUE
        AND comp.code = upper(COALESCE(n.avaliacao_tipo, n.avaliacao_nome))
      )
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
     jsonb_object_agg(COALESCE(avaliacao_tipo, avaliacao_nome), nota)
       FILTER (WHERE COALESCE(avaliacao_tipo, avaliacao_nome) IS NOT NULL) AS notas_por_tipo,
     CASE
         WHEN conta_para_media_med IS FALSE THEN NULL::numeric
         -- BL-008: Se o aluno é isento neste trimestre, a nota_final do trimestre é ignorada (calculada como NULL)
         WHEN bool_or(is_isento) THEN NULL::numeric
         WHEN count(nota) FILTER (WHERE nota IS NOT NULL) = 0 THEN NULL::numeric
         WHEN modelo_avaliacao = 'DEPOIS'::text THEN NULL::numeric
         ELSE (sum((nota * peso_aplicado)) FILTER (WHERE nota IS NOT NULL)
               / NULLIF(sum(peso_aplicado) FILTER (WHERE nota IS NOT NULL), 0::numeric))
     END AS nota_final,
     CASE
         WHEN conta_para_media_med IS FALSE THEN 'NAO_CONTA'::text
         WHEN bool_or(is_isento) THEN 'ISENTO'::text -- BL-008
         WHEN modelo_avaliacao = 'DEPOIS'::text THEN 'PENDENTE_CONFIG'::text
         ELSE NULL::text
     END AS status,
     (modelo_avaliacao = 'DEPOIS'::text AND conta_para_media_med IS TRUE) AS needs_config,
     CASE
         WHEN conta_para_media_med IS FALSE THEN 0::bigint
         -- Se isento, não há avaliações a preencher
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
         -- BL-008: Se isento, missing_count é 0 (não falta nada)
         WHEN bool_or(is_isento) THEN 0::bigint
         WHEN count(avaliacao_id) FILTER (WHERE avaliacao_id IS NOT NULL) = 0 THEN 1::bigint
         ELSE GREATEST((count(avaliacao_id) FILTER (WHERE avaliacao_id IS NOT NULL)
           - count(nota) FILTER (WHERE nota IS NOT NULL)), 0::bigint)
     END AS missing_count,
     CASE
         WHEN conta_para_media_med IS FALSE THEN false
         WHEN bool_or(is_isento) THEN false -- BL-008
         WHEN count(nota) FILTER (WHERE nota IS NOT NULL) = 0 THEN true
         ELSE (count(nota) FILTER (WHERE nota IS NOT NULL)
           < count(avaliacao_id) FILTER (WHERE avaliacao_id IS NOT NULL))
     END AS has_missing
    FROM calc
   GROUP BY escola_id, matricula_id, aluno_id, turma_id, ano_letivo, disciplina_id,
     disciplina_nome, disciplina_sigla, trimestre, modelo_avaliacao, conta_para_media_med
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS ux_mv_boletim_por_matricula
  ON internal.mv_boletim_por_matricula (escola_id, matricula_id, disciplina_id, trimestre);

CREATE OR REPLACE VIEW public.vw_boletim_por_matricula
AS SELECT *
   FROM internal.mv_boletim_por_matricula
   WHERE (escola_id = public.current_tenant_escola_id());

-- Garantir que GradeEngine considere as isenções no cálculo final
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

  -- 1. Verificar disciplinas oficiais sem notas lançadas (ignorando isentos)
  SELECT COALESCE(SUM(missing_count), 0)
  INTO v_missing_count
  FROM public.vw_boletim_por_matricula
  WHERE matricula_id = p_matricula_id
    AND conta_para_media_med IS TRUE;

  IF v_missing_count > 0 THEN
    RETURN jsonb_build_object(
      'situacao_final', 'incompleto',
      'motivos', jsonb_build_array('Existem disciplinas oficiais sem notas lançadas ou pautas abertas.')
    );
  END IF;

  -- 2. Calcular aprovação sobre trimestres NÃO ISENTOS
  -- A média final é a média aritmética das nota_final de cada trimestre que NÃO seja NULL.
  IF EXISTS (
    SELECT 1
    FROM (
      SELECT disciplina_id,
             -- Se todos os 3 trimestres forem isentos ou sem nota, o aluno não tem nota final.
             -- Mas o missing_count=0 garante que ou tem nota ou é isento.
             AVG(nota_final) FILTER (WHERE nota_final IS NOT NULL) AS media_final
      FROM public.vw_boletim_por_matricula
      WHERE matricula_id = p_matricula_id
        AND conta_para_media_med IS TRUE
      GROUP BY disciplina_id
    ) s
    WHERE s.media_final IS NULL
  ) THEN
    RETURN jsonb_build_object(
      'situacao_final', 'incompleto',
      'motivos', jsonb_build_array('Não existem notas ou isenções para todos os trimestres.')
    );
  END IF;

  -- 3. Calcular reprovação
  SELECT EXISTS (
    SELECT 1
    FROM (
      SELECT disciplina_id,
             AVG(nota_final) FILTER (WHERE nota_final IS NOT NULL) AS media_final
      FROM public.vw_boletim_por_matricula
      WHERE matricula_id = p_matricula_id
        AND conta_para_media_med IS TRUE
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

COMMIT;
