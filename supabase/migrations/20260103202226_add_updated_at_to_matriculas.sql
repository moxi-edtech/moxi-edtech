begin;

alter table public.matriculas
  add column if not exists updated_at timestamptz;

-- Temporarily disable the constraint
ALTER TABLE public.matriculas DROP CONSTRAINT IF EXISTS matriculas_numero_only_when_ativa;

-- Normalize status column values
UPDATE public.matriculas SET status = 'ativa' WHERE lower(trim(status)) = 'ativa';
UPDATE public.matriculas SET status = 'pendente' WHERE lower(trim(status)) = 'pendente';

-- Patch de dados para garantir consistência com matriculas_numero_only_when_ativa
-- a) remove número quando não está ativa
UPDATE public.matriculas
SET numero_matricula = NULL
WHERE status <> 'ativa'
  AND numero_matricula IS NOT NULL
  AND btrim(numero_matricula) <> '';

-- b) gera número para ativas sem número
DO $$
DECLARE
  rec RECORD;
  v_seq bigint;
  v_ano int;
BEGIN
  FOR rec IN
    SELECT id,
           escola_id,
           COALESCE(
             ano_letivo,
             EXTRACT(YEAR FROM COALESCE(data_matricula, now()))::int
           ) AS ano
      FROM public.matriculas
     WHERE status = 'ativa'
       AND (numero_matricula IS NULL OR btrim(numero_matricula) = '')
  LOOP
    v_seq := public.next_matricula_number(rec.escola_id);
    v_ano := rec.ano;

    UPDATE public.matriculas m
       SET numero_matricula =
             v_ano::text || '-' || lpad(v_seq::text, 6, '0') || '/' || v_ano::text
     WHERE m.id = rec.id;
  END LOOP;
END;
$$;

update public.matriculas
set updated_at = coalesce(updated_at, created_at, now());

-- Re-enable the constraint
ALTER TABLE public.matriculas
ADD CONSTRAINT matriculas_numero_only_when_ativa
CHECK (
  (status = 'ativa' AND numero_matricula IS NOT NULL AND btrim(numero_matricula) <> '')
  OR
  (status <> 'ativa' AND (numero_matricula IS NULL OR btrim(numero_matricula) = ''))
);

-- trigger genérico pra manter updated_at sempre em UPDATE
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_matriculas_set_updated_at on public.matriculas;

create trigger trg_matriculas_set_updated_at
before update on public.matriculas
for each row
execute function public.set_updated_at();

commit;

notify pgrst, 'reload schema';
