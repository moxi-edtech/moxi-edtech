-- PROPOSAL ONLY. Not a versioned migration; do not apply in production.
-- Generate a new migration using the repository's Supabase CLI, then test
-- with disposable PG17 fixtures and concurrent transactions before release.
-- No curriculum load or teacher assignment is required for publication.
BEGIN;

-- A school-wide transaction lock serializes competing timetable publications
-- and direct changes to published lessons across classes and shifts.
-- Use a single lock order for RPC writers (school, then version rows).
CREATE OR REPLACE FUNCTION public.trg_horario_publication_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_year uuid;
  v_turno text;
  v_classe uuid;
  v_curso uuid;
BEGIN
  IF NEW.status <> 'publicada' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'publicada' THEN RETURN NEW; END IF;
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('horarios:' || NEW.escola_id::text, 0));
  SELECT t.ano_letivo_id, CASE upper(t.turno) WHEN 'M' THEN 'matinal' WHEN 'T' THEN 'tarde' WHEN 'N' THEN 'noite' END,
         t.classe_id, t.curso_id
    INTO v_year, v_turno, v_classe, v_curso
    FROM public.turmas t JOIN public.anos_letivos a ON a.id=t.ano_letivo_id AND a.escola_id=t.escola_id
   WHERE t.id=NEW.turma_id AND t.escola_id=NEW.escola_id AND a.ativo
     AND t.status_validacao='ativo';
  IF v_year IS NULL OR v_turno IS NULL THEN
    RAISE EXCEPTION 'HORARIO_INVALID_YEAR_OR_SHIFT' USING ERRCODE='23514';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.quadro_horarios q WHERE q.versao_id=NEW.id AND q.escola_id=NEW.escola_id AND q.turma_id=NEW.turma_id) THEN
    RAISE EXCEPTION 'HORARIO_EMPTY' USING ERRCODE='23514';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.quadro_horarios q
    LEFT JOIN public.horario_slots s ON s.id=q.slot_id AND s.escola_id=q.escola_id
    WHERE q.versao_id=NEW.id AND q.escola_id=NEW.escola_id AND q.turma_id=NEW.turma_id
      AND (s.id IS NULL OR s.turno_id IS DISTINCT FROM v_turno OR COALESCE(s.is_intervalo,false)
       OR NOT EXISTS (
         SELECT 1 FROM public.turma_disciplinas td
         JOIN public.curso_matriz cm ON cm.id=td.curso_matriz_id AND cm.escola_id=td.escola_id
         JOIN public.curso_curriculos cc ON cc.id=cm.curso_curriculo_id AND cc.escola_id=cm.escola_id
         WHERE td.escola_id=q.escola_id AND td.turma_id=q.turma_id
           AND cm.disciplina_id=q.disciplina_id AND cm.ativo AND cm.classe_id=v_classe AND cm.curso_id=v_curso
           AND cc.ano_letivo_id=v_year AND cc.curso_id=v_curso AND cc.status='published'
           AND (cc.classe_id IS NULL OR cc.classe_id=v_classe)
           AND COALESCE(td.entra_no_horario,cm.entra_no_horario,true)
       ))
  ) THEN RAISE EXCEPTION 'HORARIO_INVALID_CURRICULUM_OR_SLOT' USING ERRCODE='23514'; END IF;
  IF EXISTS (
    SELECT 1
      FROM public.quadro_horarios q
      JOIN public.horario_slots s ON s.id=q.slot_id AND s.escola_id=q.escola_id
      JOIN public.quadro_horarios other ON other.escola_id=q.escola_id AND other.id<>q.id
      JOIN public.horario_versoes hv ON hv.id=other.versao_id AND hv.escola_id=other.escola_id AND hv.turma_id=other.turma_id
      JOIN public.turmas t ON t.id=other.turma_id AND t.escola_id=other.escola_id AND t.ano_letivo_id=v_year
      JOIN public.horario_slots os ON os.id=other.slot_id AND os.escola_id=other.escola_id
     WHERE q.versao_id=NEW.id AND q.escola_id=NEW.escola_id AND q.turma_id=NEW.turma_id
       AND (other.versao_id=NEW.id OR (other.turma_id<>NEW.turma_id AND hv.status='publicada'))
       AND s.dia_semana=os.dia_semana AND s.inicio<os.fim AND os.inicio<s.fim
       AND (other.versao_id=NEW.id OR other.sala_id=q.sala_id OR other.professor_id=q.professor_id)
  ) THEN RAISE EXCEPTION 'HORARIO_CONFLICT: sobreposição de turma, sala ou professor' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.trg_horario_publication_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_horario_publication_guard ON public.horario_versoes;
CREATE TRIGGER trg_horario_publication_guard BEFORE INSERT OR UPDATE OF status ON public.horario_versoes
FOR EACH ROW EXECUTE FUNCTION public.trg_horario_publication_guard();

-- Existing teacher reassignment flows can still update published lessons;
-- their conflicts must use the academic year and real time overlap too.
CREATE OR REPLACE FUNCTION public.trg_validate_quadro_published_conflicts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_status text; v_year uuid;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('horarios:' || NEW.escola_id::text, 0));
  SELECT hv.status,t.ano_letivo_id INTO v_status,v_year
    FROM public.horario_versoes hv JOIN public.turmas t ON t.id=hv.turma_id AND t.escola_id=hv.escola_id
   WHERE hv.id=NEW.versao_id AND hv.escola_id=NEW.escola_id AND hv.turma_id=NEW.turma_id;
  IF v_status IS DISTINCT FROM 'publicada' THEN RETURN NEW; END IF;
  IF v_year IS NULL THEN RAISE EXCEPTION 'HORARIO_INVALID_YEAR' USING ERRCODE='23514'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.horario_slots s
    JOIN public.quadro_horarios q ON q.escola_id=NEW.escola_id AND q.id<>NEW.id
    JOIN public.horario_versoes hv ON hv.id=q.versao_id AND hv.escola_id=q.escola_id AND hv.status='publicada'
    JOIN public.turmas t ON t.id=q.turma_id AND t.escola_id=q.escola_id AND t.ano_letivo_id=v_year
    JOIN public.horario_slots os ON os.id=q.slot_id AND os.escola_id=q.escola_id
    WHERE s.id=NEW.slot_id AND s.escola_id=NEW.escola_id
      AND s.dia_semana=os.dia_semana AND s.inicio<os.fim AND os.inicio<s.fim
      AND (q.turma_id=NEW.turma_id OR (NEW.sala_id IS NOT NULL AND q.sala_id=NEW.sala_id)
        OR (NEW.professor_id IS NOT NULL AND q.professor_id=NEW.professor_id))
  ) THEN RAISE EXCEPTION 'HORARIO_CONFLICT: sobreposição de turma, sala ou professor' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.trg_validate_quadro_published_conflicts() FROM PUBLIC, anon, authenticated;

-- Preserve existing RPC contract, require the authorized caller and a draft.
-- Reject a stale published/archived version instead of mutating it in place.
CREATE OR REPLACE FUNCTION public.upsert_quadro_horarios_versao_atomic(
  p_escola_id uuid, p_turma_id uuid, p_versao_id uuid, p_items jsonb, p_publish boolean DEFAULT false
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_status text; v_rows int; v_published_id uuid;
BEGIN
  IF COALESCE(NULLIF(pg_catalog.current_setting('request.jwt.claim.role',true),''),auth.jwt()->>'role','') <> 'service_role'
    AND (auth.uid() IS NULL OR NOT (
      EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id=auth.uid()
        AND p.deleted_at IS NULL AND (p.role IN ('super_admin','global_admin') OR (p.role='admin' AND p.escola_id=p_escola_id)))
      OR EXISTS (SELECT 1 FROM public.escola_users eu WHERE eu.escola_id=p_escola_id AND eu.user_id=auth.uid()
        AND lower(trim(coalesce(eu.papel,eu.role))) IN ('admin_financeiro','admin_secretaria','admin_escola','diretor'))
    ))
  THEN RAISE EXCEPTION 'HORARIO_UPSERT_FORBIDDEN' USING ERRCODE='42501'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('horarios:'||p_escola_id::text,0));
  SELECT hv.status INTO v_status FROM public.horario_versoes hv
    JOIN public.turmas t ON t.id=hv.turma_id AND t.escola_id=hv.escola_id
    JOIN public.anos_letivos a ON a.id=t.ano_letivo_id AND a.escola_id=t.escola_id AND a.ativo
   WHERE hv.id=p_versao_id AND hv.escola_id=p_escola_id AND hv.turma_id=p_turma_id
     AND t.status_validacao='ativo' FOR UPDATE OF hv;
  IF v_status IS DISTINCT FROM 'draft' THEN RAISE EXCEPTION 'HORARIO_STALE: recarregue o rascunho' USING ERRCODE='23514'; END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items)<>'array' OR jsonb_array_length(p_items)>500
     OR (p_publish AND jsonb_array_length(p_items)=0)
  THEN RAISE EXCEPTION 'HORARIO_INVALID_ITEMS' USING ERRCODE='23514'; END IF;
  DELETE FROM public.quadro_horarios WHERE escola_id=p_escola_id AND turma_id=p_turma_id AND versao_id=p_versao_id;
  INSERT INTO public.quadro_horarios(escola_id,turma_id,disciplina_id,professor_id,sala_id,slot_id,versao_id)
    SELECT p_escola_id,p_turma_id,(item->>'disciplina_id')::uuid,NULLIF(item->>'professor_id','')::uuid,
           NULLIF(item->>'sala_id','')::uuid,(item->>'slot_id')::uuid,p_versao_id FROM jsonb_array_elements(p_items) item;
  GET DIAGNOSTICS v_rows=ROW_COUNT;
  PERFORM public.log_horario_event(p_escola_id,p_turma_id,p_versao_id,'DRAFT_SAVE',
    jsonb_build_object('items',v_rows,'payload_hash',md5(p_items::text),'publish',p_publish));
  IF p_publish THEN v_published_id:=public.publish_horario_versao(p_escola_id,p_turma_id,p_versao_id); END IF;
  RETURN jsonb_build_object('ok',true,'versao_id',p_versao_id,'inserted',v_rows,'published_id',v_published_id);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.upsert_quadro_horarios_versao_atomic(uuid,uuid,uuid,jsonb,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.upsert_quadro_horarios_versao_atomic(uuid,uuid,uuid,jsonb,boolean) TO authenticated,service_role;

-- Acquire the same school lock before the existing per-turma publication lock.
CREATE OR REPLACE FUNCTION public.publish_horario_versao(p_escola_id uuid,p_turma_id uuid,p_versao_id uuid)
RETURNS uuid LANGUAGE plpgsql SET search_path TO 'pg_catalog','public','auth','extensions'
AS $$
DECLARE v_rows int;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('horarios:'||p_escola_id::text,0));
  PERFORM pg_catalog.pg_advisory_xact_lock(hashtext(p_escola_id::text||':'||p_turma_id::text));
  IF NOT EXISTS (SELECT 1 FROM public.horario_versoes WHERE id=p_versao_id AND escola_id=p_escola_id AND turma_id=p_turma_id AND status='draft')
  THEN RAISE EXCEPTION 'HORARIO_STALE: recarregue o rascunho' USING ERRCODE='23514'; END IF;
  SELECT count(*)::int INTO v_rows FROM public.quadro_horarios WHERE escola_id=p_escola_id AND turma_id=p_turma_id AND versao_id=p_versao_id;
  IF v_rows=0 THEN RAISE EXCEPTION 'HORARIO_EMPTY' USING ERRCODE='23514'; END IF;
  UPDATE public.horario_versoes SET status='arquivada',updated_at=now() WHERE escola_id=p_escola_id AND turma_id=p_turma_id AND status='publicada' AND id<>p_versao_id;
  UPDATE public.horario_versoes SET status='publicada',publicado_em=now(),updated_at=now() WHERE id=p_versao_id AND escola_id=p_escola_id AND turma_id=p_turma_id;
  PERFORM public.log_horario_event(p_escola_id,p_turma_id,p_versao_id,'PUBLISH',jsonb_build_object('items',v_rows,'published_at',now()));
  RETURN p_versao_id;
END;
$$;

COMMIT;
