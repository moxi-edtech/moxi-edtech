begin;

create unique index if not exists ux_curso_matriz_curso_classe_disciplina
  on public.curso_matriz (escola_id, curso_id, classe_id, disciplina_id)
  where curso_curriculo_id is null;

create unique index if not exists ux_curso_matriz_curriculo_classe_disciplina
  on public.curso_matriz (escola_id, curso_curriculo_id, classe_id, disciplina_id)
  where curso_curriculo_id is not null;

commit;
