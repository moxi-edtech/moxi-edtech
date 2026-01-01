-- 1) Presenças: adicionar disciplina_id (opcional) para vincular presença a disciplina
alter table if exists public.presencas
  add column if not exists disciplina_id uuid;
create index if not exists idx_presencas_disciplina on public.presencas(disciplina_id);

-- FK condicional para presencas.disciplina_id
do $$
begin
  if to_regclass('public.disciplinas') is not null then
    if not exists (
      select 1 from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      where t.relname = 'presencas' and c.conname = 'presencas_disciplina_id_fkey'
    ) then
      execute 'alter table public.presencas add constraint presencas_disciplina_id_fkey
               foreign key (disciplina_id) references public.disciplinas(id) on delete set null';
    end if;
  else
    raise notice 'public.disciplinas ausente; FK em presencas será criada quando existir.';
  end if;
end$$;

-- 2) Notas: adicionar disciplina_id (opcional) e índice; manter coluna texto para retrocompatibilidade
alter table if exists public.notas
  add column if not exists disciplina_id uuid;
create index if not exists idx_notas_disciplina on public.notas(disciplina_id);
-- Unique parcial quando disciplina_id não é nulo
do $$
begin
  if not exists (
    select 1 from pg_indexes where schemaname='public' and indexname='uq_notas_aluno_turma_disciplinaid_periodo'
  ) then
    execute 'create unique index uq_notas_aluno_turma_disciplinaid_periodo on public.notas (aluno_id, turma_id, disciplina_id, periodo_id) where disciplina_id is not null';
  end if;
end$$;

-- FK condicional para notas.disciplina_id
do $$
begin
  if to_regclass('public.disciplinas') is not null then
    if not exists (
      select 1 from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      where t.relname = 'notas' and c.conname = 'notas_disciplina_id_fkey'
    ) then
      execute 'alter table public.notas add constraint notas_disciplina_id_fkey
               foreign key (disciplina_id) references public.disciplinas(id) on delete set null';
    end if;
  else
    raise notice 'public.disciplinas ausente; FK em notas será criada quando existir.';
  end if;
end$$;

-- 3) Planejamento: opcionalmente referenciar syllabi
alter table if exists public.turma_disciplinas_professores
  add column if not exists syllabus_id uuid references public.syllabi(id) on delete set null;
create index if not exists idx_tdp_syllabus on public.turma_disciplinas_professores(syllabus_id);

-- 4) Classes: adicionar numero (inteiro) para promover por classe_id
alter table if exists public.classes
  add column if not exists numero int;
-- tentativa de backfill a partir de nome, ex: '10ª', '6a', 'Classe 7'
update public.classes
set numero = nullif(substring(nome from '([0-9]{1,2})'), '')::int
where numero is null;
create index if not exists idx_classes_numero on public.classes(numero);

-- garantir intervalo válido quando preenchido (1..13)
do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    where t.relname = 'classes' and c.conname = 'classes_numero_range_check'
  ) then
    execute 'alter table public.classes add constraint classes_numero_range_check
             check (numero is null or (numero between 1 and 13))';
  end if;
end$$;
