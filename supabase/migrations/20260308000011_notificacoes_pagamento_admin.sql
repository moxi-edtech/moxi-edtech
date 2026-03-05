BEGIN;

CREATE TABLE IF NOT EXISTS public.notificacoes_pagamento_admin (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  pagamento_id uuid NULL REFERENCES public.pagamentos(id) ON DELETE SET NULL,
  titulo text NOT NULL,
  descricao text NULL,
  status text NOT NULL DEFAULT 'pendente',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notificacoes_pagamento_admin_escola
  ON public.notificacoes_pagamento_admin (escola_id, status);

ALTER TABLE public.notificacoes_pagamento_admin ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notificacoes_pagamento_admin_tenant ON public.notificacoes_pagamento_admin;
CREATE POLICY notificacoes_pagamento_admin_tenant ON public.notificacoes_pagamento_admin
  USING (
    escola_id = current_tenant_escola_id()
    AND public.user_has_role_in_school(
      escola_id,
      ARRAY['admin_escola','secretaria','financeiro','secretaria_financeiro','admin_financeiro','admin','staff_admin']
    )
  )
  WITH CHECK (
    escola_id = current_tenant_escola_id()
    AND public.user_has_role_in_school(
      escola_id,
      ARRAY['admin_escola','secretaria','financeiro','secretaria_financeiro','admin_financeiro','admin','staff_admin']
    )
  );

COMMIT;
