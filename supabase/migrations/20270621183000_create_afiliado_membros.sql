BEGIN;

CREATE TABLE IF NOT EXISTS public.afiliado_membros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  afiliado_id uuid NOT NULL REFERENCES public.afiliados(id) ON DELETE CASCADE,
  nome text NOT NULL,
  pin_hash text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT afiliado_membros_nome_not_blank CHECK (length(btrim(nome)) >= 2)
);

CREATE INDEX IF NOT EXISTS ix_afiliado_membros_afiliado_id
  ON public.afiliado_membros (afiliado_id);

CREATE INDEX IF NOT EXISTS ix_afiliado_membros_afiliado_id_ativo
  ON public.afiliado_membros (afiliado_id, ativo);

CREATE UNIQUE INDEX IF NOT EXISTS ux_afiliado_membros_afiliado_nome_lower
  ON public.afiliado_membros (afiliado_id, lower(nome));

ALTER TABLE public.afiliado_membros ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super Admin manage affiliate members" ON public.afiliado_membros;
CREATE POLICY "Super Admin manage affiliate members"
  ON public.afiliado_membros
  FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.afiliado_membros TO authenticated;

DROP TRIGGER IF EXISTS trg_afiliado_membros_set_updated_at ON public.afiliado_membros;
CREATE TRIGGER trg_afiliado_membros_set_updated_at
  BEFORE UPDATE ON public.afiliado_membros
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMIT;
