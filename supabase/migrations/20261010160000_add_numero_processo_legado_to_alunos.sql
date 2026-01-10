alter table public.alunos
add column if not exists numero_processo_legado text;

create index if not exists idx_alunos_numero_processo_legado
on public.alunos(numero_processo_legado);
