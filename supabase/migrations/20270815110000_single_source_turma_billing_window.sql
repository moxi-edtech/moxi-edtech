-- Single Source of Truth for the effective billing window of a turma.
-- Apply only after explicit approval: this changes the SQL contract consumed by
-- payment, generation and rematricula flows.

CREATE OR REPLACE FUNCTION public.resolve_turma_janela_cobranca(
  p_turma_id uuid,
  p_ano_letivo_id uuid
)
RETURNS TABLE (
  data_inicio date,
  data_fim date,
  is_classe_exame boolean
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $$
  SELECT
    COALESCE(j.data_inicio, a.data_inicio),
    COALESCE(j.data_fim, a.data_fim),
    public.is_turma_classe_exame(p_turma_id)
  FROM public.anos_letivos a
  LEFT JOIN public.turma_janelas_cobranca j
    ON j.turma_id = p_turma_id
   AND j.ano_letivo_id = a.id
  WHERE a.id = p_ano_letivo_id;
$$;

COMMENT ON FUNCTION public.resolve_turma_janela_cobranca(uuid, uuid) IS
  'Resolve a janela efetiva de cobrança de uma turma no ano letivo. É a fonte única para início, fim e regra de exame.';

