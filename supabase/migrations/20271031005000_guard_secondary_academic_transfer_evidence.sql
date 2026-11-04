-- AUT-001/002: non-destructive secondary academic-history gate.
-- Existing ordinary transfer RPCs intentionally continue to refuse
-- P1050 when any evidence belongs to the origin class. This migration
-- DOES NOT implement historical reassignment or update students/finances.
-- Must apply only after disposable PG16 regression and catalog comparison.
BEGIN;

-- Canonical predicate is used by BOTH the guard trigger and the
-- authenticated preflight. Keeping a single definition prevents the UI
-- from advertising a transfer which the database will reject.
CREATE OR REPLACE FUNCTION public.turma_transfer_has_secondary_evidence_v1(
  p_escola_id uuid, p_matricula_id uuid, p_turma_origem_id uuid,
  p_aluno_id uuid, p_ano_letivo integer
) RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = ''
AS $check$
  SELECT
  EXISTS (
    SELECT 1 FROM public.notas_avaliacoes n
    WHERE n.matricula_id = p_matricula_id
  ) OR EXISTS (
    SELECT 1 FROM public.lancamentos l
    WHERE l.matricula_id = p_matricula_id AND l.escola_id = p_escola_id
  ) OR EXISTS (
    SELECT 1 FROM public.historico_snapshot_locks h
    WHERE h.matricula_id = p_matricula_id AND h.escola_id = p_escola_id
  ) OR EXISTS (
    SELECT 1 FROM public.historico_anos h
    WHERE h.escola_id = p_escola_id
      AND (h.matricula_id = p_matricula_id OR (
        h.matricula_id IS NULL AND h.aluno_id = p_aluno_id
        AND h.turma_id = p_turma_origem_id
        AND h.ano_letivo = p_ano_letivo))
  ) OR EXISTS (
    SELECT 1 FROM public.reapreciacao_pedidos p
    WHERE p.matricula_id = p_matricula_id AND p.escola_id = p_escola_id
  ) OR EXISTS (
    SELECT 1 FROM public.raa_indisciplina_eventos d
    WHERE d.matricula_id = p_matricula_id AND d.escola_id = p_escola_id
  ) OR EXISTS (
    SELECT 1 FROM public.aluno_falta_justificacoes f
    WHERE f.matricula_id = p_matricula_id AND f.escola_id = p_escola_id
  ) OR EXISTS (
    SELECT 1 FROM public.pautas_oficiais p
    WHERE p.turma_id = p_turma_origem_id AND p.escola_id = p_escola_id
  ) OR EXISTS (
    SELECT 1 FROM public.pautas_lote_itens i
    JOIN public.pautas_lote_jobs j ON j.id = i.job_id
    WHERE i.turma_id = p_turma_origem_id AND j.escola_id = p_escola_id
  ) OR EXISTS (
    SELECT 1 FROM public.excecoes_pauta e
    WHERE e.turma_id = p_turma_origem_id AND e.escola_id = p_escola_id
  ) OR EXISTS (
    SELECT 1 FROM public.presencas_deprecated p
    WHERE p.aluno_id = p_aluno_id
      AND p.turma_id = p_turma_origem_id AND p.escola_id = p_escola_id
  );
$check$;
REVOKE ALL ON FUNCTION public.turma_transfer_has_secondary_evidence_v1(
  uuid,uuid,uuid,uuid,integer) FROM PUBLIC, anon, authenticated;

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

  -- Covers even a direct UPDATE from a privileged legacy writer. Artifact
  -- publication takes the same class lock before writing its source record;
  -- evaluate the evidence under a fresh READ COMMITTED snapshot afterwards.
  PERFORM 1 FROM public.turmas t
  WHERE t.id = OLD.turma_id AND t.escola_id = OLD.escola_id FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='P1052',
      MESSAGE='Turma de origem da matrícula não encontrada.';
  END IF;
  -- Grades from superseded writers must remain anchored to their real class.
  -- Historical and officially published evidence cannot be safely moved
  -- merely by overwriting matriculas.turma_id.
  IF public.turma_transfer_has_secondary_evidence_v1(
    OLD.escola_id, OLD.id, OLD.turma_id, OLD.aluno_id, OLD.ano_letivo
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

-- Authenticated, tenant-scoped read-only contract for transfer previews.
-- No record counts, school identifiers or academic details are exposed.
CREATE OR REPLACE FUNCTION public.turma_transfer_academic_evidence_v1(
  p_matricula_id uuid
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $preflight$
DECLARE
  v_actor uuid := auth.uid();
  v_escola uuid := public.current_tenant_escola_id();
  v_m public.matriculas%ROWTYPE;
  v_blocked boolean;
BEGIN
  IF v_actor IS NULL OR v_escola IS NULL OR NOT coalesce(
    public.user_has_role_in_school(
      v_escola, ARRAY['secretaria','admin','admin_escola','staff_admin']
    ), false
  ) THEN
    RAISE EXCEPTION USING ERRCODE='42501',
      MESSAGE='Sem permissão para consultar transferências académicas.';
  END IF;
  SELECT * INTO v_m FROM public.matriculas
    WHERE id=p_matricula_id AND escola_id=v_escola;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='P0002',
      MESSAGE='Matrícula não encontrada nesta escola.';
  END IF;
  SELECT (
    EXISTS (SELECT 1 FROM public.notas WHERE escola_id=v_escola AND matricula_id=v_m.id)
    OR EXISTS (SELECT 1 FROM public.exame_resultados WHERE escola_id=v_escola AND matricula_id=v_m.id)
    OR EXISTS (SELECT 1 FROM public.frequencias WHERE escola_id=v_escola AND matricula_id=v_m.id)
    OR EXISTS (SELECT 1 FROM public.frequencia_status_periodo WHERE escola_id=v_escola AND matricula_id=v_m.id)
    OR public.turma_transfer_has_secondary_evidence_v1(
         v_escola, v_m.id, v_m.turma_id, v_m.aluno_id, v_m.ano_letivo)
  ) INTO v_blocked;
  RETURN jsonb_build_object(
    'has_evidence', v_blocked,
    'requires_reconciliation', v_blocked
  );
END;
$preflight$;
REVOKE ALL ON FUNCTION public.turma_transfer_academic_evidence_v1(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.turma_transfer_academic_evidence_v1(uuid)
  TO authenticated;

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
    'pautas_oficiais', 'pautas_lote_itens', 'excecoes_pauta',
    'presencas_deprecated'
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

-- Older snapshots may predate an enrollment FK. Lock their original turma
-- only when matricula_id is absent; for ordinary snapshots the existing
-- enrollment lock is used, avoiding reverse lock-order deadlocks.
CREATE OR REPLACE FUNCTION public.lock_legacy_historico_turma_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $fn$
BEGIN
  IF NEW.matricula_id IS NULL AND NEW.turma_id IS NOT NULL THEN
    PERFORM 1 FROM public.turmas t
    WHERE t.id = NEW.turma_id AND t.escola_id = NEW.escola_id
    FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE='23503',
        MESSAGE='Turma de origem do histórico não encontrada nesta escola.';
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$;
REVOKE ALL ON FUNCTION public.lock_legacy_historico_turma_v1()
  FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS a_00_lock_legacy_historico_turma ON public.historico_anos;
CREATE TRIGGER a_00_lock_legacy_historico_turma
  BEFORE INSERT OR UPDATE ON public.historico_anos
  FOR EACH ROW EXECUTE FUNCTION public.lock_legacy_historico_turma_v1();
COMMIT;
