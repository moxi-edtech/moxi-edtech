BEGIN;

-- Adiciona campos profissionais e financeiros ao perfil para suporte ao Portal do Formador e Honorários.
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS nif text,
  ADD COLUMN IF NOT EXISTS grau_academico text,
  ADD COLUMN IF NOT EXISTS especialidades text[],
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS banco text,
  ADD COLUMN IF NOT EXISTS iban text;

-- Comentários para documentação de esquema
COMMENT ON COLUMN public.profiles.nif IS 'Número de Identificação Fiscal (Angola)';
COMMENT ON COLUMN public.profiles.grau_academico IS 'Nível de escolaridade (ex: Licenciatura, Mestrado)';
COMMENT ON COLUMN public.profiles.especialidades IS 'Áreas de competência técnica/pedagógica';
COMMENT ON COLUMN public.profiles.bio IS 'Resumo biográfico profissional';
COMMENT ON COLUMN public.profiles.banco IS 'Nome da instituição bancária para pagamentos';
COMMENT ON COLUMN public.profiles.iban IS 'IBAN para transferências de honorários (21 dígitos)';

-- Atualizar o RPC de listagem de formadores para incluir os novos campos
DROP FUNCTION IF EXISTS public.formacao_formadores_por_centro(uuid);

CREATE OR REPLACE FUNCTION public.formacao_formadores_por_centro(
  p_escola_id uuid
)
RETURNS TABLE(
  user_id uuid,
  nome text,
  email text,
  telefone text,
  nif text,
  bi_numero text,
  sexo text,
  grau_academico text,
  especialidades text[],
  bio text,
  banco text,
  iban text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF p_escola_id IS NULL THEN
    RAISE EXCEPTION 'p_escola_id é obrigatório';
  END IF;

  IF auth.role() <> 'service_role'
    AND NOT public.is_super_or_global_admin()
    AND NOT public.user_has_role_in_school(
      p_escola_id,
      ARRAY['formacao_admin', 'formacao_secretaria', 'formacao_financeiro']::text[]
    )
  THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  RETURN QUERY
  SELECT
    eu.user_id,
    COALESCE(NULLIF(btrim(p.nome), ''), NULLIF(btrim(p.email), ''), 'Formador') AS nome,
    p.email,
    p.telefone,
    p.nif,
    p.bi_numero,
    p.sexo,
    p.grau_academico,
    p.especialidades,
    p.bio,
    p.banco,
    p.iban
  FROM public.escola_users eu
  LEFT JOIN public.profiles p ON p.user_id = eu.user_id
  WHERE eu.escola_id = p_escola_id
    AND eu.tenant_type = 'formacao'
    AND eu.papel = 'formador'
    AND COALESCE(p.deleted_at, '-infinity'::timestamptz) = '-infinity'::timestamptz
  ORDER BY COALESCE(NULLIF(btrim(p.nome), ''), NULLIF(btrim(p.email), ''), 'Formador'), eu.user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.formacao_formadores_por_centro(uuid) TO authenticated, service_role;

COMMIT;
