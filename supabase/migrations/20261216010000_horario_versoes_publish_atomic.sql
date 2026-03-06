BEGIN;

CREATE TABLE IF NOT EXISTS public.horario_versoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  turma_id uuid NOT NULL REFERENCES public.turmas(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'publicada', 'arquivada')),
  publicado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_horario_versoes_escola_turma_status
  ON public.horario_versoes (escola_id, turma_id, status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS ux_horario_versoes_publicada
  ON public.horario_versoes (escola_id, turma_id)
  WHERE status = 'publicada';

-- Backfill one published version per turma from existing quadro_horarios rows.
INSERT INTO public.horario_versoes (id, escola_id, turma_id, status, publicado_em, created_at, updated_at)
SELECT
  q.versao_id,
  q.escola_id,
  q.turma_id,
  'publicada'::text,
  now(),
  MIN(q.created_at),
  now()
FROM public.quadro_horarios q
LEFT JOIN public.horario_versoes hv ON hv.id = q.versao_id
WHERE hv.id IS NULL
GROUP BY q.versao_id, q.escola_id, q.turma_id;

ALTER TABLE public.quadro_horarios
  ADD CONSTRAINT fk_quadro_horarios_versao
  FOREIGN KEY (versao_id)
  REFERENCES public.horario_versoes(id)
  ON DELETE CASCADE;

DROP INDEX IF EXISTS public.ux_quadro_horarios_turma_slot;
CREATE UNIQUE INDEX IF NOT EXISTS ux_quadro_horarios_turma_slot_versao
  ON public.quadro_horarios (turma_id, slot_id, versao_id);

ALTER TABLE public.quadro_horarios
  DROP CONSTRAINT IF EXISTS quadro_horarios_professor_slot_excl;

ALTER TABLE public.quadro_horarios
  DROP CONSTRAINT IF EXISTS quadro_horarios_sala_slot_excl;

CREATE OR REPLACE FUNCTION public.trg_validate_quadro_published_conflicts()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_status text;
BEGIN
  SELECT hv.status
    INTO v_status
  FROM public.horario_versoes hv
  WHERE hv.id = NEW.versao_id;

  IF v_status IS DISTINCT FROM 'publicada' THEN
    RETURN NEW;
  END IF;

  IF NEW.professor_id IS NOT NULL AND EXISTS (
    SELECT 1
      FROM public.quadro_horarios q
      JOIN public.horario_versoes hv ON hv.id = q.versao_id
     WHERE q.escola_id = NEW.escola_id
       AND q.slot_id = NEW.slot_id
       AND q.professor_id = NEW.professor_id
       AND hv.status = 'publicada'
       AND q.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) THEN
    RAISE EXCEPTION 'Conflito global de professor para slot publicado';
  END IF;

  IF NEW.sala_id IS NOT NULL AND EXISTS (
    SELECT 1
      FROM public.quadro_horarios q
      JOIN public.horario_versoes hv ON hv.id = q.versao_id
     WHERE q.escola_id = NEW.escola_id
       AND q.slot_id = NEW.slot_id
       AND q.sala_id = NEW.sala_id
       AND hv.status = 'publicada'
       AND q.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) THEN
    RAISE EXCEPTION 'Conflito global de sala para slot publicado';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_quadro_published_conflicts ON public.quadro_horarios;
CREATE TRIGGER trg_validate_quadro_published_conflicts
BEFORE INSERT OR UPDATE ON public.quadro_horarios
FOR EACH ROW
EXECUTE FUNCTION public.trg_validate_quadro_published_conflicts();

CREATE OR REPLACE FUNCTION public.ensure_horario_versao(
  p_escola_id uuid,
  p_turma_id uuid,
  p_versao_id uuid DEFAULT NULL,
  p_status text DEFAULT 'draft'
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_versao_id uuid;
BEGIN
  IF p_versao_id IS NOT NULL THEN
    SELECT id INTO v_versao_id
    FROM public.horario_versoes
    WHERE id = p_versao_id
      AND escola_id = p_escola_id
      AND turma_id = p_turma_id;

    IF v_versao_id IS NULL THEN
      RAISE EXCEPTION 'versao_id não pertence à escola/turma informada';
    END IF;

    RETURN v_versao_id;
  END IF;

  INSERT INTO public.horario_versoes (escola_id, turma_id, status)
  VALUES (p_escola_id, p_turma_id, COALESCE(p_status, 'draft'))
  RETURNING id INTO v_versao_id;

  RETURN v_versao_id;
END;
$$;

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

  RETURN p_versao_id;
END;
$$;

DROP VIEW IF EXISTS public.vw_rotinas_compat;
CREATE VIEW public.vw_rotinas_compat AS
SELECT
  q.id,
  q.turma_id,
  NULL::uuid AS secao_id,
  q.disciplina_id AS curso_oferta_id,
  p.profile_id AS professor_user_id,
  hs.dia_semana AS weekday,
  hs.inicio,
  hs.fim,
  COALESCE(s.nome, t.sala) AS sala,
  q.escola_id
FROM public.quadro_horarios q
JOIN public.horario_slots hs ON hs.id = q.slot_id
JOIN public.horario_versoes hv ON hv.id = q.versao_id
LEFT JOIN public.professores p ON p.id = q.professor_id
LEFT JOIN public.salas s ON s.id = q.sala_id
LEFT JOIN public.turmas t ON t.id = q.turma_id
WHERE COALESCE(hs.is_intervalo, false) = false
  AND hv.status = 'publicada';

COMMIT;
