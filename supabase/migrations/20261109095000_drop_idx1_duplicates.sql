-- NOTE:
-- Keep partition child indexes tied to `idx_frequencias_lookup`.
-- Only remove confirmed duplicates below.

drop index if exists public.idx_alunos_nome_trgm;
drop index if exists public.idx_turma_disciplinas_turma_id_fk1;
