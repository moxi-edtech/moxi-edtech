# REPORT_IMPLEMENTATION_SESSION

## Resumo
- Pauta em grade (professor) com autosave, validação instantânea e navegação por teclado.
- Command Palette action-first com intenções para pagamento/nota.
- Promoção/rematrícula em massa com filtros, prévia e seleção em lote.
- Global Search multi‑portal com RPC unificada e views por entidade.
- Central de documentos da turma com Pauta em Branco e Mini‑Pautas.

## Principais arquivos
- `apps/web/src/app/professor/notas/page.tsx`
- `apps/web/src/components/CommandPalette.tsx`
- `apps/web/src/app/secretaria/(portal-secretaria)/rematricula/page.tsx`
- `apps/web/src/hooks/useGlobalSearch.ts`
- `apps/web/src/components/secretaria/TurmaDetailClient.tsx`

## Migrations novas
- `20261103000000_vw_boletim_consolidado.sql`
- `20261103000001_fix_financeiro_trigger.sql`
- `20261104000000_global_search_entities.sql`
- `20261104000001_global_search_financeiro.sql`
- `20261104000002_global_search_admin.sql`

## Hardening API (2026-03-23)
- Limite de upload aplicado em `apps/web/src/app/api/financeiro/conciliacao/upload/route.ts` (12MB, retorno `413`).
- Guardrail JSON por tamanho criado em `apps/web/src/lib/http/readJsonWithLimit.ts`.
- Adoção inicial do guardrail em:
  - `apps/web/src/app/api/auth/login/route.ts`
  - `apps/web/src/app/api/audit/route.ts`
- Expansão do guardrail JSON para rotas críticas:
  - `apps/web/src/app/api/super-admin/users/create/route.ts`
  - `apps/web/src/app/api/super-admin/users/update/route.ts`
  - `apps/web/src/app/api/super-admin/users/delete/route.ts`
  - `apps/web/src/app/api/super-admin/users/reset-password/route.ts`
  - `apps/web/src/app/api/secretaria/rematricula/route.ts`
- Remoção de `any` nas rotas críticas acima com tipagem explícita (`Database`, `SupabaseClient<Database>`, schemas `zod` e tipos de payload/resultados).
- Cobertura de rate limit ampliada no middleware para APIs operacionais:
  - `/api/financeiro/:path*`
  - `/api/secretaria/:path*`
  - `/api/professor/:path*`
  - `/api/aluno/:path*`
- Rate limit distribuído opcional adicionado no middleware:
  - usa Upstash REST quando `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN` estão configurados
  - fallback para memória local em caso de ausência/falha de Redis
- Security headers e CORS por ambiente no middleware:
  - headers baseline aplicados a todas as respostas do middleware
  - preflight `OPTIONS` para APIs
  - bloqueio `403` para origem não permitida em APIs
  - allowlist via `CORS_ALLOWED_ORIGINS` (CSV)
- Fuzz/property tests (fase inicial):
  - `apps/web/tests/unit/fuzz-migracao-utils.spec.ts`
  - `apps/web/tests/unit/fuzz-read-json-with-limit.spec.ts`
  - `apps/web/tests/unit/fuzz-auth-login.spec.ts`
  - helper auth extraído para teste: `apps/web/src/lib/auth/loginHardening.ts`
  - script: `pnpm -C apps/web run test:unit:fuzz`
  - resultado atual: 9 testes passados
- Verificação de compilação: `pnpm -C apps/web exec tsc --noEmit --pretty false` (OK).
