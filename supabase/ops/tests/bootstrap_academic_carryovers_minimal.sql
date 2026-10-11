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

CREATE TABLE IF NOT EXISTS public.servico_pedidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL,
  aluno_id uuid NOT NULL,
  matricula_id uuid,
  servico_escola_id uuid NOT NULL DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'granted',
  reason_code text,
  reason_detail text,
  servico_codigo text NOT NULL,
  servico_nome text NOT NULL DEFAULT 'Rematrícula',
  valor_cobrado numeric NOT NULL DEFAULT 0,
  contexto jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now()
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
AS $raa$
  SELECT jsonb_build_object(
    'decision', 'inscricao_condicional',
    'destino', 'proxima_etapa',
    'motivo', 'recurso',
    'efetivacao_matricula_bloqueada', false,
    'disciplina_ids_pendentes',
      coalesce(
        (
          SELECT jsonb_agg(td.avaliacao_disciplina_id ORDER BY td.avaliacao_disciplina_id)
          FROM public.matriculas m
          JOIN public.turma_disciplinas td
            ON td.escola_id = m.escola_id
           AND td.turma_id = m.turma_id
          WHERE m.id = p_matricula_id
            AND m.escola_id = p_escola_id
            AND td.avaliacao_disciplina_id IS NOT NULL
        ),
        '[]'::jsonb
      )
  );
$raa$;


-- Pre-migration backfill fixture. A migration deve criar a dependência sem
-- qualquer chamada manual a sync_dependencias_academicas_transicao().
INSERT INTO public.escolas(id, nome)
VALUES ('00000000-0000-0000-0000-000000000901', 'Escola Backfill')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.alunos(id, escola_id, nome)
VALUES (
  '00000000-0000-0000-0000-000000000902',
  '00000000-0000-0000-0000-000000000901',
  'Aluno Backfill'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.disciplinas_catalogo(id, escola_id, nome, sigla)
VALUES (
  '00000000-0000-0000-0000-000000000905',
  '00000000-0000-0000-0000-000000000901',
  'Química',
  'QUI'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.matriculas(
  id, escola_id, aluno_id, turma_id, ano_letivo, status, ativo
) VALUES (
  '00000000-0000-0000-0000-000000000903',
  '00000000-0000-0000-0000-000000000901',
  '00000000-0000-0000-0000-000000000902',
  '00000000-0000-0000-0000-000000000904',
  2026,
  'concluido',
  false
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.turma_disciplinas(
  id, escola_id, turma_id, avaliacao_disciplina_id
) VALUES (
  '00000000-0000-0000-0000-000000000907',
  '00000000-0000-0000-0000-000000000901',
  '00000000-0000-0000-0000-000000000904',
  '00000000-0000-0000-0000-000000000905'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.matriculas(
  id, escola_id, aluno_id, turma_id, ano_letivo, status, ativo,
  origem_transicao_matricula_id
) VALUES (
  '00000000-0000-0000-0000-000000000908',
  '00000000-0000-0000-0000-000000000901',
  '00000000-0000-0000-0000-000000000902',
  '00000000-0000-0000-0000-000000000909',
  2027,
  'ativo',
  true,
  '00000000-0000-0000-0000-000000000903'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.servico_pedidos(
  id, escola_id, aluno_id, matricula_id, servico_codigo, contexto
) VALUES (
  '00000000-0000-0000-0000-000000000910',
  '00000000-0000-0000-0000-000000000901',
  '00000000-0000-0000-0000-000000000902',
  '00000000-0000-0000-0000-000000000903',
  'SERV_REMATRICULA',
  jsonb_build_object(
    'origem_matricula_id', '00000000-0000-0000-0000-000000000903',
    'raa_disciplina_ids_pendentes', jsonb_build_array(
      '00000000-0000-0000-0000-000000000905'
    )
  )
)
ON CONFLICT (id) DO NOTHING;
