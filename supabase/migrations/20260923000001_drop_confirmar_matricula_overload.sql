begin;

-- Canonicaliza: apenas uma assinatura pública e delega ao core
drop function if exists public.confirmar_matricula(uuid, boolean);
drop function if exists public.confirmar_matricula(uuid);

create or replace function public.confirmar_matricula(p_matricula_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_aluno_id uuid;
  v_turma_id uuid;
  v_ano_letivo int;
begin
  select m.aluno_id, m.turma_id, m.ano_letivo
    into v_aluno_id, v_turma_id, v_ano_letivo
  from public.matriculas m
  where m.id = p_matricula_id
  for update;

  if not found then
    raise exception 'Matrícula não encontrada';
  end if;

  return public.confirmar_matricula_core(
    v_aluno_id,
    v_ano_letivo,
    v_turma_id,
    p_matricula_id
  );
end;
$$;

revoke all on function public.confirmar_matricula(uuid) from public;
grant execute on function public.confirmar_matricula(uuid) to authenticated, service_role;

-- O número deve ser gerado apenas pelo fluxo oficial
create or replace function public.trg_set_matricula_number()
returns trigger
language plpgsql
as $$
begin
  return new;
end;
$$;

notify pgrst, 'reload schema';

commit;
