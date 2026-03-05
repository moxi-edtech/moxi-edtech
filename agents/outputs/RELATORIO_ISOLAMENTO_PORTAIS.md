# Relatório — Isolamento de Portais (middleware + RLS)

Data: 2026-03-05

## 1) Middleware (Next.js)
- `apps/web/src/middleware.ts` protege prefixos `/admin`, `/secretaria`, `/financeiro`, `/professor`, `/aluno` com roles específicas.
- Fluxo é **deny-by-default**: sem `profile.role` → redirect `/login`; role fora da lista → redirect `/login`.
- `matcher` não inclui `/_next`, `favicon`, `assets` (ok para evitar bloqueio de assets).

**Observação:** o middleware valida `profiles.role` apenas; não valida tenant no edge (segurança deve ser RLS + backend).

## 2) Sessão / Client factories
- **Consolidado** em `apps/web/src/lib/supabaseServer.ts` (server) e `apps/web/src/lib/supabaseClient.ts` (browser).
- Wrappers `supabase/client.ts`, `supabase/server.ts`, `supabase/route-client.ts`, `utils/supabase/server.ts` agora redirecionam para o núcleo único.
- **Requisito 2.1 (singleton)** agora atendido.

**Não foi detectado** `escolaId` como fonte de verdade em `localStorage` (apenas caches de UI).

## 3) APIs (Route Handlers)

### 3.1 Staff portals (secretaria/financeiro/professor)
- A maioria dos endpoints usa `resolveEscolaIdForUser` + RPC `user_has_role_in_school`.
- `assertPortalAccess` foi aplicado em rotas críticas de secretaria (reset/liberar acesso aluno).

### 3.2 Aluno portal
- Rotas `/api/aluno/*` **não usam** `resolveEscolaIdForUser`; elas usam `getAlunoContext()`.
- `getAlunoContext()` deriva o contexto via `escola_users (papel = aluno)` + `alunos.profile_id`.
- Segurança depende de **RLS** nas tabelas consultadas (especialmente `notas`, `mensalidades`, `matriculas`, `avisos`).

### 3.3 Service role (uso controlado)
Arquivos com **SUPABASE_SERVICE_ROLE_KEY** / admin client:
- `apps/web/src/app/api/jobs/outbox/route.ts`
- `apps/web/src/app/api/jobs/auth-admin/route.ts`
- `apps/web/src/app/api/jobs/escolas/[id]/seed/academico/route.ts`
- `apps/web/src/app/api/jobs/financeiro/pagamentos/mcx-webhook/route.ts`
- `apps/web/src/lib/secretaria/sugestoes.ts`
- `apps/web/src/app/api/escolas/[id]/settings/use-mv/route.ts` (usa `@moxi/tenant-sdk`)

**Observação:** o webhook MCX valida `x-job-token`/`authorization` + HMAC (`x-mcx-signature`) quando `MCX_WEBHOOK_SECRET` existe.

## 4) RLS
- Migração `supabase/migrations/20260304000001_portal_rls_mensalidades_notas.sql` aplica RLS em `mensalidades` e `notas` com `current_tenant_escola_id()` + `user_has_role_in_school()` e `WITH CHECK`.
- Isso cobre o requisito crítico de isolamento para o portal do aluno.

## 5) Pontos de atenção (gaps a corrigir)
1) **Aluno portal depende 100% de RLS**; se alguma tabela acessada não tiver políticas fortes, existe risco de vazamento.
2) **Service role** deve permanecer restrito a jobs/webhooks; confirmar validação de assinatura/token em todos os endpoints listados.
3) **API coverage incompleta**: não foi feita varredura manual de 100% dos endpoints fora de `secretaria/financeiro/professor/aluno`.

## 6) Recomendações imediatas
1) Revisar políticas RLS de tabelas usadas por `/api/aluno/*` (rotinas, avisos, turmas, anos_letivos, etc.).
2) Criar guard padrão (`assertPortalAccess`) para **todas** as rotas staff, incluindo `/api/escola/*` e `/api/secretaria/balcao/*`.
