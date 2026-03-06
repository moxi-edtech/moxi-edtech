BEGIN;

-- Composite unique indexes to support composite FKs by tenant.
CREATE UNIQUE INDEX IF NOT EXISTS ux_turmas_id_escola ON public.turmas (id, escola_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_disciplinas_catalogo_id_escola ON public.disciplinas_catalogo (id, escola_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_professores_id_escola ON public.professores (id, escola_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_salas_id_escola ON public.salas (id, escola_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_horario_slots_id_escola ON public.horario_slots (id, escola_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_horario_versoes_id_escola ON public.horario_versoes (id, escola_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_horario_versoes_id_escola_turma ON public.horario_versoes (id, escola_id, turma_id);

-- Replace simple FKs with tenant-aware composite FKs.
ALTER TABLE public.quadro_horarios
  DROP CONSTRAINT IF EXISTS quadro_horarios_turma_id_fkey,
  DROP CONSTRAINT IF EXISTS quadro_horarios_disciplina_id_fkey,
  DROP CONSTRAINT IF EXISTS quadro_horarios_professor_id_fkey,
  DROP CONSTRAINT IF EXISTS quadro_horarios_sala_id_fkey,
  DROP CONSTRAINT IF EXISTS quadro_horarios_slot_id_fkey,
  DROP CONSTRAINT IF EXISTS fk_quadro_horarios_versao,
  DROP CONSTRAINT IF EXISTS fk_quadro_horarios_turma_escola,
  DROP CONSTRAINT IF EXISTS fk_quadro_horarios_disciplina_escola,
  DROP CONSTRAINT IF EXISTS fk_quadro_horarios_professor_escola,
  DROP CONSTRAINT IF EXISTS fk_quadro_horarios_sala_escola,
  DROP CONSTRAINT IF EXISTS fk_quadro_horarios_slot_escola,
  DROP CONSTRAINT IF EXISTS fk_quadro_horarios_versao_escola_turma;

ALTER TABLE public.quadro_horarios
  ADD CONSTRAINT fk_quadro_horarios_turma_escola
    FOREIGN KEY (turma_id, escola_id)
    REFERENCES public.turmas (id, escola_id)
    ON DELETE CASCADE,
  ADD CONSTRAINT fk_quadro_horarios_disciplina_escola
    FOREIGN KEY (disciplina_id, escola_id)
    REFERENCES public.disciplinas_catalogo (id, escola_id),
  ADD CONSTRAINT fk_quadro_horarios_professor_escola
    FOREIGN KEY (professor_id, escola_id)
    REFERENCES public.professores (id, escola_id),
  ADD CONSTRAINT fk_quadro_horarios_sala_escola
    FOREIGN KEY (sala_id, escola_id)
    REFERENCES public.salas (id, escola_id),
  ADD CONSTRAINT fk_quadro_horarios_slot_escola
    FOREIGN KEY (slot_id, escola_id)
    REFERENCES public.horario_slots (id, escola_id),
  ADD CONSTRAINT fk_quadro_horarios_versao_escola_turma
    FOREIGN KEY (versao_id, escola_id, turma_id)
    REFERENCES public.horario_versoes (id, escola_id, turma_id)
    ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION public.trg_validate_quadro_tenant_cohesion()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_ref_escola uuid;
  v_ref_turma uuid;
BEGIN
  SELECT escola_id INTO v_ref_escola
  FROM public.turmas
  WHERE id = NEW.turma_id;

  IF v_ref_escola IS NULL THEN
    RAISE EXCEPTION 'DOMAIN_REFERENCE_NOT_FOUND: turma_id % não encontrado', NEW.turma_id;
  ELSIF v_ref_escola <> NEW.escola_id THEN
    RAISE EXCEPTION 'DOMAIN_CROSS_TENANT_REFERENCE: turma_id % pertence a escola diferente', NEW.turma_id;
  END IF;

  SELECT escola_id INTO v_ref_escola
  FROM public.disciplinas_catalogo
  WHERE id = NEW.disciplina_id;

  IF v_ref_escola IS NULL THEN
    RAISE EXCEPTION 'DOMAIN_REFERENCE_NOT_FOUND: disciplina_id % não encontrado', NEW.disciplina_id;
  ELSIF v_ref_escola <> NEW.escola_id THEN
    RAISE EXCEPTION 'DOMAIN_CROSS_TENANT_REFERENCE: disciplina_id % pertence a escola diferente', NEW.disciplina_id;
  END IF;

  SELECT escola_id INTO v_ref_escola
  FROM public.horario_slots
  WHERE id = NEW.slot_id;

  IF v_ref_escola IS NULL THEN
    RAISE EXCEPTION 'DOMAIN_REFERENCE_NOT_FOUND: slot_id % não encontrado', NEW.slot_id;
  ELSIF v_ref_escola <> NEW.escola_id THEN
    RAISE EXCEPTION 'DOMAIN_CROSS_TENANT_REFERENCE: slot_id % pertence a escola diferente', NEW.slot_id;
  END IF;

  IF NEW.professor_id IS NOT NULL THEN
    SELECT escola_id INTO v_ref_escola
    FROM public.professores
    WHERE id = NEW.professor_id;

    IF v_ref_escola IS NULL THEN
      RAISE EXCEPTION 'DOMAIN_REFERENCE_NOT_FOUND: professor_id % não encontrado', NEW.professor_id;
    ELSIF v_ref_escola <> NEW.escola_id THEN
      RAISE EXCEPTION 'DOMAIN_CROSS_TENANT_REFERENCE: professor_id % pertence a escola diferente', NEW.professor_id;
    END IF;
  END IF;

  IF NEW.sala_id IS NOT NULL THEN
    SELECT escola_id INTO v_ref_escola
    FROM public.salas
    WHERE id = NEW.sala_id;

    IF v_ref_escola IS NULL THEN
      RAISE EXCEPTION 'DOMAIN_REFERENCE_NOT_FOUND: sala_id % não encontrado', NEW.sala_id;
    ELSIF v_ref_escola <> NEW.escola_id THEN
      RAISE EXCEPTION 'DOMAIN_CROSS_TENANT_REFERENCE: sala_id % pertence a escola diferente', NEW.sala_id;
    END IF;
  END IF;

  SELECT escola_id, turma_id INTO v_ref_escola, v_ref_turma
  FROM public.horario_versoes
  WHERE id = NEW.versao_id;

  IF v_ref_escola IS NULL THEN
    RAISE EXCEPTION 'DOMAIN_REFERENCE_NOT_FOUND: versao_id % não encontrado', NEW.versao_id;
  ELSIF v_ref_escola <> NEW.escola_id THEN
    RAISE EXCEPTION 'DOMAIN_CROSS_TENANT_REFERENCE: versao_id % pertence a escola diferente', NEW.versao_id;
  ELSIF v_ref_turma <> NEW.turma_id THEN
    RAISE EXCEPTION 'DOMAIN_CROSS_TENANT_REFERENCE: versao_id % não pertence à turma %', NEW.versao_id, NEW.turma_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_quadro_tenant_cohesion ON public.quadro_horarios;
CREATE TRIGGER trg_validate_quadro_tenant_cohesion
BEFORE INSERT OR UPDATE ON public.quadro_horarios
FOR EACH ROW
EXECUTE FUNCTION public.trg_validate_quadro_tenant_cohesion();

COMMIT;
