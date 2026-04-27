# Plano de Implementação — Ticket Talent Pool (Registo Aberto + Bloqueio de Ação)

## Estado Atual (2026-04-26)
- Concluído: base SQL core do Talent Pool, verificação de empresas, fast-track por domínio, bloqueio RLS de `INSERT` em `talent_pool_matches`, APIs do aluno (perfil + matches), UI carreira aluno, handshake (evento + notificação), APIs B2B de status/candidatos/matches e teaser no dashboard admin com modal de bloqueio.
- Concluído: arquitetura híbrida "Jardim Murado" com rota pública de parceiro (`/parceiro/[slug]`), escopo local com filtro duro por `escola_id`, upsell para rede global e white-label por `cor_primaria` da escola.
- Concluído: onboarding B2B na porta `/parceiro/[slug]` com formulário de aquisição (nome empresa, NIF, recrutador, email), autenticação OTP em 2 passos e upsert seguro para `empresas_parceiras`.
- Concluído: fast-track automático ativo no backend (trigger em `empresas_parceiras` avalia domínio e define `is_verified` por whitelist/domínios públicos).
- Concluído: hardening de conversão/UX na porta parceira com CTA real por talento ("Solicitar Entrevista") e bloqueio da aba Rede Global por gatilho de esgotamento local.
- Concluído: suíte dedicada de integração/matriz E2E da camada Talent Pool (onboarding OTP, gate Rede Global e contratos de API para `empresa-status`/`candidates`/`matches`).
- Concluído: operação de aprovação manual definida para exceções fora da whitelist (Supabase Studio em `empresas_parceiras` com toggle de `is_verified=true`).
- Pendente: execução dos testes SQL/RLS em Postgres local (infra indisponível), E2E integrado ponta-a-ponta em ambiente com Auth real e rollout com feature flag.

## Artefactos implementados
- `supabase/migrations/20270426130000_talent_pool_core_infra.sql`
- `supabase/migrations/20270426142000_talent_pool_empresa_verification_gate.sql`
- `supabase/migrations/20270426150000_talent_pool_handshake_view.sql`
- `supabase/migrations/20270426162000_talent_pool_partner_public_rpc.sql`
- `supabase/migrations/20270426174000_talent_pool_empresas_parceiras_profile_fields.sql`
- `apps/formacao/app/api/formacao/talent-pool/profile/route.ts`
- `apps/formacao/app/api/formacao/talent-pool/matches/route.ts`
- `apps/formacao/app/api/formacao/talent-pool/empresa-status/route.ts`
- `apps/formacao/app/api/formacao/talent-pool/candidates/route.ts`
- `apps/formacao/app/api/formacao/publico/talent-pool/route.ts`
- `apps/formacao/app/api/formacao/publico/talent-pool/empresa-profile/route.ts`
- `apps/formacao/app/(portal)/aluno/carreira/page.tsx`
- `apps/formacao/components/aluno/CarreiraHubClient.tsx`
- `apps/formacao/components/aluno/TalentOptInPrompt.tsx`
- `apps/formacao/app/(portal)/aluno/dashboard/page.tsx`
- `apps/formacao/app/(portal)/admin/dashboard/_components/TalentPoolTeaser.tsx`
- `apps/formacao/app/(portal)/admin/dashboard/page.tsx`
- `apps/formacao/app/(portal)/layout.tsx`
- `apps/formacao/app/parceiro/[slug]/page.tsx`
- `apps/formacao/app/parceiro/[slug]/PartnerTalentPoolClient.tsx`
- `apps/formacao/app/parceiro/[slug]/_components/B2BJoinForm.tsx`
- `apps/formacao/lib/talent-pool/onboarding.ts`
- `apps/formacao/tests/integration/talent-pool-onboarding.spec.ts`
- `apps/formacao/tests/integration/talent-pool-api-routes.spec.ts`
- `apps/formacao/tests/e2e/talent-pool-onboarding-matrix.e2e.spec.ts`
- `supabase/ops/tests/regression_talent_pool_matches_rls.sql`
- `scripts/test-talent-pool-rls.sh`

## 1. Alinhar escopo e contratos
- [x] Confirmar SSOT de tabela de aluno (`public.alunos`) e de empresa (`public.empresas_parceiras`).
- [x] Fechar payload da Landing: `nif`, `nome`, `email`.
- [x] Definir regra final de fast-track: domínio corporativo verificado ativa `is_verified=true`; domínios públicos sempre `false`.

## 2. Banco de dados e segurança (migrações)
- [x] Criar/ajustar `public.empresas_parceiras` com `id`, `nif`, `dominio_email`, `is_verified`, timestamps.
- [x] Criar `public.empresas_parceiras_dominios_verificados` para whitelist operacional.
- [x] Aplicar RLS em `empresas_parceiras` (self + super-admin) e bloquear acesso indevido.
- [x] Endurecer `INSERT` em `public.talent_pool_matches` exigindo `is_verified=true`.
- [x] Garantir funções auxiliares: normalização de domínio, deteção de domínios públicos, resolução de auto-verificação.
- [x] Alterar `public.alunos` adicionando `is_open_to_work`, `career_headline`, `anonymous_slug`, `grau_academico`, `provincia`, `municipio`, `preferencia_trabalho`.
- [x] Incluir patch idempotente para `public.perfis_formandos` (quando existir).
- [x] Criar camada de anonimato (`vw_talentos_publicos`) sem exposição de PII.
- [x] Criar trigger de handshake para notificação ao aluno em novo `match` pendente.

## 3. Onboarding e automação
- [x] Trigger/função para preencher `dominio_email` e recalcular `is_verified`.
- [x] Implementar fluxo de quarentena no backend (conta criada, ação crítica bloqueada por RLS).
- [x] Garantir `ensure_empresa_parceira_profile` em primeiro acesso do portal administrativo.
- [x] Integrar o fluxo de criação/atualização do perfil empresa diretamente na landing/onboarding B2B de aquisição.

## 4. Backend de produto (API)
- [x] Endpoint para leitura de estado de verificação (`is_verified`) para UI B2B.
- [x] Endpoint/ação de “solicitar entrevista” com tratamento de bloqueio por não verificado.
- [x] Endpoint de listagem de candidatos anónimos para teaser B2B.
- [x] Trigger de notificação assíncrona ao criar `talent_pool_matches` (evento + inbox interna do aluno).
- [x] Endpoint para aluno atualizar `talent_pool_matches` para `accepted/rejected`.
- [x] Endpoint explícito para update cadastral B2B (NIF e metadados comerciais) com validações de negócio.

## 5. Frontend (Landing + dashboard)
- [x] Dashboard teaser B2B com busca/filtro e listagem anónima.
- [x] Porta B2B pública `/parceiro/[slug]` com white-label parcial e cabeçalho contextual por escola.
- [x] Filtro duro por escola no escopo local (tenant-bound) e troca explícita para escopo global sob ação do RH.
- [x] Upsell "Pesquisar na Rede Global" quando a rede local não cobre a pesquisa.
- [x] Acesso à Rede Global bloqueado por padrão e libertado apenas via gatilho de esgotamento local (preserva lógica comercial de upsell).
- [x] CTA de card de talento ligado a ação de conversão real ("Solicitar Entrevista"), evitando botão inerte.
- [x] Botão “Solicitar Entrevista” com modal de bloqueio para conta não verificada (2–4h).
- [x] Ecrã/modal de celebração (opt-in) ao aluno elegível (>16).
- [x] Dashboard do aluno (Aba Carreira) com pedidos pendentes e ações “Aceitar Partilha de Contactos” / “Recusar”.
- [x] Landing B2B final com formulário simples de entrada (nif/nome/email) conectada ao onboarding.

## 6. Operação e aprovação manual
- [x] Fast-track automático operacional: domínio corporativo whitelist ativa `is_verified=true` automaticamente no trigger de `empresas_parceiras`.
- [x] Aprovação manual operacional definida para exceções: empresa regista-se -> abrir Supabase Studio -> tabela `empresas_parceiras` -> alterar `is_verified` para `true`.
- [ ] Definir SLA operacional e mensagens padrão para suporte.
- [ ] Povoar whitelist inicial de domínios corporativos confiáveis (ex: `bai.ao`, `unitel.ao`, `anglominerals.com`) antes do lançamento.

## 7. Testes e validação
- [ ] Testes SQL/RLS: empresa não verificada não consegue `INSERT` em `talent_pool_matches`. (script implementado; execução bloqueada por Postgres local indisponível)
- [ ] Testes SQL/RLS: empresa verificada consegue `INSERT`. (script implementado; execução bloqueada por Postgres local indisponível)
- [x] Testes de integração dedicados do onboarding Talent Pool (classificação domínio corporativo, mapeamento de erro OTP, guardrails do endpoint `empresa-profile` para vínculo de email e `NIF_DUPLICADO`).
- [x] Testes de integração API (contrato/lógica): `empresa-status`, `candidates`, `matches (POST/PATCH)` incluindo erros `CONTA_NAO_VERIFICADA` e `MATCH_DUPLICADO`.
- [ ] E2E: fluxo completo Landing → onboarding → teaser → bloqueio/modal.
- [x] E2E matriz do Jardim Murado: gate da Rede Global por esgotamento local e persistência de acesso em escopo global.
- [x] E2E matriz do onboarding OTP: mensagens distintas para token expirado vs inválido.
- [ ] E2E: fast-track com domínio verificado ativa conta automaticamente.
- [ ] E2E: email público (`gmail/yahoo`) permanece em quarentena.
- [x] Typecheck `apps/formacao` após implementação.
- [x] Teste unitário de contexto/roteamento do app `formacao`.
- [x] Runner `test:integration` e `test:e2e:matrix` a verde após inclusão da suíte Talent Pool.

## Bloqueios atuais
- Postgres local do Supabase indisponível (`127.0.0.1:54322` com `connection refused`), impedindo execução dos testes SQL/RLS reais neste momento.

## 8. Rollout
- [ ] Deploy das migrações.
- [ ] Deploy backend/frontend com feature flag.
- [ ] Smoke test em staging com 3 cenários: verificada, não verificada, domínio público.
- [ ] Ativar em produção por ondas e monitorar métricas de conversão/bloqueio.

## 9. Critérios de aceite
- [x] Usuário empresarial não verificado vê teaser mas não solicita entrevista (bloqueio + modal na UI e RLS no DB).
- [x] Bloqueio funciona via API com retorno de erro padronizado (`CONTA_NAO_VERIFICADA`).
- [ ] Usuário com domínio corporativo verificado entra com `is_verified=true` após confirmação de e-mail (validar em ambiente integrado).
- [x] Não há exposição de PII na listagem anónima de talentos.

## Próximo bloco recomendado
1. Subir Supabase local e executar `pnpm test:rls:talent-pool` para fechar evidência dos 2 cenários SQL/RLS (não verificada bloqueada, verificada permitida).
2. Preparar rollout em staging com whitelist inicial de domínios e smoke test de fast-track automático vs quarentena/manual.
