-- Candidate only. Do not apply before versioning, PG17 and consumer cutover.
BEGIN;
SET LOCAL lock_timeout = '5s';
-- Migration only: freeze the small schedule write surface while relinking and installing guards.
LOCK TABLE public.horario_versoes, public.quadro_horarios, public.horario_slots IN SHARE ROW EXCLUSIVE MODE;

-- Repair only unambiguous exact equivalents. Same day, same times, same school,
-- correct shift, not an interval, no occupied destination, no many-to-one mapping.
-- Preserve the lesson, version, discipline, teacher, room and all historical rows.
DO $repair$
DECLARE n_bad integer; n_map integer; n_updated integer;
BEGIN
  CREATE TEMP TABLE horario_repair_map ON COMMIT DROP AS
  WITH bad AS (
    SELECT q.id,q.escola_id,q.turma_id,q.versao_id,q.slot_id,
           s.dia_semana,s.inicio,s.fim,
           CASE upper(t.turno) WHEN 'M' THEN 'matinal' WHEN 'T' THEN 'tarde' WHEN 'N' THEN 'noite' END AS expected
    FROM public.quadro_horarios q
    JOIN public.horario_versoes v ON v.id=q.versao_id AND v.escola_id=q.escola_id AND v.turma_id=q.turma_id AND v.status='publicada'
    JOIN public.turmas t ON t.id=q.turma_id AND t.escola_id=q.escola_id
    JOIN public.anos_letivos a ON a.id=t.ano_letivo_id AND a.escola_id=t.escola_id AND a.ativo
    LEFT JOIN public.horario_slots s ON s.id=q.slot_id AND s.escola_id=q.escola_id
    WHERE t.status_validacao='ativo' AND (s.id IS NULL OR coalesce(s.is_intervalo,false)
      OR s.turno_id IS DISTINCT FROM CASE upper(t.turno) WHEN 'M' THEN 'matinal' WHEN 'T' THEN 'tarde' WHEN 'N' THEN 'noite' END)
  ), choices AS (
    SELECT b.*,s.id AS new_slot,count(*) OVER(PARTITION BY b.id) AS choices
    FROM bad b JOIN public.horario_slots s ON s.escola_id=b.escola_id AND s.dia_semana=b.dia_semana
      AND s.inicio=b.inicio AND s.fim=b.fim AND s.turno_id=b.expected AND NOT coalesce(s.is_intervalo,false)
  ) SELECT * FROM choices WHERE choices=1;
  SELECT count(*) INTO n_bad FROM public.quadro_horarios q
    JOIN public.horario_versoes v ON v.id=q.versao_id AND v.escola_id=q.escola_id AND v.turma_id=q.turma_id AND v.status='publicada'
    JOIN public.turmas t ON t.id=q.turma_id AND t.escola_id=q.escola_id
    JOIN public.anos_letivos a ON a.id=t.ano_letivo_id AND a.escola_id=t.escola_id AND a.ativo
    LEFT JOIN public.horario_slots s ON s.id=q.slot_id AND s.escola_id=q.escola_id
    WHERE t.status_validacao='ativo' AND (s.id IS NULL OR coalesce(s.is_intervalo,false)
      OR s.turno_id IS DISTINCT FROM CASE upper(t.turno) WHEN 'M' THEN 'matinal' WHEN 'T' THEN 'tarde' WHEN 'N' THEN 'noite' END);
  SELECT count(*) INTO n_map FROM pg_temp.horario_repair_map;
  IF n_map<>n_bad OR EXISTS (SELECT 1 FROM pg_temp.horario_repair_map GROUP BY escola_id,turma_id,versao_id,new_slot HAVING count(*)>1)
    OR EXISTS (SELECT 1 FROM pg_temp.horario_repair_map m JOIN public.quadro_horarios q ON q.escola_id=m.escola_id AND q.turma_id=m.turma_id AND q.versao_id=m.versao_id AND q.slot_id=m.new_slot AND q.id<>m.id)
  THEN RAISE EXCEPTION 'HORARIO_REPAIR_AMBIGUOUS'; END IF;
  UPDATE public.quadro_horarios q SET slot_id=m.new_slot FROM pg_temp.horario_repair_map m
  WHERE q.id=m.id AND q.escola_id=m.escola_id AND q.slot_id=m.slot_id;
  GET DIAGNOSTICS n_updated=ROW_COUNT;
  IF n_updated<>n_bad THEN RAISE EXCEPTION 'HORARIO_REPAIR_COUNT_MISMATCH'; END IF;
  INSERT INTO public.audit_logs(escola_id,portal,action,entity,entity_id,acao,tabela,registro_id,"before","after")
  SELECT escola_id,'sistema','HORARIO_SLOT_RELINK','quadro_horarios',id::text,'HORARIO_SLOT_RELINK','quadro_horarios',id::text,
    jsonb_build_object('slot_id',slot_id,'dia',dia_semana,'inicio',inicio,'fim',fim),
    jsonb_build_object('slot_id',new_slot,'dia',dia_semana,'inicio',inicio,'fim',fim)
  FROM pg_temp.horario_repair_map;
END;
$repair$;

-- Explicit DB authorization; no global admin role grants tenant access by itself.
CREATE OR REPLACE FUNCTION public.horario_assert_writer(p_escola_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_actor uuid := auth.uid();
BEGIN
  IF p_escola_id IS NULL THEN RAISE EXCEPTION 'HORARIO_UPSERT_FORBIDDEN' USING ERRCODE='42501'; END IF;
  IF auth.jwt()->>'role'='service_role' THEN RETURN; END IF;
  IF v_actor IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.user_id=v_actor AND p.deleted_at IS NULL
  ) OR NOT (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id=v_actor AND p.deleted_at IS NULL AND p.role::text IN ('super_admin','global_admin'))
    OR (public.current_tenant_escola_id() IS NOT DISTINCT FROM p_escola_id AND EXISTS (
      SELECT 1 FROM public.escola_users eu WHERE eu.escola_id=p_escola_id AND eu.user_id=v_actor
      AND lower(trim(coalesce(eu.papel,eu.role))) IN ('admin','admin_escola','staff_admin','admin_financeiro','admin_secretaria','admin_secretario','diretor','secretaria','secretaria_financeiro')
    ))
  ) THEN RAISE EXCEPTION 'HORARIO_UPSERT_FORBIDDEN' USING ERRCODE='42501'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.horario_assert_writer(uuid) FROM PUBLIC,anon,authenticated,service_role;

-- Row triggers may run after a tuple lock is taken. Try-lock, never wait in them:
-- a competing writer must retry, avoiding row/advisory lock-order deadlocks.
CREATE OR REPLACE FUNCTION public.horario_guard_row_lock(p_escola_id uuid)
RETURNS void LANGUAGE plpgsql SET search_path=''
AS $$
BEGIN
  IF current_setting('transaction_isolation') <> 'read committed'
     OR NOT pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('horarios:'||p_escola_id::text,0))
  THEN RAISE EXCEPTION 'HORARIO_RETRY: recarregue e tente novamente' USING ERRCODE='40001'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.horario_guard_row_lock(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.horario_guard_row_lock(uuid) TO authenticated,service_role;

-- Direct API callers may create/delete a draft but cannot publish/archive,
-- change identity or delete historical versions. RPC runs as trusted owner.
CREATE OR REPLACE FUNCTION public.trg_horario_version_write_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path=''
AS $$
BEGIN
  IF TG_OP='DELETE' THEN
    PERFORM public.horario_guard_row_lock(OLD.escola_id);
    IF OLD.status<>'draft' THEN RAISE EXCEPTION 'HORARIO_STALE: versão oficial protegida' USING ERRCODE='23514'; END IF;
    RETURN OLD;
  END IF;
  PERFORM public.horario_guard_row_lock(NEW.escola_id);
  IF TG_OP='INSERT' THEN
    IF NEW.status<>'draft' THEN RAISE EXCEPTION 'HORARIO_STALE: crie um rascunho' USING ERRCODE='23514'; END IF;
  ELSE
    IF (NEW.id,NEW.escola_id,NEW.turma_id) IS DISTINCT FROM (OLD.id,OLD.escola_id,OLD.turma_id)
      OR (OLD.status='arquivada') OR (OLD.status='publicada' AND NEW.status<>'arquivada')
      OR (OLD.status='draft' AND NEW.status NOT IN ('draft','publicada'))
      OR (NEW.status IS DISTINCT FROM OLD.status AND current_user IN ('authenticated','anon','service_role'))
    THEN RAISE EXCEPTION 'HORARIO_STALE: use a publicação atómica' USING ERRCODE='23514'; END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.trg_horario_version_write_guard() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER trg_00_horario_version_write_guard BEFORE INSERT OR UPDATE OR DELETE ON public.horario_versoes
FOR EACH ROW EXECUTE FUNCTION public.trg_horario_version_write_guard();

-- Slots are shared by versions. Do not change the meaning of a published or
-- archived lesson by editing a slot; create a new valid slot instead.
CREATE OR REPLACE FUNCTION public.trg_horario_slot_snapshot_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
  IF TG_OP='INSERT' THEN PERFORM public.horario_guard_row_lock(NEW.escola_id); RETURN NEW; END IF;
  PERFORM public.horario_guard_row_lock(OLD.escola_id);
  IF TG_OP='UPDATE' THEN
    IF (NEW.id,NEW.escola_id) IS DISTINCT FROM (OLD.id,OLD.escola_id) THEN RAISE EXCEPTION 'HORARIO_SLOT_IDENTITY' USING ERRCODE='23514'; END IF;
    IF (NEW.turno_id,NEW.dia_semana,NEW.inicio,NEW.fim,NEW.is_intervalo,to_jsonb(NEW)->'ordem') IS NOT DISTINCT FROM
       (OLD.turno_id,OLD.dia_semana,OLD.inicio,OLD.fim,OLD.is_intervalo,to_jsonb(OLD)->'ordem') THEN RETURN NEW; END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM public.quadro_horarios q JOIN public.horario_versoes v ON v.id=q.versao_id AND v.escola_id=q.escola_id AND v.turma_id=q.turma_id WHERE q.escola_id=OLD.escola_id AND q.slot_id=OLD.id AND v.status IN ('publicada','arquivada'))
  THEN RAISE EXCEPTION 'HORARIO_SLOT_REFERENCED: tempo de versão oficial protegido' USING ERRCODE='23514'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.trg_horario_slot_snapshot_guard() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER trg_horario_slot_snapshot_guard BEFORE INSERT OR UPDATE OR DELETE ON public.horario_slots
FOR EACH ROW EXECUTE FUNCTION public.trg_horario_slot_snapshot_guard();

-- Replace the existing published-row trigger with immutable snapshots.
-- The canonical academic teacher assignment remains independent of publication.
CREATE OR REPLACE FUNCTION public.trg_validate_quadro_published_conflicts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_status text;
BEGIN
  IF TG_OP<>'INSERT' THEN
    PERFORM public.horario_guard_row_lock(OLD.escola_id);
    SELECT v.status INTO v_status FROM public.horario_versoes v WHERE v.id=OLD.versao_id AND v.escola_id=OLD.escola_id AND v.turma_id=OLD.turma_id;
    IF v_status IS DISTINCT FROM 'draft' AND NOT (TG_OP='DELETE' AND v_status IS NULL)
    THEN RAISE EXCEPTION 'HORARIO_STALE: versão oficial protegida' USING ERRCODE='23514'; END IF;
    IF TG_OP='DELETE' THEN RETURN OLD; END IF;
    IF (NEW.escola_id,NEW.turma_id,NEW.versao_id) IS DISTINCT FROM (OLD.escola_id,OLD.turma_id,OLD.versao_id)
    THEN RAISE EXCEPTION 'HORARIO_STALE: identidade da versão protegida' USING ERRCODE='23514'; END IF;
  END IF;
  PERFORM public.horario_guard_row_lock(NEW.escola_id);
  SELECT v.status INTO v_status FROM public.horario_versoes v WHERE v.id=NEW.versao_id AND v.escola_id=NEW.escola_id AND v.turma_id=NEW.turma_id;
  IF v_status IS DISTINCT FROM 'draft' THEN RAISE EXCEPTION 'HORARIO_STALE: use um rascunho' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.trg_validate_quadro_published_conflicts() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS trg_validate_quadro_published_conflicts ON public.quadro_horarios;
CREATE TRIGGER trg_validate_quadro_published_conflicts BEFORE INSERT OR UPDATE OR DELETE ON public.quadro_horarios
FOR EACH ROW EXECUTE FUNCTION public.trg_validate_quadro_published_conflicts();

-- Log entries must only be emitted from the trusted transaction, not via API.
REVOKE ALL ON FUNCTION public.log_horario_event(uuid,uuid,uuid,text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
REVOKE INSERT,UPDATE,DELETE,TRUNCATE ON TABLE public.horario_eventos FROM PUBLIC,anon,authenticated;
REVOKE TRUNCATE ON TABLE public.quadro_horarios,public.horario_versoes,public.horario_slots FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.ensure_horario_versao(p_escola_id uuid,p_turma_id uuid,p_versao_id uuid DEFAULT NULL,p_status text DEFAULT 'draft')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_id uuid;
BEGIN
  PERFORM public.horario_assert_writer(p_escola_id);
  PERFORM public.horario_guard_row_lock(p_escola_id);
  IF p_status IS DISTINCT FROM 'draft' THEN RAISE EXCEPTION 'HORARIO_STALE: crie um rascunho' USING ERRCODE='23514'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.turmas t WHERE t.id=p_turma_id AND t.escola_id=p_escola_id) THEN RAISE EXCEPTION 'HORARIO_UPSERT_FORBIDDEN' USING ERRCODE='42501'; END IF;
  IF p_versao_id IS NOT NULL THEN
    SELECT id INTO v_id FROM public.horario_versoes WHERE id=p_versao_id AND escola_id=p_escola_id AND turma_id=p_turma_id AND status='draft';
    IF v_id IS NULL THEN RAISE EXCEPTION 'HORARIO_STALE: recarregue o rascunho' USING ERRCODE='23514'; END IF;
    RETURN v_id;
  END IF;
  INSERT INTO public.horario_versoes(escola_id,turma_id,status) VALUES(p_escola_id,p_turma_id,'draft') RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.ensure_horario_versao(uuid,uuid,uuid,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.ensure_horario_versao(uuid,uuid,uuid,text) TO authenticated,service_role;

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
  PERFORM public.horario_guard_row_lock(NEW.escola_id);
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

CREATE OR REPLACE FUNCTION public.upsert_quadro_horarios_versao_atomic(
  p_escola_id uuid, p_turma_id uuid, p_versao_id uuid, p_items jsonb, p_publish boolean DEFAULT false
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_status text; v_rows int; v_published_id uuid;
BEGIN
  PERFORM public.horario_assert_writer(p_escola_id);
  IF current_setting('transaction_isolation') <> 'read committed' THEN RAISE EXCEPTION 'HORARIO_RETRY' USING ERRCODE='40001'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('horarios:'||p_escola_id::text,0));
  SELECT hv.status INTO v_status FROM public.horario_versoes hv
    JOIN public.turmas t ON t.id=hv.turma_id AND t.escola_id=hv.escola_id
    JOIN public.anos_letivos a ON a.id=t.ano_letivo_id AND a.escola_id=t.escola_id AND a.ativo
   WHERE hv.id=p_versao_id AND hv.escola_id=p_escola_id AND hv.turma_id=p_turma_id
     AND t.status_validacao='ativo' FOR UPDATE OF hv;
  IF v_status IS DISTINCT FROM 'draft' THEN RAISE EXCEPTION 'HORARIO_STALE: recarregue o rascunho' USING ERRCODE='23514'; END IF;
  IF p_publish IS NULL OR p_items IS NULL OR jsonb_typeof(p_items)<>'array' THEN RAISE EXCEPTION 'HORARIO_INVALID_ITEMS' USING ERRCODE='23514'; END IF;
  IF jsonb_array_length(p_items)>500 OR (p_publish AND jsonb_array_length(p_items)=0)
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

CREATE OR REPLACE FUNCTION public.publish_horario_versao(p_escola_id uuid,p_turma_id uuid,p_versao_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_rows int;
BEGIN
  PERFORM public.horario_assert_writer(p_escola_id);
  IF current_setting('transaction_isolation') <> 'read committed' THEN RAISE EXCEPTION 'HORARIO_RETRY' USING ERRCODE='40001'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('horarios:'||p_escola_id::text,0));
  PERFORM public.horario_guard_row_lock(p_escola_id);
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

REVOKE ALL ON FUNCTION public.publish_horario_versao(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
-- No direct publication endpoint; the existing atomic upsert owns publication.

COMMIT;
