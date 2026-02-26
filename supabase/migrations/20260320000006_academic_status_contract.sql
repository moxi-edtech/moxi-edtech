BEGIN;

CREATE OR REPLACE FUNCTION public.get_estado_academico(
  p_escola_id uuid,
  p_curso_id uuid DEFAULT NULL,
  p_turma_id uuid DEFAULT NULL,
  p_curriculo_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_escola_id uuid := public.current_tenant_escola_id();
  v_curso record;
  v_turma record;
  v_curriculo record;
  v_curso_status text := 'unknown';
  v_turma_status text := 'unknown';
  v_curriculo_status text := 'unknown';
  v_fecho_status text := 'unknown';
BEGIN
  IF v_escola_id IS NULL OR p_escola_id IS DISTINCT FROM v_escola_id THEN
    RAISE EXCEPTION 'AUTH: escola_id inválido.';
  END IF;

  IF p_curso_id IS NOT NULL THEN
    SELECT id, status_aprovacao INTO v_curso
    FROM public.cursos
    WHERE id = p_curso_id AND escola_id = v_escola_id;

    IF v_curso.id IS NOT NULL THEN
      v_curso_status := CASE
        WHEN lower(coalesce(v_curso.status_aprovacao, '')) IN ('aprovado', 'ativo') THEN 'active'
        WHEN lower(coalesce(v_curso.status_aprovacao, '')) IN ('arquivado', 'inativo', 'cancelado') THEN 'archived'
        WHEN lower(coalesce(v_curso.status_aprovacao, '')) IN ('rascunho', 'draft') THEN 'draft'
        ELSE 'unknown'
      END;
    END IF;
  END IF;

  IF p_turma_id IS NOT NULL THEN
    SELECT id, status_validacao, status_fecho INTO v_turma
    FROM public.turmas
    WHERE id = p_turma_id AND escola_id = v_escola_id;

    IF v_turma.id IS NOT NULL THEN
      v_turma_status := CASE
        WHEN lower(coalesce(v_turma.status_validacao, '')) IN ('ativo', 'aprovado') THEN 'active'
        WHEN lower(coalesce(v_turma.status_validacao, '')) IN ('rascunho', 'draft') THEN 'draft'
        WHEN lower(coalesce(v_turma.status_validacao, '')) IN ('arquivado', 'inativo') THEN 'archived'
        ELSE 'unknown'
      END;

      v_fecho_status := CASE
        WHEN upper(coalesce(v_turma.status_fecho, '')) = 'FECHADO' THEN 'closed'
        WHEN upper(coalesce(v_turma.status_fecho, '')) = 'ABERTO' THEN 'open'
        ELSE 'unknown'
      END;
    END IF;
  END IF;

  IF p_curriculo_id IS NOT NULL THEN
    SELECT id, status INTO v_curriculo
    FROM public.curso_curriculos
    WHERE id = p_curriculo_id AND escola_id = v_escola_id;

    IF v_curriculo.id IS NOT NULL THEN
      v_curriculo_status := CASE
        WHEN v_curriculo.status = 'published' THEN 'active'
        WHEN v_curriculo.status = 'draft' THEN 'draft'
        WHEN v_curriculo.status = 'archived' THEN 'archived'
        ELSE 'unknown'
      END;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'curso_status', v_curso_status,
    'turma_status', v_turma_status,
    'curriculo_status', v_curriculo_status,
    'fecho_status', v_fecho_status
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_estado_academico(uuid, uuid, uuid, uuid) TO authenticated;

COMMIT;
