# Plano de Refatoração — Login do aluno (numero_processo)

## Objetivo
Consolidar o login oficial do aluno como `numero_processo` com sigla da escola, mantendo o e-mail apenas para comunicação e Auth técnico.

## Escopo
- Backend (Supabase functions/migrations)
- Fluxo de criação de aluno/matrícula e liberação de acesso
- UI/UX para exibir credenciais
- Migração de dados legados

## Estratégia de Identificador
- Prefixo derivado da sigla da escola (`get_escola_sigla`).
- Formato permanente: `SIGLA-NUMERO_PROCESSO` (sem ano).
- `profiles.numero_processo_login` é o login oficial do aluno.
- `profiles.email_auth` é técnico (`numero_processo_login@klasse.ao`).
- `profiles.email_real` guarda o e-mail pessoal para comunicação (opcional).

## Fluxo final (operacional)
1. **Matrícula confirmada**
   - Gera/garante `alunos.numero_processo`.
   - Calcula `profiles.numero_processo_login` via `build_numero_login`.
   - Gera `profiles.email_auth`.
   - **Não cria** conta no Auth neste momento.
   - Referência: `supabase/migrations/20260310000015_profile_login_refactor.sql` (`confirmar_matricula_core`).

2. **Libertar acesso ao portal**
   - Secretária aciona liberação (UI).
   - Sistema usa `numero_processo_login` existente.
   - Cria conta no Auth com `email_auth`.
   - Gera senha temporária.
   - UI mostra `numero_processo_login` + senha (nunca mostra `email_auth`).
   - Referências:
     - UI: `apps/web/src/components/secretaria/LiberarAcessoAlunos.tsx`
     - API: `apps/web/src/app/api/secretaria/alunos/liberar-acesso/route.ts`
     - Auth job: `apps/web/src/app/api/jobs/auth-admin/route.ts` (`activateStudentAccess`).

3. **Login no portal**
   - O aluno usa `numero_processo_login` na tela de login.
   - O backend resolve o identificador para `email_auth`.
   - Referências:
     - API de login: `apps/web/src/app/api/auth/login/route.ts`
     - Resolver: `apps/web/src/app/api/jobs/auth-admin/route.ts` (`resolveIdentifierToEmail`).

4. **Recuperação de senha**
   - Usar `email_real` como destino quando disponível.
   - Nunca expor ou enviar recuperação para `email_auth`.
   - Referência (templates/credenciais): `apps/web/src/lib/mailer.ts`.

## Etapas
1. **Atualizar build_numero_login**
   - Remover `p_ano_letivo` e gerar `SIGLA-NUMERO_PROCESSO`.

2. **Fluxo de matrícula**
   - `confirmar_matricula_core` preenche `numero_processo` se ausente.
   - Gera `numero_processo_login` e `email_auth` para o perfil do aluno.

3. **Liberação de acesso (Auth)**
   - Conta no Auth usa `email_auth` e senha temporária.
   - UI mostra apenas `numero_processo_login` + senha.

4. **Migração de dados legados**
   - Definir `email_real = email` quando ausente.
   - Backfill de `numero_processo_login`/`email_auth` para alunos com `numero_processo`.
   - Se `numero_processo` estiver nulo, gerar via `next_numero_processo`.

5. **UI/Comunicação**
   - Exibir `numero_processo_login` em listagens e credenciais.
   - Remover referências a `numero_login` no frontend.

## Backlog
- Revisar `generate_unique_numero_login` para possível desativação.

## Decisão de Produto
- **Login oficial do aluno = `numero_processo_login` (sigla + número de processo).**
- Email real é apenas canal de comunicação; nunca credencial de login.

## Entregáveis
- Migration com `numero_processo_login`, `email_real`, `email_auth` e `build_numero_login` atualizado.
- Ajustes no fluxo de matrícula e liberação de acesso.
- Backfill de perfis legados.
- Migration para remover `profiles.numero_login` após aprovação.
