\ir bootstrap_balcao_p0_minimal.sql

-- Minimal contract only for academic-carryover CI.
CREATE TABLE IF NOT EXISTS public.matriculas (
  id uuid PRIMARY KEY,
  escola_id uuid NOT NULL,
  aluno_id uuid NOT NULL,
  turma_id uuid,
  session_id uuid,
  ano_letivo integer,
  status text,
  ativo boolean DEFAULT false,
  origem_transicao_matricula_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.disciplinas_catalogo (
  id uuid PRIMARY KEY,
  escola_id uuid NOT NULL,
  nome text,
  sigla text
);

CREATE TABLE IF NOT EXISTS public.turma_disciplinas (
  id uuid PRIMARY KEY,
  escola_id uuid NOT NULL,
  turma_id uuid NOT NULL,
  avaliacao_disciplina_id uuid
);

CREATE TABLE IF NOT EXISTS public.exame_sessoes (
  id uuid PRIMARY KEY,
  escola_id uuid NOT NULL,
  tipo text NOT NULL,
  estado text NOT NULL,
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.exame_componentes (
  id uuid PRIMARY KEY,
  escola_id uuid NOT NULL,
  exame_sessao_id uuid NOT NULL,
  peso numeric NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS public.exame_resultados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL,
  exame_sessao_id uuid NOT NULL,
  exame_componente_id uuid NOT NULL,
  matricula_id uuid NOT NULL,
  turma_disciplina_id uuid,
  nota numeric,
  estado text NOT NULL DEFAULT 'submetido'
);

CREATE OR REPLACE FUNCTION public.portal_user_can_access_aluno(p_aluno_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT false;
$$;

CREATE OR REPLACE FUNCTION public.resolve_regime_academico(p_turma_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path TO ''
AS $$
  SELECT jsonb_build_object(
    'escala', 'quantitativa_secundario',
    'eh_classe_exame', false,
    'formula_mfd', jsonb_build_object('peso_percurso', 1, 'peso_exame', 0)
  );
$$;

CREATE OR REPLACE FUNCTION public.resolve_estado_resultado(
  p_matricula_id uuid,
  p_disciplina_id uuid
)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path TO ''
AS $$
  SELECT jsonb_build_object(
    'status', 'recurso',
    'positivo', false,
    'nota', 8,
    'motivo', 'recurso'
  );
$$;

CREATE OR REPLACE FUNCTION public.resolve_raa_progression_for_matricula(
  p_escola_id uuid,
  p_matricula_id uuid
)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path TO ''
AS $$
  SELECT jsonb_build_object(
    'decision', 'inscricao_condicional',
    'destino', 'proxima_etapa',
    'motivo', 'recurso',
    'efetivacao_matricula_bloqueada', false,
    'disciplina_ids_pendentes', jsonb_build_array(
      '00000000-0000-0000-0000-000000000501'::uuid
    )
  );
$$;
