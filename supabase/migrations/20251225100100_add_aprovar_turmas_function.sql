-- Arquivo: supabase/migrations/20251225100100_add_aprovar_turmas_function.sql
-- Objetivo: Criar uma função para administradores aprovarem turmas que estão com status 'rascunho'.

CREATE OR REPLACE FUNCTION public.aprovar_turmas(p_turma_ids uuid[], p_escola_id uuid)
RETURNS void
LANGUAGE plpgsql
-- SECURITY DEFINER é necessário para que a função possa modificar o status
-- mesmo que o usuário não tenha permissão direta de UPDATE na tabela,
-- desde que ele passe na verificação de admin.
SECURITY DEFINER
AS $$
DECLARE
  is_admin bool;
BEGIN
  -- Verificação de segurança crucial: Garante que apenas um administrador da escola
  -- pode executar esta operação. A função is_escola_admin já existe no projeto.
  SELECT public.is_escola_admin(p_escola_id, auth.uid()) INTO is_admin;

  IF NOT is_admin THEN
    RAISE EXCEPTION 'Apenas administradores podem aprovar turmas.';
  END IF;

  -- Atualiza o status das turmas fornecidas para 'aprovado'
  UPDATE public.turmas
  SET
    status_validacao = 'aprovado',
    updated_at = now()
  WHERE
    id = ANY(p_turma_ids) AND escola_id = p_escola_id;

END;
$$;

-- Concede permissão para que usuários autenticados possam chamar a função.
-- A lógica de segurança *dentro* da função fará a validação final.
GRANT EXECUTE ON FUNCTION public.aprovar_turmas(uuid[], uuid) TO authenticated;
