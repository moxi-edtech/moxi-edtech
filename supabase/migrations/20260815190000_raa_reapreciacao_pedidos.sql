BEGIN;

CREATE TABLE IF NOT EXISTS public.reapreciacao_pedidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  ano_letivo_id uuid NOT NULL REFERENCES public.anos_letivos(id) ON DELETE RESTRICT,
  turma_id uuid NOT NULL REFERENCES public.turmas(id) ON DELETE RESTRICT,
  matricula_id uuid NOT NULL REFERENCES public.matriculas(id) ON DELETE RESTRICT,
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE RESTRICT,
  turma_disciplina_id uuid NOT NULL REFERENCES public.turma_disciplinas(id) ON DELETE RESTRICT,
  disciplina_id uuid NOT NULL,
  nota_referencia numeric(6,2),
  motivo text NOT NULL CHECK (char_length(btrim(motivo)) >= 10),
  estado text NOT NULL DEFAULT 'pendente' CHECK (estado IN ('pendente', 'em_analise', 'deferido', 'indeferido', 'expirado', 'cancelado')),
  protocolo_publico text NOT NULL DEFAULT ('RAA-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  prazo_em timestamptz NOT NULL,
  idempotency_key text NOT NULL,
  solicitado_por uuid,
  decidido_por uuid,
  decidido_em timestamptz,
  decisao_motivo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (escola_id, protocolo_publico),
  UNIQUE (escola_id, idempotency_key)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_raa_reapreciacao_pendente_contexto
  ON public.reapreciacao_pedidos (escola_id, matricula_id, turma_disciplina_id)
  WHERE estado IN ('pendente', 'em_analise');

CREATE INDEX IF NOT EXISTS idx_raa_reapreciacao_pedidos_contexto
  ON public.reapreciacao_pedidos (escola_id, turma_id, disciplina_id, estado, prazo_em);

ALTER TABLE public.reapreciacao_pedidos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reapreciacao_pedidos_tenant ON public.reapreciacao_pedidos;
CREATE POLICY reapreciacao_pedidos_tenant ON public.reapreciacao_pedidos
  FOR ALL TO authenticated
  USING (public.user_can_access_raa_school(escola_id))
  WITH CHECK (public.user_can_access_raa_school(escola_id));

COMMENT ON TABLE public.reapreciacao_pedidos IS 'Pedidos RAA de reapreciação, com protocolo, idempotência e prazo regulamentar de 48 horas.';

COMMIT;
