BEGIN;

CREATE TABLE IF NOT EXISTS public.horario_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  turma_id uuid NOT NULL REFERENCES public.turmas(id) ON DELETE CASCADE,
  versao_id uuid REFERENCES public.horario_versoes(id) ON DELETE SET NULL,
  tipo text NOT NULL CHECK (tipo IN ('DRAFT_SAVE', 'PUBLISH', 'UNPUBLISH', 'DELETE_VERSION')),
  payload jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_horario_eventos_escola_turma
  ON public.horario_eventos (escola_id, turma_id, created_at DESC);

ALTER TABLE public.horario_eventos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS horario_eventos_select ON public.horario_eventos;
CREATE POLICY horario_eventos_select
ON public.horario_eventos
FOR SELECT
TO authenticated
USING (
  escola_id = current_tenant_escola_id()
  AND user_has_role_in_school(escola_id, array['admin','admin_escola','secretaria']::text[])
);

DROP POLICY IF EXISTS horario_eventos_write ON public.horario_eventos;
CREATE POLICY horario_eventos_write
ON public.horario_eventos
FOR INSERT
TO authenticated
WITH CHECK (
  escola_id = current_tenant_escola_id()
  AND user_has_role_in_school(escola_id, array['admin','admin_escola','secretaria']::text[])
);

CREATE OR REPLACE FUNCTION public.log_horario_event(
  p_escola_id uuid,
  p_turma_id uuid,
  p_versao_id uuid,
  p_tipo text,
  p_payload jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF p_tipo IS NULL OR p_tipo NOT IN ('DRAFT_SAVE', 'PUBLISH', 'UNPUBLISH', 'DELETE_VERSION') THEN
    RAISE EXCEPTION 'tipo de evento inválido: %', p_tipo;
  END IF;

  INSERT INTO public.horario_eventos (
    escola_id,
    turma_id,
    versao_id,
    tipo,
    payload,
    created_by
  )
  VALUES (
    p_escola_id,
    p_turma_id,
    p_versao_id,
    p_tipo,
    p_payload,
    auth.uid()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_validate_quadro_curriculo_cohesion()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM public.turma_disciplinas td
      JOIN public.curso_matriz cm ON cm.id = td.curso_matriz_id
     WHERE td.escola_id = NEW.escola_id
       AND td.turma_id = NEW.turma_id
       AND cm.disciplina_id = NEW.disciplina_id
  ) THEN
    RAISE EXCEPTION 'DOMAIN_CURRICULO_DISCIPLINA_MISMATCH: disciplina_id % não pertence à turma %', NEW.disciplina_id, NEW.turma_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_quadro_curriculo_cohesion ON public.quadro_horarios;
CREATE TRIGGER trg_validate_quadro_curriculo_cohesion
BEFORE INSERT OR UPDATE ON public.quadro_horarios
FOR EACH ROW
EXECUTE FUNCTION public.trg_validate_quadro_curriculo_cohesion();

CREATE OR REPLACE FUNCTION public.publish_horario_versao(
  p_escola_id uuid,
  p_turma_id uuid,
  p_versao_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_exists uuid;
  v_rows integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(CONCAT(p_escola_id::text, ':', p_turma_id::text)));

  SELECT id INTO v_exists
  FROM public.horario_versoes
  WHERE id = p_versao_id
    AND escola_id = p_escola_id
    AND turma_id = p_turma_id;

  IF v_exists IS NULL THEN
    RAISE EXCEPTION 'versão de horário não encontrada para escola/turma';
  END IF;

  SELECT COUNT(*)::int INTO v_rows
  FROM public.quadro_horarios
  WHERE escola_id = p_escola_id
    AND turma_id = p_turma_id
    AND versao_id = p_versao_id;

  IF v_rows = 0 THEN
    RAISE EXCEPTION 'não é possível publicar versão vazia';
  END IF;

  UPDATE public.horario_versoes
     SET status = 'arquivada',
         updated_at = now()
   WHERE escola_id = p_escola_id
     AND turma_id = p_turma_id
     AND status = 'publicada'
     AND id <> p_versao_id;

  UPDATE public.horario_versoes
     SET status = 'publicada',
         publicado_em = now(),
         updated_at = now()
   WHERE id = p_versao_id
     AND escola_id = p_escola_id
     AND turma_id = p_turma_id;

  PERFORM public.log_horario_event(
    p_escola_id,
    p_turma_id,
    p_versao_id,
    'PUBLISH',
    jsonb_build_object('items', v_rows, 'published_at', now())
  );

  RETURN p_versao_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_quadro_horarios_versao_atomic(
  p_escola_id uuid,
  p_turma_id uuid,
  p_versao_id uuid,
  p_items jsonb,
  p_publish boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_versao_id uuid;
  v_rows int := 0;
  v_published_id uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(CONCAT(p_escola_id::text, ':', p_turma_id::text, ':', p_versao_id::text)));

  SELECT id INTO v_versao_id
  FROM public.horario_versoes
  WHERE id = p_versao_id
    AND escola_id = p_escola_id
    AND turma_id = p_turma_id;

  IF v_versao_id IS NULL THEN
    RAISE EXCEPTION 'versao_id não pertence à escola/turma informada';
  END IF;

  DELETE FROM public.quadro_horarios
  WHERE escola_id = p_escola_id
    AND turma_id = p_turma_id
    AND versao_id = p_versao_id;

  INSERT INTO public.quadro_horarios (
    escola_id,
    turma_id,
    disciplina_id,
    professor_id,
    sala_id,
    slot_id,
    versao_id
  )
  SELECT
    p_escola_id,
    p_turma_id,
    (item->>'disciplina_id')::uuid,
    NULLIF(item->>'professor_id', '')::uuid,
    NULLIF(item->>'sala_id', '')::uuid,
    (item->>'slot_id')::uuid,
    p_versao_id
  FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb)) AS item;

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  PERFORM public.log_horario_event(
    p_escola_id,
    p_turma_id,
    p_versao_id,
    'DRAFT_SAVE',
    jsonb_build_object(
      'items', v_rows,
      'payload_hash', md5(COALESCE(p_items, '[]'::jsonb)::text),
      'publish', p_publish
    )
  );

  IF p_publish THEN
    v_published_id := public.publish_horario_versao(p_escola_id, p_turma_id, p_versao_id);
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'versao_id', p_versao_id,
    'inserted', v_rows,
    'published_id', v_published_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_horario_event(uuid, uuid, uuid, text, jsonb) TO authenticated;

COMMIT;
