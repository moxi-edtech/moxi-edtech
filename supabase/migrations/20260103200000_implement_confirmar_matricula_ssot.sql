-- Purpose: Implement the Single Source of Truth (SSOT) for matricula confirmation.
--
-- This function is the one and only public endpoint to confirm a matricula.
-- It is idempotent and ensures that a matricula is properly activated,
-- assigned a number, and that the associated student profile is updated.
--
-- All other versions of `confirmar_matricula` and orchestrator functions
-- like `create_or_confirm_matricula` will be removed.

create or replace function public.confirmar_matricula(
  p_matricula_id uuid
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_numero bigint;
  v_escola_id uuid;
begin
  -- Lock da matrícula e obter escola_id
  select numero_matricula, escola_id
    into v_numero, v_escola_id
  from public.matriculas
  where id = p_matricula_id
  for update;

  if not found then
    raise exception 'Matrícula não encontrada';
  end if;

  -- Gera número se ainda não existir
  if v_numero is null then
    v_numero := public.next_matricula_number(v_escola_id);
  end if;

  -- Confirma matrícula: atualiza status, número e ativa.
  -- Triggers (e.g., trg_activate_aluno_after_matricula) will handle related side-effects.
  update public.matriculas
  set
    numero_matricula = v_numero,
    status = 'ativo',
    ativo = true,
    updated_at = now()
  where id = p_matricula_id;

  return v_numero;
end;
$$;
