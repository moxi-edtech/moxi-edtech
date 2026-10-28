-- Applied to KLASSE Supabase under 20261028211533; mirrored from migration history.
CREATE OR REPLACE FUNCTION public.sync_historico_anos_compat()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'pg_catalog','public'
AS $historico_sync$
BEGIN
  -- resultado_final é canónico; status_final é um alias legado sincronizado.
  IF TG_OP = 'UPDATE' THEN
    IF NEW.resultado_final IS DISTINCT FROM OLD.resultado_final
       AND NEW.status_final IS DISTINCT FROM OLD.status_final
       AND NEW.resultado_final IS DISTINCT FROM NEW.status_final THEN
      RAISE EXCEPTION 'LIFECYCLE_HISTORY_CONFLICT' USING ERRCODE='23514';
    ELSIF NEW.resultado_final IS DISTINCT FROM OLD.resultado_final THEN
      NEW.status_final := NEW.resultado_final;
    ELSIF NEW.status_final IS DISTINCT FROM OLD.status_final THEN
      NEW.resultado_final := NEW.status_final;
    END IF;
  END IF;
  IF NEW.resultado_final IS NOT NULL AND NEW.status_final IS NOT NULL
     AND NEW.resultado_final IS DISTINCT FROM NEW.status_final THEN
    RAISE EXCEPTION 'LIFECYCLE_HISTORY_CONFLICT' USING ERRCODE='23514';
  END IF;
  NEW.resultado_final := COALESCE(NEW.resultado_final, NEW.status_final);
  NEW.status_final := COALESCE(NEW.status_final, NEW.resultado_final);
  NEW.updated_at := now();
  RETURN NEW;
END;
$historico_sync$;

ALTER TABLE public.historico_anos
  ADD CONSTRAINT fk_lifecycle_historico_matricula
  FOREIGN KEY (matricula_id) REFERENCES public.matriculas(id) NOT VALID;
ALTER TABLE public.historico_anos VALIDATE CONSTRAINT fk_lifecycle_historico_matricula;

-- O histórico legado sem matrícula fica pendente; não criar novos órfãos.
ALTER TABLE public.historico_anos
  ADD CONSTRAINT chk_lifecycle_historico_com_matricula
  CHECK (matricula_id IS NOT NULL) NOT VALID;
ALTER TABLE public.historico_anos
  ADD CONSTRAINT chk_lifecycle_historico_resultado_par
  CHECK (status_final IS NULL OR status_final = resultado_final) NOT VALID;
ALTER TABLE public.historico_anos VALIDATE CONSTRAINT chk_lifecycle_historico_resultado_par;

CREATE OR REPLACE VIEW public.v_student_lifecycle_ssot_v1
WITH (security_invoker=true) AS
SELECT m.id AS matricula_id, m.escola_id, m.aluno_id, m.ano_letivo,
       m.session_id AS ano_letivo_id, m.turma_id,
       m.origem_transicao_matricula_id, m.status AS status_persistido,
       m.ativo AS ativo_persistido, m.motivo_fecho, m.data_fecho,
       CASE
         WHEN m.status = 'ativo' AND m.ativo THEN 'ativa'
         WHEN m.status = 'pendente' AND NOT m.ativo THEN 'pendente'
         WHEN m.status IN ('concluido','reprovado','reprovado_por_faltas','transferido','inativo','trancado')
           AND NOT m.ativo THEN 'encerrada'
         WHEN m.status IN ('anulado','desistente','cancelado')
           AND NOT m.ativo THEN 'cancelada'
         ELSE 'revisao'
       END AS estado_operacional,
       h.id AS historico_id, h.resultado_final AS resultado_registrado,
       h.snapshot_status AS snapshot_status,
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
 AND h.aluno_id=m.aluno_id AND h.ano_letivo=m.ano_letivo;

REVOKE ALL ON public.v_student_lifecycle_ssot_v1 FROM PUBLIC, anon;
GRANT SELECT ON public.v_student_lifecycle_ssot_v1 TO authenticated, service_role;
