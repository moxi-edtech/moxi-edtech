BEGIN;

ALTER TABLE public.super_admin_commercial_settings
  ADD COLUMN IF NOT EXISTS lembrete_onboarding_template text NOT NULL DEFAULT 'Olá {{centro_nome}}, vimos que o onboarding do seu centro ainda não foi concluído há {{dias_sem_onboarding}} dia(s). Concluir a configuração garante que a equipa consiga operar inscrições, turmas e recebimentos. Aceda: {{login_url}}',
  ADD COLUMN IF NOT EXISTS lembrete_inatividade_template text NOT NULL DEFAULT 'Olá {{centro_nome}}, notámos que o centro está há {{dias_sem_acesso}} dia(s) sem acesso operacional. Entre na plataforma para acompanhar inscrições, cobranças e configurações pendentes. Aceda: {{login_url}}';

COMMENT ON COLUMN public.super_admin_commercial_settings.lembrete_onboarding_template
  IS 'Template usado pelo job de lifecycle para centros que não concluíram onboarding.';

COMMENT ON COLUMN public.super_admin_commercial_settings.lembrete_inatividade_template
  IS 'Template usado pelo job de lifecycle para centros sem acesso recente.';

COMMIT;
