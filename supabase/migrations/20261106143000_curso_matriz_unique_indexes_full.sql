begin;

create unique index if not exists ux_curso_matriz_curso_classe_disciplina_full
  on public.curso_matriz (escola_id, curso_id, classe_id, disciplina_id);

create unique index if not exists ux_curso_matriz_curriculo_classe_disciplina_full
  on public.curso_matriz (escola_id, curso_curriculo_id, classe_id, disciplina_id);

commit;
