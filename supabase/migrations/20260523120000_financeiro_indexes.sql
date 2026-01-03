-- Índices para otimizar consultas de tabelas de preço e classes

create index if not exists idx_fin_tabelas_escola_ano_classe_curso
on public.financeiro_tabelas (escola_id, ano_letivo, classe_id, curso_id);

create index if not exists idx_classes_escola
on public.classes (escola_id);

create index if not exists idx_classes_curso
on public.classes (curso_id);
