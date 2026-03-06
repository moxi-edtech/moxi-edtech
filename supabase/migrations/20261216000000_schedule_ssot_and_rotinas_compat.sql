BEGIN;

-- SSOT oficial de agenda: quadro_horarios + horario_slots.
-- rotinas passa a ser apenas compatibilidade de leitura temporária.

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
LEFT JOIN public.professores p ON p.id = q.professor_id
LEFT JOIN public.salas s ON s.id = q.sala_id
LEFT JOIN public.turmas t ON t.id = q.turma_id
WHERE COALESCE(hs.is_intervalo, false) = false;

COMMENT ON VIEW public.vw_rotinas_compat IS
  'Compatibilidade temporária de leitura com o formato legado de rotinas; SSOT oficial é quadro_horarios + horario_slots.';

CREATE OR REPLACE FUNCTION public.block_legacy_rotinas_write()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Tabela rotinas em modo legado somente-leitura. Use quadro_horarios + horario_slots (SSOT oficial).';
END;
$$;

DROP TRIGGER IF EXISTS trg_block_legacy_rotinas_write ON public.rotinas;

CREATE TRIGGER trg_block_legacy_rotinas_write
BEFORE INSERT OR UPDATE OR DELETE ON public.rotinas
FOR EACH ROW
EXECUTE FUNCTION public.block_legacy_rotinas_write();

COMMENT ON FUNCTION public.block_legacy_rotinas_write IS
  'Bloqueia escrita em rotinas após migração para SSOT de agenda.';

COMMIT;
