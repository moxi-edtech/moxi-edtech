BEGIN;

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Saneamento 1: corrigir ranges inválidos (inicio >= fim).
UPDATE public.horario_slots
SET fim = LEAST((inicio + interval '45 minutes')::time, time '23:59:59')
WHERE inicio >= fim;

-- Saneamento 2: garantir ordem única por (escola,turno,dia).
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY escola_id, turno_id, dia_semana
      ORDER BY ordem, inicio, id
    ) AS ordem_normalizada
  FROM public.horario_slots
)
UPDATE public.horario_slots hs
SET ordem = r.ordem_normalizada
FROM ranked r
WHERE hs.id = r.id
  AND hs.ordem IS DISTINCT FROM r.ordem_normalizada;

-- Saneamento 3: eliminar sobreposição temporal de slots não-intervalo.
WITH RECURSIVE ordered AS (
  SELECT
    id,
    escola_id,
    turno_id,
    dia_semana,
    inicio,
    fim,
    ROW_NUMBER() OVER (
      PARTITION BY escola_id, turno_id, dia_semana
      ORDER BY inicio, fim, ordem, id
    ) AS rn
  FROM public.horario_slots
  WHERE COALESCE(is_intervalo, false) = false
), rec AS (
  SELECT
    o.id,
    o.escola_id,
    o.turno_id,
    o.dia_semana,
    o.rn,
    o.inicio AS new_inicio,
    o.fim AS new_fim
  FROM ordered o
  WHERE o.rn = 1

  UNION ALL

  SELECT
    o.id,
    o.escola_id,
    o.turno_id,
    o.dia_semana,
    o.rn,
    GREATEST(o.inicio, rec.new_fim) AS new_inicio,
    GREATEST(o.fim, GREATEST(o.inicio, rec.new_fim) + interval '5 minutes') AS new_fim
  FROM ordered o
  JOIN rec
    ON rec.escola_id = o.escola_id
   AND rec.turno_id = o.turno_id
   AND rec.dia_semana = o.dia_semana
   AND rec.rn + 1 = o.rn
)
UPDATE public.horario_slots hs
SET
  inicio = rec.new_inicio::time,
  fim = rec.new_fim::time
FROM rec
WHERE hs.id = rec.id
  AND (
    hs.inicio IS DISTINCT FROM rec.new_inicio::time
    OR hs.fim IS DISTINCT FROM rec.new_fim::time
  );

ALTER TABLE public.horario_slots
  DROP CONSTRAINT IF EXISTS horario_slots_inicio_fim_check;

ALTER TABLE public.horario_slots
  ADD CONSTRAINT horario_slots_inicio_fim_check
  CHECK (inicio < fim);

CREATE UNIQUE INDEX IF NOT EXISTS ux_horario_slots_grade_estavel
  ON public.horario_slots (escola_id, turno_id, dia_semana, ordem);

ALTER TABLE public.horario_slots
  DROP CONSTRAINT IF EXISTS excl_horario_slots_temporal;

ALTER TABLE public.horario_slots
  ADD CONSTRAINT excl_horario_slots_temporal
  EXCLUDE USING gist (
    escola_id WITH =,
    turno_id WITH =,
    dia_semana WITH =,
    int4range(
      EXTRACT(EPOCH FROM inicio)::int,
      EXTRACT(EPOCH FROM fim)::int,
      '[)'
    ) WITH &&
  )
  WHERE (COALESCE(is_intervalo, false) = false);

COMMIT;
