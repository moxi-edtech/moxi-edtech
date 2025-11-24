-- Restrict INSERT on alunos_excluidos to service role only

ALTER TABLE public.alunos_excluidos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS insert_alunos_excluidos_service ON public.alunos_excluidos;

CREATE POLICY insert_alunos_excluidos_service
ON public.alunos_excluidos
FOR INSERT
WITH CHECK (
  -- Only allow server-side inserts via service role
  (SELECT auth.role()) = 'service_role'
);

