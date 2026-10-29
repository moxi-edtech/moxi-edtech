-- Additive, read-only contract for enrollment status across KLASSE surfaces.
-- Never rewrites student decisions, grades, history or original enrollment status.
-- Depends on the locked, security-invoker v_student_lifecycle_ssot_v1.
BEGIN;

CREATE OR REPLACE VIEW public.v_student_lifecycle_status_v2
WITH (security_invoker = true)
AS
WITH scoped AS (
  SELECT base.*,
    EXISTS (
      SELECT 1 FROM public.anos_letivos a
      WHERE a.escola_id = base.escola_id AND a.ativo IS TRUE
        AND base.ano_letivo IS NOT NULL AND a.ano > base.ano_letivo
    ) AS ano_superado_pelo_ativo,
    EXISTS (
      SELECT 1 FROM public.matriculas seguinte
      WHERE seguinte.escola_id = base.escola_id
        AND seguinte.aluno_id = base.aluno_id
        AND base.ano_letivo IS NOT NULL
        AND seguinte.ano_letivo > base.ano_letivo
    ) AS possui_matricula_posterior
  FROM public.v_student_lifecycle_ssot_v1 base
),
classified AS (
  SELECT scoped.*,
    CASE
      WHEN ano_letivo IS NULL THEN 'revisao_integridade'
      WHEN status_persistido = 'rascunho' AND ativo_persistido IS FALSE THEN 'rascunho'
      WHEN estado_operacional = 'revisao' THEN 'revisao_integridade'
      WHEN estado_operacional = 'pendente'
        AND (ano_superado_pelo_ativo OR possui_matricula_posterior)
        THEN 'regularizacao_historica'
      WHEN estado_operacional = 'pendente' THEN 'aguarda_confirmacao'
      WHEN estado_operacional = 'ativa' THEN 'matriculado'
      WHEN status_persistido = 'transferido' THEN 'transferido'
      WHEN status_persistido = 'trancado' THEN 'trancado'
      WHEN status_persistido = 'desistente' THEN 'desistente'
      WHEN status_persistido = 'anulado' THEN 'anulado'
      WHEN status_persistido = 'inativo' THEN 'revisao_integridade'
      WHEN estado_operacional = 'encerrada' THEN 'ano_encerrado'
      ELSE 'revisao_integridade'
    END AS situacao_contextual,
    CASE
      WHEN resultado_oficial IN ('aprovado','reprovado','concluido') THEN 'homologado'
      WHEN resultado_registrado IS NOT NULL
        AND btrim(resultado_registrado) <> ''
        THEN 'registado_nao_homologado'
      ELSE 'sem_resultado_oficial'
    END AS situacao_resultado
  FROM scoped
)
SELECT classified.*,
  CASE situacao_contextual
    WHEN 'regularizacao_historica' THEN 'conciliar_historico'
    WHEN 'aguarda_confirmacao' THEN 'confirmar_matricula'
    WHEN 'rascunho' THEN 'completar_matricula'
    WHEN 'matriculado' THEN 'acompanhar_ano'
    WHEN 'ano_encerrado' THEN
      CASE WHEN situacao_resultado = 'homologado' THEN 'consultar_historico'
           ELSE 'homologar_resultado' END
    WHEN 'revisao_integridade' THEN 'rever_integridade'
    ELSE 'consultar_movimento'
  END AS acao_contextual
FROM classified;

REVOKE ALL ON public.v_student_lifecycle_status_v2 FROM PUBLIC, anon;
GRANT SELECT ON public.v_student_lifecycle_status_v2 TO authenticated, service_role;
COMMENT ON VIEW public.v_student_lifecycle_status_v2 IS
'SSOT read projection: matrícula, regularização histórica, resultado oficial e próxima ação, distintos. Não permite inferir notas ou aprovação. Security invoker e RLS na origem.';
COMMIT;
