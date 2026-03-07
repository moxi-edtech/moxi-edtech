BEGIN;

ALTER TABLE public.app_plan_limits
  ADD COLUMN IF NOT EXISTS fin_recibo_pdf boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sec_upload_docs boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sec_matricula_online boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS doc_qr_code boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS app_whatsapp_auto boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS suporte_prioritario boolean NOT NULL DEFAULT false;

UPDATE public.app_plan_limits
SET
  fin_recibo_pdf = true,
  sec_upload_docs = false,
  sec_matricula_online = false,
  doc_qr_code = false,
  app_whatsapp_auto = false,
  suporte_prioritario = false
WHERE plan = 'essencial';

UPDATE public.app_plan_limits
SET
  fin_recibo_pdf = true,
  sec_upload_docs = true,
  sec_matricula_online = false,
  doc_qr_code = false,
  app_whatsapp_auto = false,
  suporte_prioritario = false
WHERE plan = 'profissional';

UPDATE public.app_plan_limits
SET
  fin_recibo_pdf = true,
  sec_upload_docs = true,
  sec_matricula_online = true,
  doc_qr_code = true,
  app_whatsapp_auto = true,
  suporte_prioritario = true
WHERE plan = 'premium';

COMMIT;
