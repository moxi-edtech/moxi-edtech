begin;

alter table public.avaliacoes
  add column if not exists ano_letivo int,
  add column if not exists trimestre smallint,
  add column if not exists tipo text;

update public.avaliacoes
set tipo = coalesce(tipo, nome)
where tipo is null;

update public.avaliacoes a
set ano_letivo = t.ano_letivo
from public.turma_disciplinas td
join public.turmas t on t.id = td.turma_id
where td.id = a.turma_disciplina_id
  and a.ano_letivo is null;

update public.avaliacoes a
set trimestre = case
  when pl.data_inicio is null then null
  when extract(month from pl.data_inicio) between 1 and 4 then 1
  when extract(month from pl.data_inicio) between 5 and 8 then 2
  else 3
end
from public.periodos_letivos pl
where a.periodo_letivo_id = pl.id
  and a.trimestre is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ck_avaliacoes_trimestre'
      and conrelid = 'public.avaliacoes'::regclass
  ) then
    alter table public.avaliacoes
      add constraint ck_avaliacoes_trimestre
      check (trimestre between 1 and 3);
  end if;
end $$;

drop index if exists public.uq_avaliacoes_logica;

create unique index if not exists uq_avaliacoes_trimestre_tipo
  on public.avaliacoes (escola_id, turma_disciplina_id, ano_letivo, trimestre, tipo)
  where ano_letivo is not null and trimestre is not null and tipo is not null;

notify pgrst, 'reload schema';

commit;
