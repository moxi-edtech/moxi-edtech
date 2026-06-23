-- Migration: Cockpit de Prontidão Pedagógica & Conselho de Turma (Angola)
-- Date: 2026-06-23

BEGIN;

-- =================================================================
-- 1. RPC: Obter a Prontidão de Lançamento de Notas por Turma
-- =================================================================
CREATE OR REPLACE FUNCTION public.get_pedagogico_prontidao_lancamentos(
  p_escola_id uuid,
  p_turma_id uuid,
  p_trimestre integer
)
RETURNS TABLE (
  turma_disciplina_id uuid,
  disciplina_nome text,
  professor_nome text,
  tipo text,
  total_alunos integer,
  notas_lancadas integer,
  pendentes integer,
  percentual_lancado numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_escola_id IS NULL OR p_turma_id IS NULL OR p_trimestre IS NULL THEN
    RETURN;
  END IF;

  -- SEGURANÇA: Validar Tenant e Autorização conforme padrão do Monorepo
  IF p_escola_id IS DISTINCT FROM public.current_tenant_escola_id() THEN
    RAISE EXCEPTION 'AUTH: escola_id inválido.';
  END IF;

  IF NOT public.user_has_role_in_school(p_escola_id, ARRAY['admin_escola','admin','secretaria','staff_admin']) THEN
    RAISE EXCEPTION 'AUTH: Permissão negada.';
  END IF;

  RETURN QUERY
  SELECT
    mp.turma_disciplina_id,
    mp.disciplina_nome::text,
    COALESCE(prof.nome, 'Sem Professor')::text AS professor_nome,
    mp.tipo::text,
    mp.total_alunos::integer,
    mp.notas_lancadas::integer,
    mp.pendentes::integer,
    CASE
      WHEN mp.total_alunos = 0 THEN 100.0
      ELSE ROUND((mp.notas_lancadas::numeric / mp.total_alunos::numeric) * 100.0, 1)
    END::numeric AS percentual_lancado
  FROM internal.mv_professor_pendencias mp
  LEFT JOIN public.profiles prof ON prof.user_id = mp.profile_id
  WHERE mp.escola_id = p_escola_id
    AND mp.turma_id = p_turma_id
    AND mp.trimestre = p_trimestre
  ORDER BY mp.disciplina_nome, mp.tipo;
END;
$$;

-- =================================================================
-- 2. RPC: Detetor de Notas em Falta (Missing Flags)
-- =================================================================
CREATE OR REPLACE FUNCTION public.get_turma_notas_pendentes_detalhe(
  p_escola_id uuid,
  p_turma_id uuid,
  p_trimestre integer
)
RETURNS TABLE (
  aluno_id uuid,
  aluno_nome text,
  numero_processo text,
  disciplina_nome text,
  tipo_avaliacao text,
  professor_nome text,
  professor_telefone text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_escola_id IS NULL OR p_turma_id IS NULL OR p_trimestre IS NULL THEN
    RETURN;
  END IF;

  -- SEGURANÇA: Validar Tenant e Autorização conforme padrão do Monorepo
  IF p_escola_id IS DISTINCT FROM public.current_tenant_escola_id() THEN
    RAISE EXCEPTION 'AUTH: escola_id inválido.';
  END IF;

  IF NOT public.user_has_role_in_school(p_escola_id, ARRAY['admin_escola','admin','secretaria','staff_admin']) THEN
    RAISE EXCEPTION 'AUTH: Permissão negada.';
  END IF;

  RETURN QUERY
  SELECT
    a.id AS aluno_id,
    a.nome::text AS aluno_nome,
    COALESCE(a.numero_processo_legado, a.numero_processo)::text AS numero_processo,
    dc.nome::text AS disciplina_nome,
    et.tipo_avaliacao::text,
    COALESCE(prof.nome, 'Sem Professor')::text AS professor_nome,
    COALESCE(prof.telefone, '')::text AS professor_telefone
  FROM public.matriculas m
  JOIN public.alunos a ON m.aluno_id = a.id
  JOIN public.turma_disciplinas td ON td.turma_id = m.turma_id
  JOIN public.curso_matriz cm ON cm.id = td.curso_matriz_id
  JOIN public.disciplinas_catalogo dc ON dc.id = cm.disciplina_id
  LEFT JOIN public.professores pr ON pr.id = td.professor_id
  LEFT JOIN public.profiles prof ON prof.user_id = pr.profile_id
  CROSS JOIN (SELECT unnest(ARRAY['MAC', 'NPP', 'NPT']) AS tipo_avaliacao) et
  LEFT JOIN public.avaliacoes av 
    ON av.turma_disciplina_id = td.id 
    AND av.trimestre = p_trimestre 
    AND upper(av.tipo) = et.tipo_avaliacao
  LEFT JOIN public.notas n 
    ON n.avaliacao_id = av.id 
    AND n.matricula_id = m.id
  WHERE m.escola_id = p_escola_id
    AND m.turma_id = p_turma_id
    AND m.status IN ('ativa', 'ativo', 'active')
    AND COALESCE(td.conta_para_media_med, true) IS TRUE
    AND (n.id IS NULL OR n.valor IS NULL)
    AND (n.is_isento IS NULL OR n.is_isento IS FALSE)
  ORDER BY a.nome, dc.nome, et.tipo_avaliacao;
END;
$$;

-- =================================================================
-- 3. RPC: Simulador de Conselho de Turma (Alunos em Risco - Média < 10)
-- =================================================================
CREATE OR REPLACE FUNCTION public.get_conselho_turma_risco(
  p_escola_id uuid,
  p_turma_id uuid,
  p_trimestre integer
)
RETURNS TABLE (
  aluno_id uuid,
  aluno_nome text,
  numero_processo text,
  disciplina_nome text,
  nota_final numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_escola_id IS NULL OR p_turma_id IS NULL OR p_trimestre IS NULL THEN
    RETURN;
  END IF;

  -- SEGURANÇA: Validar Tenant e Autorização conforme padrão do Monorepo
  IF p_escola_id IS DISTINCT FROM public.current_tenant_escola_id() THEN
    RAISE EXCEPTION 'AUTH: escola_id inválido.';
  END IF;

  IF NOT public.user_has_role_in_school(p_escola_id, ARRAY['admin_escola','admin','secretaria','staff_admin']) THEN
    RAISE EXCEPTION 'AUTH: Permissão negada.';
  END IF;

  RETURN QUERY
  SELECT
    a.id AS aluno_id,
    a.nome::text AS aluno_nome,
    COALESCE(a.numero_processo_legado, a.numero_processo)::text AS numero_processo,
    bm.disciplina_nome::text,
    bm.nota_final::numeric
  FROM internal.mv_boletim_por_matricula bm
  JOIN public.alunos a ON bm.aluno_id = a.id
  WHERE bm.escola_id = p_escola_id
    AND bm.turma_id = p_turma_id
    AND bm.trimestre = p_trimestre
    AND bm.nota_final IS NOT NULL
    AND bm.nota_final < 10.0
  ORDER BY a.nome, bm.nota_final ASC;
END;
$$;

-- Alterações de Dono e Permissões conforme padrão do Monorepo
ALTER FUNCTION public.get_pedagogico_prontidao_lancamentos(uuid, uuid, integer) OWNER TO postgres;
ALTER FUNCTION public.get_turma_notas_pendentes_detalhe(uuid, uuid, integer) OWNER TO postgres;
ALTER FUNCTION public.get_conselho_turma_risco(uuid, uuid, integer) OWNER TO postgres;

GRANT EXECUTE ON FUNCTION public.get_pedagogico_prontidao_lancamentos(uuid, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_turma_notas_pendentes_detalhe(uuid, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_conselho_turma_risco(uuid, uuid, integer) TO authenticated;

COMMIT;
