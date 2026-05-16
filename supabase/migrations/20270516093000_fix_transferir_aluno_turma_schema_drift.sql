BEGIN;

CREATE OR REPLACE FUNCTION public.transferir_aluno_turma(
  p_matricula_origem_id uuid,
  p_turma_destino_id uuid,
  p_motivo text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_escola_id uuid := public.current_tenant_escola_id();
  v_origem record;
  v_origem_turma record;
  v_dest record;
  v_has_permission boolean := false;
BEGIN
  IF v_escola_id IS NULL THEN
    RAISE EXCEPTION 'AUTH: escola_id inválido.';
  END IF;

  SELECT public.user_has_role_in_school(v_escola_id, ARRAY['secretaria','admin','admin_escola','staff_admin'])
    INTO v_has_permission;
  IF NOT v_has_permission THEN
    RAISE EXCEPTION 'AUTH: Permissão negada.';
  END IF;

  SELECT *
    INTO v_origem
  FROM public.matriculas
  WHERE id = p_matricula_origem_id
    AND escola_id = v_escola_id
    AND public.canonicalize_matricula_status_text(status) = 'ativo'
  FOR UPDATE;

  IF v_origem.id IS NULL THEN
    RAISE EXCEPTION 'DATA: Matrícula de origem não encontrada ou não está ativa.';
  END IF;

  SELECT id, escola_id, classe_id, curso_id, ano_letivo, session_id
    INTO v_origem_turma
  FROM public.turmas
  WHERE id = v_origem.turma_id
    AND escola_id = v_escola_id;

  IF v_origem_turma.id IS NULL THEN
    RAISE EXCEPTION 'DATA: Turma de origem inválida.';
  END IF;

  SELECT id, escola_id, classe_id, curso_id, ano_letivo, session_id
    INTO v_dest
  FROM public.turmas
  WHERE id = p_turma_destino_id
    AND escola_id = v_escola_id;

  IF v_dest.id IS NULL THEN
    RAISE EXCEPTION 'DATA: Turma destino inválida.';
  END IF;

  IF v_origem_turma.ano_letivo IS DISTINCT FROM v_dest.ano_letivo THEN
    RAISE EXCEPTION 'DATA: Transferência interna exige o mesmo ano letivo. Use rematrícula para mudar de ano.';
  END IF;

  IF v_origem_turma.classe_id IS NOT NULL
     AND v_dest.classe_id IS NOT NULL
     AND v_origem_turma.classe_id IS DISTINCT FROM v_dest.classe_id THEN
    RAISE EXCEPTION 'DATA: Transferência interna exige a mesma classe.';
  END IF;

  IF v_origem_turma.curso_id IS NOT NULL
     AND v_dest.curso_id IS NOT NULL
     AND v_origem_turma.curso_id IS DISTINCT FROM v_dest.curso_id THEN
    RAISE EXCEPTION 'DATA: Transferência interna exige o mesmo curso.';
  END IF;

  UPDATE public.matriculas
  SET turma_id = p_turma_destino_id,
      session_id = v_dest.session_id,
      ano_letivo = COALESCE(v_origem.ano_letivo, v_dest.ano_letivo),
      updated_at = now()
  WHERE id = v_origem.id
    AND escola_id = v_escola_id;

  RETURN v_origem.id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.transferir_aluno_turma(uuid, uuid, text) TO authenticated;

COMMIT;
