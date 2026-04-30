BEGIN;

CREATE TABLE IF NOT EXISTS public.formacao_salas_infraestrutura (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  tipo text NOT NULL DEFAULT 'sala' CHECK (tipo IN ('sala', 'laboratorio', 'auditorio', 'online')),
  capacidade integer NOT NULL CHECK (capacidade > 0),
  localizacao text,
  recursos jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa', 'manutencao', 'inativa')),
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT formacao_salas_infraestrutura_nome_unique UNIQUE (escola_id, nome),
  CONSTRAINT formacao_salas_infraestrutura_recursos_array_chk CHECK (jsonb_typeof(recursos) = 'array')
);

CREATE INDEX IF NOT EXISTS idx_formacao_salas_infraestrutura_escola_status
  ON public.formacao_salas_infraestrutura (escola_id, status);

CREATE INDEX IF NOT EXISTS idx_formacao_salas_infraestrutura_escola_tipo
  ON public.formacao_salas_infraestrutura (escola_id, tipo);

ALTER TABLE public.formacao_salas_infraestrutura ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS formacao_salas_infraestrutura_select
  ON public.formacao_salas_infraestrutura;

CREATE POLICY formacao_salas_infraestrutura_select
ON public.formacao_salas_infraestrutura
FOR SELECT
TO authenticated
USING (
  public.user_has_role_in_school(
    escola_id,
    ARRAY[
      'formacao_admin',
      'formacao_secretaria',
      'formacao_financeiro',
      'formador',
      'super_admin',
      'global_admin'
    ]::text[]
  )
);

DROP POLICY IF EXISTS formacao_salas_infraestrutura_insert
  ON public.formacao_salas_infraestrutura;

CREATE POLICY formacao_salas_infraestrutura_insert
ON public.formacao_salas_infraestrutura
FOR INSERT
TO authenticated
WITH CHECK (
  public.user_has_role_in_school(
    escola_id,
    ARRAY['formacao_admin', 'formacao_secretaria', 'super_admin', 'global_admin']::text[]
  )
);

DROP POLICY IF EXISTS formacao_salas_infraestrutura_update
  ON public.formacao_salas_infraestrutura;

CREATE POLICY formacao_salas_infraestrutura_update
ON public.formacao_salas_infraestrutura
FOR UPDATE
TO authenticated
USING (
  public.user_has_role_in_school(
    escola_id,
    ARRAY['formacao_admin', 'formacao_secretaria', 'super_admin', 'global_admin']::text[]
  )
)
WITH CHECK (
  public.user_has_role_in_school(
    escola_id,
    ARRAY['formacao_admin', 'formacao_secretaria', 'super_admin', 'global_admin']::text[]
  )
);

DROP POLICY IF EXISTS formacao_salas_infraestrutura_delete
  ON public.formacao_salas_infraestrutura;

CREATE POLICY formacao_salas_infraestrutura_delete
ON public.formacao_salas_infraestrutura
FOR DELETE
TO authenticated
USING (
  public.user_has_role_in_school(
    escola_id,
    ARRAY['formacao_admin', 'super_admin', 'global_admin']::text[]
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.formacao_salas_infraestrutura TO authenticated;

COMMIT;
