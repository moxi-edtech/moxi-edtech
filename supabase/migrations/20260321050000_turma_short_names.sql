WITH normalized AS (
  SELECT
    t.id,
    t.escola_id,
    t.curso_id,
    t.classe_id,
    t.ano_letivo,
    t.turno,
    regexp_replace(upper(coalesce(c.course_code, c.codigo, left(c.nome, 3))), '[^A-Z0-9]', '', 'g') || '-' ||
    COALESCE(
      NULLIF(regexp_replace(coalesce(cl.nome, ''), '[^0-9]', '', 'g'), ''),
      regexp_replace(
        regexp_replace(upper(coalesce(cl.nome, '')), '\\s+', '', 'g'),
        'CLASSE',
        '',
        'g'
      )
    ) || '-' ||
    upper(coalesce(t.turno, 'M')) || '-' ||
    COALESCE(NULLIF(split_part(t.nome, '-', 4), ''), 'A') AS new_nome
  FROM public.turmas t
  JOIN public.cursos c ON c.id = t.curso_id
  JOIN public.classes cl ON cl.id = t.classe_id
  WHERE t.classe_id IS NOT NULL
), ranked AS (
  SELECT
    normalized.*,
    COUNT(*) OVER (
      PARTITION BY escola_id, curso_id, classe_id, ano_letivo, turno, new_nome
    ) AS name_count
  FROM normalized
)
UPDATE public.turmas t
SET nome = n.new_nome
FROM ranked n
WHERE t.id = n.id
  AND n.name_count = 1;
