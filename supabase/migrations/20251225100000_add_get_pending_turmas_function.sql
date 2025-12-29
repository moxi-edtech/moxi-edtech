-- Arquivo: supabase/migrations/20251225100000_add_get_pending_turmas_function.sql
-- Objetivo: Criar uma função para buscar todas as turmas com status 'rascunho' para uma dada escola.

CREATE OR REPLACE FUNCTION public.get_pending_turmas(p_escola_id uuid)
RETURNS SETOF public.turmas
LANGUAGE sql
STABLE
SECURITY INVOKER -- A função será executada com as permissões do usuário, respeitando a RLS existente.
AS $$
  SELECT *
  FROM public.turmas
  WHERE escola_id = p_escola_id AND status_validacao = 'rascunho'
  ORDER BY created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_pending_turmas(uuid) TO authenticated;
