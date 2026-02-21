-- KLASSE: default entra_no_horario true + backfill nulls
alter table public.curso_matriz
  alter column entra_no_horario set default true;

alter table public.turma_disciplinas
  alter column entra_no_horario set default true;

update public.curso_matriz
set entra_no_horario = true
where entra_no_horario is null;

update public.turma_disciplinas
set entra_no_horario = true
where entra_no_horario is null;
