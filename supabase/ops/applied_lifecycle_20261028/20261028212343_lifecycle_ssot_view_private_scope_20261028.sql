-- Applied to KLASSE Supabase as 20261028212343.
CREATE OR REPLACE VIEW public.v_student_lifecycle_ssot_v1
WITH (security_invoker=true) AS
SELECT m.id AS matricula_id, m.escola_id, m.aluno_id, m.ano_letivo,
       m.session_id AS ano_letivo_id, m.turma_id,
       m.origem_transicao_matricula_id, m.status AS status_persistido,
       m.ativo AS ativo_persistido, m.motivo_fecho, m.data_fecho,
       CASE
         WHEN m.status='ativo' AND m.ativo THEN 'ativa'
         WHEN m.status='pendente' AND NOT m.ativo THEN 'pendente'
         WHEN m.status IN ('concluido','reprovado','reprovado_por_faltas','transferido','inativo','trancado')
           AND NOT m.ativo THEN 'encerrada'
         WHEN m.status IN ('anulado','desistente','cancelado')
           AND NOT m.ativo THEN 'cancelada'
         ELSE 'revisao'
       END AS estado_operacional,
       h.id AS historico_id, h.resultado_final AS resultado_registrado,
       h.snapshot_status,
       CASE
         WHEN h.snapshot_status='fechado' AND EXISTS (
           SELECT 1 FROM public.historico_snapshot_locks sl
           WHERE sl.historico_ano_id=h.id AND sl.matricula_id=m.id
             AND sl.escola_id=m.escola_id AND sl.status='fechado'
         ) THEN h.resultado_final ELSE NULL::text
       END AS resultado_oficial
FROM public.matriculas m
LEFT JOIN public.historico_anos h
  ON h.matricula_id=m.id AND h.escola_id=m.escola_id
 AND h.aluno_id=m.aluno_id AND h.ano_letivo=m.ano_letivo
WHERE
  current_user='service_role'
  OR public.is_super_admin()
  OR public.user_has_role_in_school(m.escola_id,
    ARRAY['secretaria','secretaria_financeiro','admin_financeiro','admin','admin_escola','staff_admin']::text[])
  OR EXISTS (
    SELECT 1 FROM public.alunos a
    WHERE a.id=m.aluno_id AND a.escola_id=m.escola_id
      AND a.profile_id=auth.uid()
  );
