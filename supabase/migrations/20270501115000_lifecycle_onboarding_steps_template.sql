BEGIN;

ALTER TABLE public.super_admin_commercial_settings
  ALTER COLUMN lembrete_onboarding_template SET DEFAULT 'Olá {{centro_nome}}, vimos que o onboarding do seu centro ainda não foi concluído há {{dias_sem_onboarding}} dia(s). Progresso: {{progresso_onboarding}}. Etapas obrigatórias pendentes:
{{etapas_pendentes}}
Aceda: {{login_url}}';

UPDATE public.super_admin_commercial_settings
SET
  lembrete_onboarding_template = 'Olá {{centro_nome}}, vimos que o onboarding do seu centro ainda não foi concluído há {{dias_sem_onboarding}} dia(s). Progresso: {{progresso_onboarding}}. Etapas obrigatórias pendentes:
{{etapas_pendentes}}
Aceda: {{login_url}}',
  updated_at = now()
WHERE id = true
  AND (
    lembrete_onboarding_template IS NULL
    OR lembrete_onboarding_template = 'Olá {{centro_nome}}, vimos que o onboarding do seu centro ainda não foi concluído há {{dias_sem_onboarding}} dia(s). Concluir a configuração garante que a equipa consiga operar inscrições, turmas e recebimentos. Aceda: {{login_url}}'
  );

COMMIT;
