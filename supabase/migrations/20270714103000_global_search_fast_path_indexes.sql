CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_search_alunos_escola_updated_id
ON public.alunos (escola_id, updated_at DESC, created_at DESC, id DESC)
WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_search_alunos_numero_processo_trgm
ON public.alunos USING gin (numero_processo gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_search_alunos_bi_numero_trgm
ON public.alunos USING gin (bi_numero gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_search_turmas_escola_updated_id
ON public.turmas (escola_id, updated_at DESC, created_at DESC, id DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_search_turmas_nome_trgm
ON public.turmas USING gin (nome gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_search_turmas_codigo_trgm
ON public.turmas USING gin (turma_codigo gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_search_matriculas_escola_updated_id
ON public.matriculas (escola_id, updated_at DESC, created_at DESC, id DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_search_matriculas_numero_trgm
ON public.matriculas USING gin (numero_matricula gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_search_matriculas_join_lookup
ON public.matriculas (escola_id, aluno_id, turma_id, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_search_candidaturas_escola_updated_id
ON public.candidaturas (escola_id, updated_at DESC, created_at DESC, id DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_search_candidaturas_nome_trgm
ON public.candidaturas USING gin (nome_candidato gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_search_documentos_escola_tipo_created_id
ON public.documentos_emitidos (escola_id, tipo, created_at DESC, id DESC)
WHERE revoked_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_search_documentos_aluno_lookup
ON public.documentos_emitidos (aluno_id, escola_id)
WHERE revoked_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_search_mensalidades_escola_updated_id
ON public.mensalidades (escola_id, updated_at DESC, created_at DESC, id DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_search_mensalidades_aluno_status_lookup
ON public.mensalidades (escola_id, aluno_id, status, data_vencimento);

CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_search_pagamentos_escola_created_id
ON public.pagamentos (escola_id, created_at DESC, id DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_search_pagamentos_mensalidade_lookup
ON public.pagamentos (mensalidade_id, escola_id, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_search_pagamentos_referencia_trgm
ON public.pagamentos USING gin (referencia gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_search_professores_escola_created_id
ON public.professores (escola_id, created_at DESC, id DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_search_professores_profile_lookup
ON public.professores (profile_id, escola_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_search_cursos_escola_updated_id
ON public.cursos (escola_id, updated_at DESC, created_at DESC, id DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_search_cursos_nome_trgm
ON public.cursos USING gin (nome gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_search_cursos_codigo_trgm
ON public.cursos USING gin (codigo gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_search_classes_escola_created_id
ON public.classes (escola_id, created_at DESC, id DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_search_classes_nome_trgm
ON public.classes USING gin (nome gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_search_escola_users_escola_created_id
ON public.escola_users (escola_id, created_at DESC, id DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_search_profiles_user_active_lookup
ON public.profiles (user_id, updated_at DESC, created_at DESC)
WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_search_profiles_nome_trgm
ON public.profiles USING gin (nome gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_search_profiles_email_trgm
ON public.profiles USING gin (email gin_trgm_ops);
