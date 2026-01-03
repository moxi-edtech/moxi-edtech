begin;

-- Purpose: Fix overload ambiguity on `public.confirmar_matricula` RPC.
--
-- Details:
-- PostgREST does not handle function overloading well when called with named
-- JSON parameters. This was causing a "Could not choose the best candidate function"
-- error.
--
-- The fix involves:
-- 1. Removing all existing `confirmar_matricula` functions.
-- 2. Creating a single, unambiguous `confirmar_matricula(p_matricula_id uuid)` function.
--
-- This ensures the RPC call from the client is always directed to the correct function.

-- Drop existing overloaded functions to ensure a clean state
drop function if exists public.confirmar_matricula(uuid, boolean);
drop function if exists public.confirmar_matricula(uuid);

-- Create the single, canonical function for the public RPC endpoint
create or replace function public.confirmar_matricula(
  p_matricula_id uuid
)
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
  -- Fetch matricula details and lock the row
  select m.aluno_id, m.turma_id, m.ano_letivo
    into v_aluno_id, v_turma_id, v_ano_letivo
  from public.matriculas m
  where m.id = p_matricula_id
  for update;

  if not found then
    raise exception 'Matrícula não encontrada';
  end if;

  -- Delegate to the core logic function
  return public.confirmar_matricula_core(
    v_aluno_id,
    v_ano_letivo,
    v_turma_id,
    p_matricula_id
  );
end;
$$;

-- Notify PostgREST to reload the schema to apply the changes
notify pgrst, 'reload schema';

commit;
