BEGIN;

-- 1) Colisões: revise antes de continuar (apenas consulta)
-- Deixe comentado se já conferiu
-- SELECT escola_id, course_code, count(*) qtd, array_agg(nome) cursos
-- FROM public.cursos
-- WHERE course_code IS NOT NULL
-- GROUP BY escola_id, course_code
-- HAVING count(*) > 1;

-- 2) Backfill EP/ESG (primário e ciclo 1)
UPDATE public.cursos c
SET course_code = CASE
  WHEN c.curriculum_key IN ('primario_base','primario_avancado') THEN 'EP'
  WHEN c.curriculum_key IN ('ciclo1') THEN 'ESG'
  ELSE c.course_code
END
WHERE c.course_code IS NULL
  AND c.curriculum_key IS NOT NULL;

-- 3) Backfill secundário/técnico (sem tecnico_base)
UPDATE public.cursos c
SET course_code = CASE c.curriculum_key
  WHEN 'tecnico_informatica' THEN 'TI'
  WHEN 'tecnico_gestao' THEN 'TG'
  WHEN 'tecnico_construcao' THEN 'CC'
  WHEN 'puniv' THEN 'CFB'
  WHEN 'economicas' THEN 'CEJ'
  WHEN 'saude_enfermagem' THEN 'ENF'
  WHEN 'saude_farmacia_analises' THEN 'AC'
  ELSE c.course_code
END
WHERE c.course_code IS NULL
  AND c.curriculum_key IS NOT NULL;

-- 4) Auditoria: cursos que ainda ficaram sem code (resolve manual)
-- SELECT escola_id, id, nome, curriculum_key
-- FROM public.cursos
-- WHERE course_code IS NULL
-- ORDER BY escola_id, nome;

COMMIT;
