BEGIN;

ALTER TABLE public.admin_activity_events
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'informativa',
  ADD COLUMN IF NOT EXISTS action_label text,
  ADD COLUMN IF NOT EXISTS action_url text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'admin_activity_events_priority_check'
      AND conrelid = 'public.admin_activity_events'::regclass
  ) THEN
    ALTER TABLE public.admin_activity_events
      ADD CONSTRAINT admin_activity_events_priority_check
      CHECK (priority IN ('urgente', 'importante', 'informativa'));
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.set_admin_activity_event_metadata()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_critical boolean := coalesce(NEW.payload->>'critical', '') = 'true';
BEGIN
  NEW.priority := CASE
    WHEN v_critical OR NEW.event_type IN ('ESTORNO_REGISTRADO', 'ESTORNO_APROVADO', 'ESTORNO_REJEITADO') THEN 'urgente'
    WHEN NEW.event_family IN ('financeiro', 'academico', 'secretaria') THEN 'importante'
    ELSE 'informativa'
  END;

  IF NEW.action_label IS NULL OR NEW.action_url IS NULL THEN
    CASE NEW.event_type
      WHEN 'NOTA_LANCADA_BATCH' THEN
        NEW.action_label := coalesce(NEW.action_label, 'Ver pauta');
        NEW.action_url := coalesce(NEW.action_url, '/admin/notas?turma_id=' || (NEW.payload->>'turma_id'));
      WHEN 'PAUTA_FECHADA' THEN
        NEW.action_label := coalesce(NEW.action_label, 'Ver pauta fechada');
        NEW.action_url := coalesce(NEW.action_url, '/admin/notas?turma_id=' || (NEW.payload->>'turma_id'));
      WHEN 'PAGAMENTO_REGISTRADO', 'PAGAMENTO_CONCILIADO' THEN
        NEW.action_label := coalesce(NEW.action_label, 'Abrir financeiro');
        NEW.action_url := coalesce(NEW.action_url, '/financeiro');
      WHEN 'ADMISSAO_CONVERTIDA_MATRICULA' THEN
        NEW.action_label := coalesce(NEW.action_label, 'Abrir admissões');
        NEW.action_url := coalesce(NEW.action_url, '/secretaria/admissoes');
      ELSE NULL;
    END CASE;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_admin_activity_event_metadata ON public.admin_activity_events;
CREATE TRIGGER trg_set_admin_activity_event_metadata
BEFORE INSERT ON public.admin_activity_events
FOR EACH ROW
EXECUTE FUNCTION public.set_admin_activity_event_metadata();

UPDATE public.admin_activity_events
SET priority = CASE
      WHEN coalesce(payload->>'critical', '') = 'true'
        OR event_type IN ('ESTORNO_REGISTRADO', 'ESTORNO_APROVADO', 'ESTORNO_REJEITADO') THEN 'urgente'
      WHEN event_family IN ('financeiro', 'academico', 'secretaria') THEN 'importante'
      ELSE 'informativa'
    END,
    action_label = CASE
      WHEN event_type IN ('NOTA_LANCADA_BATCH', 'PAUTA_FECHADA') THEN CASE WHEN event_type = 'PAUTA_FECHADA' THEN 'Ver pauta fechada' ELSE 'Ver pauta' END
      WHEN event_type IN ('PAGAMENTO_REGISTRADO', 'PAGAMENTO_CONCILIADO') THEN 'Abrir financeiro'
      WHEN event_type = 'ADMISSAO_CONVERTIDA_MATRICULA' THEN 'Abrir admissões'
      ELSE action_label
    END,
    action_url = CASE
      WHEN event_type IN ('NOTA_LANCADA_BATCH', 'PAUTA_FECHADA') AND payload->>'turma_id' IS NOT NULL THEN '/admin/notas?turma_id=' || (payload->>'turma_id')
      WHEN event_type IN ('PAGAMENTO_REGISTRADO', 'PAGAMENTO_CONCILIADO') THEN '/financeiro'
      WHEN event_type = 'ADMISSAO_CONVERTIDA_MATRICULA' THEN '/secretaria/admissoes'
      ELSE action_url
    END;

CREATE TABLE IF NOT EXISTS public.admin_activity_event_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.admin_activity_events(id) ON DELETE CASCADE,
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'novo',
  seen_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_activity_event_receipts_status_check
    CHECK (status IN ('novo', 'visto', 'em_tratamento', 'resolvido')),
  CONSTRAINT admin_activity_event_receipts_unique_user_event
    UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_admin_activity_event_receipts_user_status
  ON public.admin_activity_event_receipts (escola_id, user_id, status, updated_at DESC);

ALTER TABLE public.admin_activity_event_receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_activity_event_receipts_select_policy
  ON public.admin_activity_event_receipts;
CREATE POLICY admin_activity_event_receipts_select_policy
  ON public.admin_activity_event_receipts FOR SELECT
  USING (user_id = auth.uid() AND public.is_escola_member(escola_id));

DROP POLICY IF EXISTS admin_activity_event_receipts_insert_policy
  ON public.admin_activity_event_receipts;
CREATE POLICY admin_activity_event_receipts_insert_policy
  ON public.admin_activity_event_receipts FOR INSERT
  WITH CHECK (user_id = auth.uid() AND public.is_escola_member(escola_id));

DROP POLICY IF EXISTS admin_activity_event_receipts_update_policy
  ON public.admin_activity_event_receipts;
CREATE POLICY admin_activity_event_receipts_update_policy
  ON public.admin_activity_event_receipts FOR UPDATE
  USING (user_id = auth.uid() AND public.is_escola_member(escola_id))
  WITH CHECK (user_id = auth.uid() AND public.is_escola_member(escola_id));

-- The admin and admin_financeiro feeds subscribe to INSERTs on this append-only
-- table. Without publication membership, the HTTP bootstrap works but live
-- updates never reach the browser and the UI silently waits for polling.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'admin_activity_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_activity_events;
  END IF;
END
$$;

COMMIT;
