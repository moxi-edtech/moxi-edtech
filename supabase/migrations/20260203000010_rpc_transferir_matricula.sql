BEGIN;

-- =================================================================
-- RPC para Transferência de Matrícula
--
-- Substitui a lógica que estava na API:
-- /api/secretaria/matriculas/[matriculaId]/transfer/route.ts
--
-- Benefícios:
-- 1. ATOMICIDADE: Garante que a transferência (desativar antiga, criar nova)
--    seja uma operação única e transacional.
-- 2. AUDITORIA: Centraliza o registro de auditoria na mesma transação.
-- 3. PERFORMANCE: Reduz múltiplas chamadas de rede a uma única.
-- =================================================================

CREATE OR REPLACE FUNCTION public.transferir_matricula(
  p_escola_id uuid,
  p_matricula_id uuid,
  p_target_turma_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- Variáveis de validação e controle
  v_actor_id uuid := auth.uid();
  v_matricula_origem record;
  v_turma_destino record;
  v_nova_matricula_id uuid;
  v_has_permission boolean;
BEGIN
  -- 1. Validação de Permissões
  SELECT public.user_has_role_in_school(p_escola_id, ARRAY['secretaria', 'admin', 'admin_escola', 'staff_admin'])
  INTO v_has_permission;
  IF NOT v_has_permission THEN
    RAISE EXCEPTION 'AUTH: Permissão negada.';
  END IF;

  -- 2. Validar Matrícula de Origem
  SELECT * INTO v_matricula_origem FROM public.matriculas WHERE id = p_matricula_id AND escola_id = p_escola_id FOR UPDATE;
  IF v_matricula_origem.id IS NULL THEN
    RAISE EXCEPTION 'DATA: Matrícula de origem não encontrada.';
  END IF;
  IF v_matricula_origem.turma_id = p_target_turma_id THEN
    RAISE EXCEPTION 'LOGIC: A turma de destino deve ser diferente da turma de origem.';
  END IF;

  -- 3. Validar Turma de Destino
  SELECT * INTO v_turma_destino FROM public.turmas WHERE id = p_target_turma_id AND escola_id = p_escola_id;
  IF v_turma_destino.id IS NULL THEN
    RAISE EXCEPTION 'DATA: Turma de destino não encontrada.';
  END IF;

  -- 4. Verificar se já existe matrícula ativa para o aluno na turma de destino
  IF EXISTS (
    SELECT 1 FROM public.matriculas
    WHERE escola_id = p_escola_id
      AND aluno_id = v_matricula_origem.aluno_id
      AND turma_id = p_target_turma_id
      AND status = 'ativa'
  ) THEN
    RAISE EXCEPTION 'LOGIC: Aluno já possui matrícula ativa na turma de destino.';
  END IF;

  -- 5. Criar a nova matrícula como 'ativa'
  INSERT INTO public.matriculas (
    escola_id,
    aluno_id,
    turma_id,
    ano_letivo,
    status,
    data_matricula
  )
  VALUES (
    p_escola_id,
    v_matricula_origem.aluno_id,
    p_target_turma_id,
    v_turma_destino.ano_letivo,
    'ativa',
    now()
  )
  RETURNING id INTO v_nova_matricula_id;

  -- 6. Atualizar a matrícula antiga para 'transferido'
  UPDATE public.matriculas
  SET status = 'transferido', updated_at = now()
  WHERE id = p_matricula_id;

  -- 7. Auditoria
  INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, portal, details)
  VALUES (
    p_escola_id,
    v_actor_id,
    'MATRICULA_TRANSFERIDA',
    'matriculas',
    p_matricula_id::text,
    'secretaria',
    jsonb_build_object(
      'matricula_origem_id', p_matricula_id,
      'matricula_destino_id', v_nova_matricula_id,
      'turma_origem_id', v_matricula_origem.turma_id,
      'turma_destino_id', p_target_turma_id
    )
  );

  RETURN jsonb_build_object('ok', true, 'matricula_id', v_nova_matricula_id);
END;
$$;

ALTER FUNCTION public.transferir_matricula(uuid, uuid, uuid) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.transferir_matricula(uuid, uuid, uuid) TO authenticated;

COMMIT;
