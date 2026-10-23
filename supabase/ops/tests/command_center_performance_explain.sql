\set ON_ERROR_STOP on
\timing on
SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-4000-8000-0000000000d1';
-- Same class >5000 synthetic pupils. 3 canonical query patterns before
-- and after the additional index; planner costs do not prove production.
EXPLAIN (ANALYZE, BUFFERS)
SELECT count(*) FROM public.matriculas m
JOIN public.alunos a ON a.id=m.aluno_id AND a.escola_id=m.escola_id
JOIN public.turmas t ON t.id=m.turma_id AND t.escola_id=m.escola_id
WHERE m.escola_id='00000000-0000-4000-8000-0000000000a1'
  AND m.ano_letivo=2026 AND t.classe_id='00000000-0000-4000-8000-0000000000c1'
  AND m.ativo IS TRUE AND m.status='ativo' AND a.deleted_at IS NULL;
EXPLAIN (ANALYZE, BUFFERS)
SELECT m.aluno_id FROM public.matriculas m
JOIN public.alunos a ON a.id=m.aluno_id AND a.escola_id=m.escola_id
JOIN public.turmas t ON t.id=m.turma_id AND t.escola_id=m.escola_id
WHERE m.escola_id='00000000-0000-4000-8000-0000000000a1'
  AND m.ano_letivo=2026 AND t.classe_id='00000000-0000-4000-8000-0000000000c1'
  AND m.ativo IS TRUE AND m.status='ativo' AND a.deleted_at IS NULL
ORDER BY public.normalize_search_text(a.nome_completo),m.aluno_id LIMIT 21;
EXPLAIN (ANALYZE, BUFFERS)
SELECT count(*) FROM public.candidaturas c
JOIN public.candidaturas_status_log log ON log.candidatura_id=c.id AND log.escola_id=c.escola_id
WHERE c.escola_id='00000000-0000-4000-8000-0000000000a1'
  AND c.ano_letivo=2026
  AND log.metadata->>'tipo'='DOCUMENTOS_PENDENTES';
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM public.command_center_roster_operational_v1(
 p_escola_id=>'00000000-0000-4000-8000-0000000000a1',
 p_ano_letivo=>2026,
 p_classe_id=>'00000000-0000-4000-8000-0000000000c1',
 p_sort=>'pendencias_primeiro',p_filter=>'ambos',p_limit=>21
);
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM public.command_center_roster_keyset_v2(
 p_escola_id=>'00000000-0000-4000-8000-0000000000a1',
 p_ano_letivo=>2026,
 p_classe_id=>'00000000-0000-4000-8000-0000000000c1',
 p_sort=>'nome_asc',p_limit=>21
);
RESET ROLE;
