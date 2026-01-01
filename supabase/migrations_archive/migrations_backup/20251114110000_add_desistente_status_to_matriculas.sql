-- Add 'desistente' to the check constraint of the status column in the matriculas table

alter table if exists public.matriculas
  drop constraint if exists matriculas_status_check;

alter table if exists public.matriculas
  add constraint matriculas_status_check 
  check (status in ('ativo','trancado','concluido','transferido','desistente'));
