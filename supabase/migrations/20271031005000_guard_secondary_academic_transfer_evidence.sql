-- AUT-001/002: non-destructive secondary academic-history gate.
-- Existing ordinary transfer RPCs intentionally continue to refuse
-- P1050 when any evidence belongs to the origin class. This migration
-- DOES NOT implement historical reassignment or update students/finances.
-- Must apply only after disposable PG16 regression and catalog comparison.
BEGIN;

CREATE OR REPLACE FUNCTION public.guard_turma_transfer_secondary_evidence_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
BEGIN
  IF NEW.turma_id IS NOT DISTINCT FROM OLD.turma_id THEN
    RETURN NEW;
  END IF;

  -- Grades from superseded writers must remain anchored to their real class.
  -- Historical and officially published evidence cannot be safely moved
  -- merely by overwriting matriculas.turma_id.
  IF EXISTS (
    SELECT 1 FROM public.notas_avaliacoes n
    WHERE n.matricula_id = OLD.id
  ) OR EXISTS (
    SELECT 1 FROM public.lancamentos l
    WHERE l.matricula_id = OLD.id AND l.escola_id = OLD.escola_id
  ) OR EXISTS (
    SELECT 1 FROM public.historico_snapshot_locks h
    WHERE h.matricula_id = OLD.id AND h.escola_id = OLD.escola_id
  ) OR EXISTS (
    SELECT 1 FROM public.historico_anos h
    WHERE h.escola_id = OLD.escola_id
      AND (h.matricula_id = OLD.id OR (
        h.matricula_id IS NULL AND h.aluno_id = OLD.aluno_id
        AND h.turma_id = OLD.turma_id
        AND h.ano_letivo = OLD.ano_letivo))
  ) OR EXISTS (
    SELECT 1 FROM public.reapreciacao_pedidos p
    WHERE p.matricula_id = OLD.id AND p.escola_id = OLD.escola_id
  ) OR EXISTS (
    SELECT 1 FROM public.raa_indisciplina_eventos d
    WHERE d.matricula_id = OLD.id AND d.escola_id = OLD.escola_id
  ) OR EXISTS (
    SELECT 1 FROM public.aluno_falta_justificacoes f
    WHERE f.matricula_id = OLD.id AND f.escola_id = OLD.escola_id
  ) OR EXISTS (
    SELECT 1 FROM public.pautas_oficiais p
    WHERE p.turma_id = OLD.turma_id AND p.escola_id = OLD.escola_id
  ) OR EXISTS (
    SELECT 1 FROM public.pautas_lote_itens i
    JOIN public.pautas_lote_jobs j ON j.id = i.job_id
    WHERE i.turma_id = OLD.turma_id AND j.escola_id = OLD.escola_id
  ) OR EXISTS (
    SELECT 1 FROM public.excecoes_pauta e
    WHERE e.turma_id = OLD.turma_id AND e.escola_id = OLD.escola_id
  ) OR EXISTS (
    SELECT 1 FROM public.presencas_deprecated p
    WHERE p.aluno_id = OLD.aluno_id
      AND p.turma_id = OLD.turma_id AND p.escola_id = OLD.escola_id
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P1050',
      MESSAGE = 'Existe histórico, pauta ou decisão académica ligada à turma de origem. Não alterar a matrícula sem conciliação temporal certificada.';
  END IF;
  RETURN NEW;
END;
$fn$;
REVOKE ALL ON FUNCTION public.guard_turma_transfer_secondary_evidence_v1()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_turma_transfer_secondary_evidence ON public.matriculas;
CREATE TRIGGER trg_guard_turma_transfer_secondary_evidence
  BEFORE UPDATE OF turma_id ON public.matriculas
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_turma_transfer_secondary_evidence_v1();

-- Serialise new secondary evidence with the enrollment row lock of the
-- supported individual and batch transfer RPCs. A repeated migration is safe.
DO $locks$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'lancamentos', 'historico_snapshot_locks', 'historico_anos',
    'reapreciacao_pedidos', 'raa_indisciplina_eventos',
    'aluno_falta_justificacoes'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS a_00_lock_matricula_academic_evidence ON public.%I', v_table);
    EXECUTE format(
      'CREATE TRIGGER a_00_lock_matricula_academic_evidence
       BEFORE INSERT OR UPDATE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.lock_matricula_for_academic_evidence_v1()',
      v_table
    );
  END LOOP;
END;
$locks$;

-- notas_avaliacoes has no escola_id: lock by enrollment key and fail closed
-- for missing enrollment, never assume a trusted school from the caller.
CREATE OR REPLACE FUNCTION public.lock_legacy_note_enrollment_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $fn$
BEGIN
  IF NEW.matricula_id IS NOT NULL THEN
    PERFORM 1 FROM public.matriculas WHERE id = NEW.matricula_id FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = '23503',
        MESSAGE = 'Matrícula de origem da nota não encontrada.';
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$;
REVOKE ALL ON FUNCTION public.lock_legacy_note_enrollment_v1()
  FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS a_00_lock_legacy_note_enrollment ON public.notas_avaliacoes;
CREATE TRIGGER a_00_lock_legacy_note_enrollment
  BEFORE INSERT OR UPDATE ON public.notas_avaliacoes
  FOR EACH ROW EXECUTE FUNCTION public.lock_legacy_note_enrollment_v1();

-- Immutable pauta/evaluation artifacts have a class rather than a
-- student enrollment key. Lock that class before creating or revising
-- an artifact so concurrent transfer locks serialize correctly.
CREATE OR REPLACE FUNCTION public.lock_turma_for_academic_artifact_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $fn$
BEGIN
  IF NEW.turma_id IS NOT NULL THEN
    PERFORM 1 FROM public.turmas WHERE id = NEW.turma_id FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = '23503',
        MESSAGE = 'Turma de origem do documento não encontrada.';
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$;
REVOKE ALL ON FUNCTION public.lock_turma_for_academic_artifact_v1()
  FROM PUBLIC, anon, authenticated;
DO $locks$
DECLARE v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'pautas_oficiais', 'pautas_lote_itens', 'excecoes_pauta'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS a_00_lock_turma_academic_artifact ON public.%I', v_table);
    EXECUTE format(
      'CREATE TRIGGER a_00_lock_turma_academic_artifact
       BEFORE INSERT OR UPDATE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.lock_turma_for_academic_artifact_v1()',
      v_table);
  END LOOP;
END;
$locks$;
COMMIT;
