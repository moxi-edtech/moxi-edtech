BEGIN;

-- Sprint 1 RAA: sessões, componentes, resultados de exame e melhoria.
-- A melhoria é vinculada a uma sessão de recurso; não é uma época autónoma.

CREATE TABLE IF NOT EXISTS public.exame_sessoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  ano_letivo_id uuid NOT NULL REFERENCES public.anos_letivos(id) ON DELETE RESTRICT,
  turma_id uuid REFERENCES public.turmas(id) ON DELETE SET NULL,
  tipo text NOT NULL CHECK (tipo IN ('exame_nacional', 'recurso', 'extraordinario')),
  modalidade text NOT NULL DEFAULT 'simples' CHECK (modalidade IN ('simples', 'escrita_oral', 'oral_pratica')),
  estado text NOT NULL DEFAULT 'rascunho' CHECK (estado IN ('rascunho', 'aberta', 'publicada', 'encerrada', 'cancelada')),
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  observacoes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT exame_sessoes_periodo_ck CHECK (data_fim >= data_inicio),
  CONSTRAINT exame_sessoes_turma_escola_ck CHECK (turma_id IS NULL OR escola_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS public.exame_componentes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  exame_sessao_id uuid NOT NULL REFERENCES public.exame_sessoes(id) ON DELETE CASCADE,
  codigo text NOT NULL CHECK (codigo IN ('escrita', 'oral', 'pratica')),
  peso numeric(6,3) NOT NULL DEFAULT 1 CHECK (peso > 0),
  nota_max numeric(6,2) NOT NULL DEFAULT 20 CHECK (nota_max > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (exame_sessao_id, codigo)
);

CREATE TABLE IF NOT EXISTS public.exame_resultados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  exame_sessao_id uuid NOT NULL REFERENCES public.exame_sessoes(id) ON DELETE CASCADE,
  exame_componente_id uuid NOT NULL REFERENCES public.exame_componentes(id) ON DELETE RESTRICT,
  matricula_id uuid NOT NULL REFERENCES public.matriculas(id) ON DELETE RESTRICT,
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE RESTRICT,
  turma_disciplina_id uuid REFERENCES public.turma_disciplinas(id) ON DELETE RESTRICT,
  nota numeric(6,2) CHECK (nota >= 0),
  estado text NOT NULL DEFAULT 'rascunho' CHECK (estado IN ('rascunho', 'submetido', 'validado', 'anulado')),
  observacao text,
  lancado_por uuid,
  lancado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (exame_sessao_id, exame_componente_id, matricula_id, turma_disciplina_id)
);

CREATE TABLE IF NOT EXISTS public.melhoria_nota_pedidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  exame_sessao_id uuid NOT NULL REFERENCES public.exame_sessoes(id) ON DELETE RESTRICT,
  matricula_id uuid NOT NULL REFERENCES public.matriculas(id) ON DELETE RESTRICT,
  turma_disciplina_id uuid REFERENCES public.turma_disciplinas(id) ON DELETE RESTRICT,
  nota_anterior numeric(6,2) NOT NULL CHECK (nota_anterior >= 0),
  nota_obtida numeric(6,2) CHECK (nota_obtida >= 0),
  nota_resultado numeric(6,2) GENERATED ALWAYS AS (GREATEST(nota_anterior, COALESCE(nota_obtida, nota_anterior))) STORED,
  estado text NOT NULL DEFAULT 'pendente' CHECK (estado IN ('pendente', 'aprovado', 'rejeitado', 'cancelado')),
  motivo text,
  solicitado_por uuid,
  decidido_por uuid,
  decidido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_melhoria_pedido_disciplina_sessao
  ON public.melhoria_nota_pedidos (exame_sessao_id, matricula_id, turma_disciplina_id)
  WHERE estado NOT IN ('cancelado', 'rejeitado');

CREATE INDEX IF NOT EXISTS idx_exame_sessoes_escola_ano
  ON public.exame_sessoes (escola_id, ano_letivo_id, estado);
CREATE INDEX IF NOT EXISTS idx_exame_resultados_lookup
  ON public.exame_resultados (escola_id, exame_sessao_id, aluno_id);
CREATE INDEX IF NOT EXISTS idx_melhoria_pedidos_lookup
  ON public.melhoria_nota_pedidos (escola_id, matricula_id, estado);

CREATE OR REPLACE FUNCTION public.assert_raa_exame_sessao_components()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_codes text[];
BEGIN
  IF NEW.estado IN ('aberta', 'publicada', 'encerrada') THEN
    SELECT array_agg(ec.codigo ORDER BY ec.codigo)
      INTO v_codes
      FROM public.exame_componentes ec
     WHERE ec.exame_sessao_id = NEW.id;

    IF NEW.modalidade = 'escrita_oral' AND v_codes IS DISTINCT FROM ARRAY['escrita', 'oral']::text[] THEN
      RAISE EXCEPTION 'Sessão escrita+oral exige exatamente os componentes escrita e oral.' USING ERRCODE = '22023';
    ELSIF NEW.modalidade = 'oral_pratica' AND v_codes IS DISTINCT FROM ARRAY['oral', 'pratica']::text[] THEN
      RAISE EXCEPTION 'Sessão oral+prática exige exatamente os componentes oral e prática.' USING ERRCODE = '22023';
    ELSIF NEW.modalidade = 'simples' AND coalesce(array_length(v_codes, 1), 0) <> 1 THEN
      RAISE EXCEPTION 'Sessão simples exige exatamente um componente.' USING ERRCODE = '22023';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assert_raa_exame_sessao_components ON public.exame_sessoes;
CREATE CONSTRAINT TRIGGER trg_assert_raa_exame_sessao_components
  AFTER INSERT OR UPDATE OF estado, modalidade ON public.exame_sessoes
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.assert_raa_exame_sessao_components();

CREATE OR REPLACE FUNCTION public.assert_raa_melhoria_recurso()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.exame_sessoes es
    WHERE es.id = NEW.exame_sessao_id AND es.tipo = 'recurso'
  ) THEN
    RAISE EXCEPTION 'Melhoria de nota deve estar vinculada a uma sessão de recurso.' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assert_raa_melhoria_recurso ON public.melhoria_nota_pedidos;
CREATE TRIGGER trg_assert_raa_melhoria_recurso
  BEFORE INSERT OR UPDATE OF exame_sessao_id ON public.melhoria_nota_pedidos
  FOR EACH ROW
  EXECUTE FUNCTION public.assert_raa_melhoria_recurso();

ALTER TABLE public.exame_sessoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exame_componentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exame_resultados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.melhoria_nota_pedidos ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.user_can_access_raa_school(p_escola_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.escola_users eu
    WHERE eu.escola_id = p_escola_id
      AND eu.user_id = auth.uid()
  );
$$;

DROP POLICY IF EXISTS exame_sessoes_tenant ON public.exame_sessoes;
CREATE POLICY exame_sessoes_tenant ON public.exame_sessoes
  FOR ALL TO authenticated
  USING (public.user_can_access_raa_school(escola_id))
  WITH CHECK (public.user_can_access_raa_school(escola_id));

DROP POLICY IF EXISTS exame_componentes_tenant ON public.exame_componentes;
CREATE POLICY exame_componentes_tenant ON public.exame_componentes
  FOR ALL TO authenticated
  USING (public.user_can_access_raa_school(escola_id))
  WITH CHECK (public.user_can_access_raa_school(escola_id));

DROP POLICY IF EXISTS exame_resultados_tenant ON public.exame_resultados;
CREATE POLICY exame_resultados_tenant ON public.exame_resultados
  FOR ALL TO authenticated
  USING (public.user_can_access_raa_school(escola_id))
  WITH CHECK (public.user_can_access_raa_school(escola_id));

DROP POLICY IF EXISTS melhoria_nota_pedidos_tenant ON public.melhoria_nota_pedidos;
CREATE POLICY melhoria_nota_pedidos_tenant ON public.melhoria_nota_pedidos
  FOR ALL TO authenticated
  USING (public.user_can_access_raa_school(escola_id))
  WITH CHECK (public.user_can_access_raa_school(escola_id));

COMMENT ON TABLE public.exame_sessoes IS 'Sessões oficiais do RAA; melhoria é variante de recurso, não tipo autónomo.';
COMMENT ON TABLE public.exame_componentes IS 'Componentes autorizados por sessão: simples, escrita+oral ou oral+prática.';
COMMENT ON TABLE public.exame_resultados IS 'Resultado por aluno, matrícula, disciplina e componente de exame.';
COMMENT ON TABLE public.melhoria_nota_pedidos IS 'Pedidos de melhoria com resultado máximo entre nota anterior e nota obtida.';

COMMIT;
