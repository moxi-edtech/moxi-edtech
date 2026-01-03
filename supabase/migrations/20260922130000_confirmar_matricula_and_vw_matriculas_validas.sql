BEGIN;

-- Função oficial para confirmação de matrículas
CREATE OR REPLACE FUNCTION public.confirmar_matricula(
  p_matricula_id uuid,
  p_force boolean DEFAULT false
)
RETURNS TABLE (
  matricula_id uuid,
  aluno_id uuid,
  numero_matricula text,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_m record;
BEGIN
  -- Lock otimista para evitar dupla confirmação
  SELECT *
  INTO v_m
  FROM public.matriculas
  WHERE id = p_matricula_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Matrícula % não encontrada', p_matricula_id;
  END IF;

  -- Idempotência
  IF v_m.status = 'ativa' THEN
    RETURN QUERY
    SELECT v_m.id, v_m.aluno_id, v_m.numero_matricula, v_m.status;
    RETURN;
  END IF;

  -- Validações padrão (p_force = false)
  IF NOT p_force THEN
    IF v_m.turma_id IS NULL THEN
      RAISE EXCEPTION 'Matrícula % sem turma definida', p_matricula_id;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.turmas t
      WHERE t.id = v_m.turma_id
        AND t.status_validacao <> 'ativa'
    ) THEN
      RAISE EXCEPTION 'Turma da matrícula % ainda não está ativa', p_matricula_id;
    END IF;
  END IF;

  -- Confirma e deixa triggers cuidarem do restante (número/status aluno/etc.)
  UPDATE public.matriculas
  SET status = 'ativa',
      data_matricula = COALESCE(data_matricula, now())
  WHERE id = p_matricula_id
  RETURNING id, aluno_id, numero_matricula, status
  INTO matricula_id, aluno_id, numero_matricula, status;

  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.confirmar_matricula(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirmar_matricula(uuid, boolean) TO authenticated;

-- View canônica de matrículas válidas
DROP VIEW IF EXISTS public.vw_matriculas_validas;

CREATE OR REPLACE VIEW public.vw_matriculas_validas AS
SELECT
  m.id                AS matricula_id,
  m.escola_id,
  m.aluno_id,
  a.nome              AS aluno_nome,
  a.bi_numero,
  a.numero_processo,
  m.numero_matricula,
  m.numero_chamada,
  m.ano_letivo,

  m.session_id,
  m.data_matricula,
  m.status,
  t.id                AS turma_id,
  t.nome              AS turma_nome,
  t.turno,
  t.sala,
  t.classe_id,
  cl.nome             AS classe_nome,
  c.id                AS curso_id,
  c.nome              AS curso_nome,
  c.tipo              AS curso_tipo

FROM public.matriculas m
JOIN public.alunos a
  ON a.id = m.aluno_id
JOIN public.turmas t
  ON t.id = m.turma_id
LEFT JOIN public.classes cl
  ON cl.id = t.classe_id
LEFT JOIN public.cursos c
  ON c.id = t.curso_id
WHERE
  m.status = 'ativa'
  AND m.numero_matricula IS NOT NULL
  AND btrim(m.numero_matricula) <> ''
  AND t.status_validacao = 'ativa';

ALTER VIEW public.vw_matriculas_validas SET (security_invoker = true);
GRANT SELECT ON public.vw_matriculas_validas TO anon, authenticated, service_role;

-- Índices de apoio (idempotentes)
CREATE INDEX IF NOT EXISTS idx_matriculas_validas_escola
  ON public.matriculas (escola_id)
  WHERE status = 'ativa';

CREATE INDEX IF NOT EXISTS idx_matriculas_validas_aluno
  ON public.matriculas (aluno_id)
  WHERE status = 'ativa';

COMMIT;
