-- Correção de nome no Balcão: autorização pelo tenant e auditoria atómica.
CREATE OR REPLACE FUNCTION public.corrigir_nome_aluno_balcao(
  p_aluno_id uuid,
  p_escola_id uuid,
  p_nome text,
  p_nome_anterior text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_papel text;
  v_nome text;
  v_nome_anterior text;
  v_escola_id uuid;
  v_profile_id uuid;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Utilizador não autenticado' USING ERRCODE = '42501';
  END IF;

  v_nome := regexp_replace(btrim(coalesce(p_nome, '')), '[[:space:]]+', ' ', 'g');
  IF char_length(v_nome) < 2 OR char_length(v_nome) > 160 THEN
    RAISE EXCEPTION 'Informe um nome entre 2 e 160 caracteres' USING ERRCODE = '22023';
  END IF;

  SELECT a.escola_id, a.nome, a.profile_id
    INTO v_escola_id, v_nome_anterior, v_profile_id
    FROM public.alunos AS a
   WHERE a.id = p_aluno_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Aluno não encontrado' USING ERRCODE = 'P0002';
  END IF;

  IF v_escola_id IS DISTINCT FROM p_escola_id THEN
    RAISE EXCEPTION 'Aluno não pertence à escola ativa' USING ERRCODE = '42501';
  END IF;

  SELECT eu.papel INTO v_papel
    FROM public.escola_users AS eu
   WHERE eu.escola_id = v_escola_id
     AND eu.user_id = v_actor
     AND eu.papel IN (
       'diretor', 'admin', 'admin_escola', 'staff_admin',
       'secretaria', 'secretaria_financeiro', 'financeiro', 'admin_financeiro',
       'admin_secretaria', 'admin_secretario'
     )
   LIMIT 1;

  IF v_papel IS NULL THEN
    RAISE EXCEPTION 'Perfil sem autorização para corrigir o nome' USING ERRCODE = '42501';
  END IF;

  IF p_nome_anterior IS NOT NULL AND v_nome_anterior IS DISTINCT FROM p_nome_anterior THEN
    RAISE EXCEPTION 'O nome foi atualizado por outra pessoa. Recarregue a ficha.'
      USING ERRCODE = '40001';
  END IF;

  IF v_nome_anterior IS NOT DISTINCT FROM v_nome THEN
    RETURN v_nome;
  END IF;

  UPDATE public.alunos SET nome = v_nome WHERE id = p_aluno_id;
  -- O trigger existente espelha nome em nome_completo.
  IF v_profile_id IS NOT NULL THEN
    UPDATE public.profiles SET nome = v_nome
     WHERE user_id = v_profile_id
       AND (escola_id = v_escola_id OR escola_id IS NULL);
  END IF;

  INSERT INTO public.audit_logs (
    escola_id, user_id, actor_id, actor_role, portal, acao, tabela,
    entity, entity_id, registro_id, "before", "after", details
  ) VALUES (
    v_escola_id, v_actor, v_actor, v_papel, 'secretaria',
    'ALUNO_NOME_CORRIGIDO', 'alunos', 'aluno', p_aluno_id::text,
    p_aluno_id::text,
    jsonb_build_object('nome', v_nome_anterior),
    jsonb_build_object('nome', v_nome),
    jsonb_build_object('performed_by', v_actor, 'role', v_papel,
      'nome_anterior', v_nome_anterior, 'nome_novo', v_nome)
  );

  RETURN v_nome;
END;
$$;

REVOKE ALL ON FUNCTION public.corrigir_nome_aluno_balcao(uuid, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.corrigir_nome_aluno_balcao(uuid, uuid, text, text) TO authenticated;
