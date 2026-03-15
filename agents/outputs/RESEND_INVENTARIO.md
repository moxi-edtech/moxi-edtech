# Inventário Resend — Moxi EdTech
run_timestamp: 2026-03-01T00:00:00Z

## Já existente (usa `sendMail` / Resend)
- `apps/web/src/app/api/escolas/create/route.ts` — envio de onboarding na criação da escola.
- `apps/web/src/app/api/super-admin/escolas/[id]/resend-invite/route.ts` — reenviar convite do admin da escola.
- `apps/web/src/app/api/escolas/[id]/onboarding/core/finalize/route.ts` — envio de credenciais a convidados do onboarding.
- `apps/web/src/app/api/escolas/[id]/alunos/invite/route.ts` — envio de credenciais quando número de processo existe.
- `apps/web/src/app/api/super-admin/escolas/[id]/billing-email/route.ts` — cobrança manual.
- `apps/web/src/app/api/cron/billing/check-renewals/route.ts` — lembretes de renovação.
- `apps/web/src/app/api/super-admin/billing/assinaturas/[id]/route.ts` — reenviar instruções de pagamento.

## Já existente (email via Supabase, não Resend)
- `apps/web/src/app/api/super-admin/users/reset-password/route.ts` — `resetPasswordForEmail` (depende do SMTP do Supabase).

## Já existente (sem email, senha exibida na UI)
- `apps/web/src/app/api/escolas/[id]/professores/[profileId]/reset-password/route.ts` — gera senha temporária e retorna para UI.
- `apps/web/src/app/api/secretaria/alunos/[id]/reset-senha` (referenciado na UI) — retorna login/senha na UI.

## UI pronta para disparar
- `apps/web/src/app/super-admin/escolas/nova/page.tsx` — cria escola e dispara onboarding.
- `apps/web/src/app/escola/[id]/(portal)/professores/page.tsx` — reenviar convite e reset de senha.
- `apps/web/src/components/super-admin/UsuariosListClient.tsx` — reset de senha (Supabase email).
- `apps/web/src/components/aluno/DossierAcoes.tsx` — reset de senha de aluno (senha exibida).

## Backlog (rotas candidatas a usar Resend)
- Reset de senha Super Admin: já envia via Resend com fallback Supabase (ajustar UI para exibir status do envio se necessário).
- Reset de senha Professores/Alunos: agora envia e-mail com credenciais mantendo senha na UI.
- Notificações de convite para perfis administrativos além de professores (se existir rota de invite admin).

## Sugestões de rotas para plugar Resend
- `POST /api/escolas/[id]/usuarios/resend` → garantir uso de `sendMail` com template de onboarding/convite.
- `POST /api/escolas/[id]/professores/[profileId]/reset-password` → enviar `buildCredentialsEmail` ao professor.
- `POST /api/secretaria/alunos/[id]/reset-senha` → enviar `buildCredentialsEmail` ao aluno.
- `POST /api/super-admin/users/reset-password` → migrar para Resend com link seguro (token + expiração).

## Dependências
- `apps/web/src/lib/mailer.ts` (Resend client + templates).
- Variáveis de ambiente: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`.
