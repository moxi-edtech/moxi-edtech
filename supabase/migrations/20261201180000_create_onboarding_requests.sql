BEGIN;

-- ── 1. Tabela principal ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.onboarding_requests (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now(),

  -- Status do pedido
  -- pendente | em_configuracao | activo | cancelado
  status           text NOT NULL DEFAULT 'pendente',

  -- ── Dados básicos da escola ──
  escola_nome      text NOT NULL,
  escola_abrev     text,
  escola_codigo    text,
  escola_morada    text,
  escola_municipio text,
  escola_provincia text DEFAULT 'Luanda',
  escola_tel       text,
  escola_email     text,
  director_nome    text,
  director_tel     text,
  ano_letivo       text DEFAULT '2026',

  -- ── Dados académicos (JSON) ──
  -- classes: [{ id, nome, nivel, activa, propina }]
  classes          jsonb DEFAULT '[]'::jsonb,

  -- turnos: ['M', 'T', 'N']
  turnos           jsonb DEFAULT '[]'::jsonb,

  -- turmas: { 'M': { '1': 2, '2': 1 }, 'T': { ... } }
  -- turno -> classe_id -> numero de turmas
  turmas           jsonb DEFAULT '{}'::jsonb,

  -- ── Dados financeiros (JSON) ──
  -- { data_inicio, dia_vencimento, mes_inicio, mes_fim,
  --   metodos: ['cash','transfer'], dados_bancarios, observacoes }
  financeiro       jsonb DEFAULT '{}'::jsonb,

  -- ── Utilizadores (JSON) ──
  -- { principal: { nome, tel, nivel_exp },
  --   outros: [{ nome, email, papel }] }
  utilizadores     jsonb DEFAULT '{}'::jsonb,

  -- ── Campo interno (só o Super Admin vê) ──
  notas_admin      text,

  -- ── Referência à escola criada (após provisionar) ──
  escola_id        uuid REFERENCES public.escolas(id) ON DELETE SET NULL
);

-- ── 2. Trigger para updated_at automático ────────────────────────
-- Nota: A função set_updated_at já existe no banco.
DROP TRIGGER IF EXISTS onboarding_updated_at ON public.onboarding_requests;
CREATE TRIGGER onboarding_updated_at
  BEFORE UPDATE ON public.onboarding_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 3. RLS — Row Level Security ───────────────────────────────────
ALTER TABLE public.onboarding_requests ENABLE ROW LEVEL SECURITY;

-- Qualquer pessoa pode INSERIR (formulário público)
DROP POLICY IF EXISTS "onboarding_insert_public" ON public.onboarding_requests;
CREATE POLICY "onboarding_insert_public"
  ON public.onboarding_requests
  FOR INSERT
  WITH CHECK (true);

-- Só super_admin pode LER e ACTUALIZAR
-- Nota: Utilizamos a função is_super_admin() já existente que verifica a tabela profiles.
DROP POLICY IF EXISTS "onboarding_select_admin" ON public.onboarding_requests;
CREATE POLICY "onboarding_select_admin"
  ON public.onboarding_requests
  FOR SELECT
  USING (public.is_super_admin());

DROP POLICY IF EXISTS "onboarding_update_admin" ON public.onboarding_requests;
CREATE POLICY "onboarding_update_admin"
  ON public.onboarding_requests
  FOR UPDATE
  USING (public.is_super_admin());

-- ── 4. Índices para performance ───────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_onboarding_status
  ON public.onboarding_requests(status);

CREATE INDEX IF NOT EXISTS idx_onboarding_created_at
  ON public.onboarding_requests(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_onboarding_escola_id
  ON public.onboarding_requests(escola_id);

COMMIT;
