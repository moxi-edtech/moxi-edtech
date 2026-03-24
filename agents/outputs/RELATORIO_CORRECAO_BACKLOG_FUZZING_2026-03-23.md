# Relatório de Correção e Backlog — Fuzzing / DoS Hardening

run_timestamp: 2026-03-23T23:59:00-03:00
contexto: Avaliação de robustez contra entradas malformadas, payloads abusivos e alta volumetria em APIs web.

## Progresso de implementação (2026-03-23)
- `BL-FZ-002` / `FIX-002`: **CONCLUÍDO**
  - aplicado limite explícito de 12MB no upload de conciliação com retorno `413` antes de `arrayBuffer()`.
  - ficheiro: `apps/web/src/app/api/financeiro/conciliacao/upload/route.ts`
- `BL-FZ-003` / `FIX-003`: **EM ANDAMENTO**
  - criado helper central de guardrail JSON por tamanho de payload (`Content-Length` + tamanho real).
  - adoção inicial aplicada em `POST /api/auth/login` e `POST /api/audit`.
  - ficheiros:
    - `apps/web/src/lib/http/readJsonWithLimit.ts`
    - `apps/web/src/app/api/auth/login/route.ts`
    - `apps/web/src/app/api/audit/route.ts`
    - `apps/web/src/app/api/super-admin/users/create/route.ts`
    - `apps/web/src/app/api/super-admin/users/update/route.ts`
    - `apps/web/src/app/api/super-admin/users/delete/route.ts`
    - `apps/web/src/app/api/super-admin/users/reset-password/route.ts`
    - `apps/web/src/app/api/secretaria/rematricula/route.ts`
- `HARDENING-TYPE-001`: **CONCLUÍDO (escopo atual)**
  - remoção de `any` nas rotas críticas acima com tipagem explícita + validação de payload por `zod`.
  - verificação de regressão:
    - `pnpm -C apps/web exec tsc --noEmit --pretty false` ✅
    - `rg -n "\\bany\\b" [rotas críticas]` sem ocorrências ✅
- `FIX-004`: **PARCIALMENTE CONCLUÍDO**
  - cobertura de rate limit expandida para APIs operacionais:
    - `/api/financeiro/:path*`
    - `/api/secretaria/:path*`
    - `/api/professor/:path*`
    - `/api/aluno/:path*`
  - observação: a implementação ainda é em memória no Edge; falta etapa distribuída do `BL-FZ-001`.
  - ficheiro: `apps/web/src/middleware.ts`
- `BL-FZ-001` / `FIX-001`: **PARCIALMENTE CONCLUÍDO**
  - middleware atualizado para usar rate limit distribuído via Upstash REST quando configurado:
    - `UPSTASH_REDIS_REST_URL`
    - `UPSTASH_REDIS_REST_TOKEN`
  - fallback automático para memória local quando as variáveis não estiverem configuradas ou houver falha no Redis.
  - ficheiro: `apps/web/src/middleware.ts`
- `BL-FZ-005`: **CONCLUÍDO (escopo middleware)**
  - adicionados security headers baseline em respostas do middleware:
    - `X-Content-Type-Options: nosniff`
    - `X-Frame-Options: SAMEORIGIN`
    - `Referrer-Policy: strict-origin-when-cross-origin`
    - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
    - `X-DNS-Prefetch-Control: off`
    - `Strict-Transport-Security` (quando HTTPS)
  - política CORS por ambiente para APIs:
    - origens permitidas via `CORS_ALLOWED_ORIGINS` (CSV)
    - mesma origem (`request.nextUrl.origin`) sempre permitida
    - preflight `OPTIONS` com `204` para origem permitida
    - origem não permitida retorna `403`
  - ficheiro: `apps/web/src/middleware.ts`
- `BL-FZ-006`: **PARCIALMENTE CONCLUÍDO**
  - suíte inicial de fuzz/property tests adicionada:
    - `apps/web/tests/unit/fuzz-migracao-utils.spec.ts`
    - `apps/web/tests/unit/fuzz-read-json-with-limit.spec.ts`
    - `apps/web/tests/unit/fuzz-auth-login.spec.ts`
  - extração de lógica de hardening auth para módulo testável:
    - `apps/web/src/lib/auth/loginHardening.ts`
    - `apps/web/src/app/api/auth/login/route.ts` atualizado para usar helper
  - script dedicado:
    - `apps/web/package.json` → `test:unit:fuzz`
  - execução local:
    - `pnpm -C apps/web run test:unit:fuzz` ✅ (9/9)
- Validação técnica:
  - `pnpm -C apps/web exec tsc --noEmit --pretty false` ✅

## Diagnóstico resumido
- Existe proteção parcial com validação de input (Zod em várias rotas) e cache no-store/force-dynamic em áreas sensíveis.
- Existe rate limiting no middleware, mas com estado em memória do Edge (não distribuído, sujeito a reset por instância).
- Há limites de tamanho em alguns uploads (ex.: 5MB e 12MB), porém ainda há endpoint de upload sem limite explícito.
- Não foi encontrada suíte dedicada de fuzz tests/property-based no repositório.

## Evidências principais
- Rate limit em memória e comentário de limitação operacional:
  - `apps/web/src/middleware.ts:8-11`
  - `apps/web/src/middleware.ts:21-35`
  - `apps/web/src/middleware.ts:188-209`
- Upload financeiro sem limite explícito de tamanho antes de `arrayBuffer()`:
  - `apps/web/src/app/api/financeiro/conciliacao/upload/route.ts:41`
- Uploads com limite já aplicados (baseline positivo):
  - `apps/web/src/app/api/aluno/financeiro/comprovativo/route.ts:23-25` (5MB)
  - `apps/web/src/app/api/migracao/upload/route.ts:33-36` (MAX_UPLOAD_SIZE)
  - `apps/web/src/app/api/migracao/utils.ts:6` (12MB)
- Rotas que parseiam JSON sem schema explícito em parte do código (superfície para hardening incremental):
  - Exemplos: `apps/web/src/app/api/audit/route.ts`, `apps/web/src/app/api/super-admin/users/create/route.ts`, `apps/web/src/app/api/secretaria/rematricula/route.ts`

## Correções imediatas (curto prazo)

### FIX-001 — Rate limiting distribuído
- **problema:** rate limit em `Map` local não sustenta múltiplas instâncias.
- **ação:** substituir por store distribuído (Redis/Upstash) com janela deslizante por IP + route key + tenant.
- **impacto esperado:** redução de bypass por horizontal scaling.
- **prioridade:** P0
- **bloqueante:** true

### FIX-002 — Limite explícito no upload de conciliação
- **problema:** upload de extrato financeiro processa `arrayBuffer()` sem tamanho máximo explícito.
- **ação:** validar `file.size` antes de leitura do buffer e rejeitar com `413` acima do limite definido (ex.: 12MB).
- **impacto esperado:** mitigação de DoS por payload grande.
- **prioridade:** P0
- **bloqueante:** true

### FIX-003 — Guardrail global de payload JSON
- **problema:** ausência de política uniforme para payload size em rotas `POST/PUT/PATCH` JSON.
- **ação:** criar helper comum para validar `Content-Length`/tamanho efetivo e aplicar por middleware/handler wrapper.
- **impacto esperado:** padronização de defesa contra corpos excessivos.
- **prioridade:** P0
- **bloqueante:** true

### FIX-004 — Cobertura de rate limit por criticidade
- **problema:** somente subset de rotas está sob limitação explícita.
- **ação:** ampliar políticas por classe de endpoint:
  - auth/publico: estrito
  - financeiro/secretaria operacional: estrito
  - leitura interna autenticada: moderado
- **impacto esperado:** redução de abuso por endpoints não protegidos.
- **prioridade:** P1
- **bloqueante:** false

## Backlog priorizado

## Prioridade P0 (bloqueante)

### BL-FZ-001 — Implantar rate limiter distribuído
- **escopo:** `middleware.ts` + provider Redis/Upstash + config por ambiente.
- **aceite:** mesmas regras em todas instâncias; retorno `429` consistente; métrica de bloqueios disponível.
- **owner sugerido:** backend plataforma
- **esforço estimado:** M
- **status:** PARCIAL (suporte a Upstash REST implementado; falta rollout/validação em ambiente com envs)

### BL-FZ-002 — Aplicar limite de upload em conciliação financeira
- **escopo:** `apps/web/src/app/api/financeiro/conciliacao/upload/route.ts`.
- **aceite:** arquivo > limite retorna `413` sem processar buffer/parsing.
- **owner sugerido:** squad financeiro
- **esforço estimado:** S
- **status:** CONCLUÍDO em 2026-03-23

### BL-FZ-003 — Política central de tamanho de payload JSON
- **escopo:** helper utilitário + adoção inicial nas rotas críticas.
- **aceite:** requests acima do limite retornam `413` com erro padronizado.
- **owner sugerido:** backend plataforma
- **esforço estimado:** M
- **status:** EM ANDAMENTO (helper + 2 rotas iniciais concluídas em 2026-03-23)

## Prioridade P1 (alto impacto)

### BL-FZ-004 — Hardening de validação em rotas sem schema explícito
- **escopo:** iniciar por `audit`, `super-admin/users/*`, `secretaria/rematricula`.
- **aceite:** payloads inválidos retornam `400` via schema formal.
- **owner sugerido:** squads domínio + plataforma
- **esforço estimado:** M
- **status:** PARCIAL (guardrail de payload aplicado em `super-admin/users/*` e `secretaria/rematricula` em 2026-03-23)

### BL-FZ-005 — Headers de segurança e política CORS por domínio
- **escopo:** revisar middleware para baseline de headers e origins permitidos por ambiente.
- **aceite:** política documentada e testes de integração para bloqueio de origem indevida.
- **owner sugerido:** plataforma/security
- **esforço estimado:** M
- **status:** CONCLUÍDO (fase middleware, 2026-03-24)

## Prioridade P2 (resiliência contínua)

### BL-FZ-006 — Suite de fuzz/property-based tests
- **escopo:** adicionar testes automatizados para parsers CSV/XLSX, auth payloads e endpoints críticos.
- **aceite:** pipeline com casos randômicos reprodutíveis (seed fixa) e thresholds de falha.
- **owner sugerido:** QA + backend
- **esforço estimado:** M/L
- **status:** PARCIAL (fase 1.1 entregue em 2026-03-24: parsers de migração + guardrail JSON + auth login hardening)

### BL-FZ-007 — Telemetria e alertas de abuso
- **escopo:** métricas de `429`, payload rejeitado, latência p95/p99 por endpoint.
- **aceite:** dashboard e alertas ativos (anomalia volumétrica).
- **owner sugerido:** SRE/plataforma
- **esforço estimado:** M

## Ordem recomendada de execução
1. BL-FZ-002
2. BL-FZ-001
3. BL-FZ-003
4. BL-FZ-004
5. BL-FZ-007
6. BL-FZ-006
7. BL-FZ-005

## Resultado
- **status geral:** BACKLOG ABERTO
- **risco atual:** MÉDIO/ALTO (proteções existentes, porém com gaps estruturais em rate limit distribuído e limite uniforme de payload)
- **próxima ação sugerida:** abrir issues P0 com SLA de implementação e validar em ambiente staging com teste de carga/fuzz controlado.
