-- Backfill session_id em matriculas antigas
-- 1) Copia session_id da turma vinculada
UPDATE public.matriculas m
SET session_id = t.session_id
FROM public.turmas t
WHERE m.session_id IS NULL
  AND m.turma_id = t.id
  AND t.session_id IS NOT NULL;

-- 2) Se ainda estiver nulo, tenta casar data_matricula com intervalo da sessão da mesma escola
UPDATE public.matriculas m
SET session_id = s.id
FROM public.school_sessions s
WHERE m.session_id IS NULL
  AND m.escola_id = s.escola_id
  AND m.data_matricula IS NOT NULL
  AND m.data_matricula BETWEEN s.data_inicio AND s.data_fim;

-- 3) Opcional: log de quantos ainda ficaram sem session_id
-- SELECT count(*) AS matriculas_sem_session FROM public.matriculas WHERE session_id IS NULL;
