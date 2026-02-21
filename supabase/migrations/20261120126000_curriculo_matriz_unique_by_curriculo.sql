-- KLASSE: unique por curriculo (permite drafts com mesmas disciplinas)
alter table public.curso_matriz
  drop constraint if exists ux_curso_matriz_curso_classe_disciplina_full;

drop index if exists ux_curso_matriz_curso_classe_disciplina_full;

create unique index if not exists ux_curso_matriz_curriculo_disciplina
  on public.curso_matriz (escola_id, curso_id, classe_id, disciplina_id, curso_curriculo_id);
