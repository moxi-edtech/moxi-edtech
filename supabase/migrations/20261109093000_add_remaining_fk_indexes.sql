create index if not exists idx_configuracoes_curriculo_curso_id_fk
  on public.configuracoes_curriculo (curso_id);

create index if not exists idx_curso_curriculos_curso_id_fk
  on public.curso_curriculos (curso_id);

create index if not exists idx_curso_matriz_curso_curriculo_id_fk
  on public.curso_matriz (curso_curriculo_id);

create index if not exists idx_curso_matriz_curso_id_fk
  on public.curso_matriz (curso_id);

create index if not exists idx_curso_matriz_disciplina_id_fk
  on public.curso_matriz (disciplina_id);

create index if not exists idx_cursos_curso_global_id_fk
  on public.cursos (curso_global_id);

create index if not exists idx_escola_users_user_id_fk
  on public.escola_users (user_id);

create index if not exists idx_frequencia_status_periodo_turma_id_fk
  on public.frequencia_status_periodo (turma_id);

create index if not exists idx_frequencias_default_routine_id_fk
  on public.frequencias_default (routine_id);

create index if not exists idx_historico_anos_aluno_id_fk
  on public.historico_anos (aluno_id);

create index if not exists idx_matriculas_turma_id_fk
  on public.matriculas (turma_id);

create index if not exists idx_notas_avaliacao_id_fk
  on public.notas (avaliacao_id);

create index if not exists idx_notas_avaliacoes_matricula_id_fk
  on public.notas_avaliacoes (matricula_id);

create index if not exists idx_periodos_letivos_ano_letivo_id_fk
  on public.periodos_letivos (ano_letivo_id);

create index if not exists idx_presencas_turma_id_fk
  on public.presencas (turma_id);

create index if not exists idx_tabelas_mensalidade_curso_id_fk
  on public.tabelas_mensalidade (curso_id);

create index if not exists idx_turma_disciplinas_turma_id_fk1
  on public.turma_disciplinas (turma_id);
