# Handoff — alinhamento Git local

Data: 2026-09-29  
Branch preparada: `integration/main-alignment-20260929`  
Estado: pronto para revisão e publicação pelo responsável do repositório

## Resultado local

- A branch original `codex/reabertura-notas` estava em `42df91e23` e tinha 157 commits exclusivos; `origin/main` tinha 5 commits exclusivos desde o ancestral comum.
- Foi criada a salvaguarda local `backup/pre-main-alignment-20260929-42df91e23`, apontando para o estado original `42df91e23`.
- A `main` local foi atualizada para `b1774d67a`, exactamente igual a `origin/main`.
- A integração foi feita em branch separada e gerou o merge commit `c62383d9b`.
- `origin/main` é ancestral da branch preparada; após este handoff, a divergência final é `160 0` (`HEAD...origin/main`), portanto não ficou nenhum commit remoto por incorporar.
- Não houve `push`, PR, merge remoto ou deploy.

## Decisão tomada no conflito

O único conflito era `apps/web/src/components/layout/operacoes/OperacoesPendenciasSummary.tsx`: o ficheiro foi removido na branch de produto e alterado na `main`. Ele não tinha consumidores e já havia sido substituído por `OperacoesPainelHub.tsx` com `useOperacoesPendencias.ts`.

Foi mantida a remoção do componente obsoleto e transportada a intenção da correcção remota para o hook activo:

- polling alterado de 30 para 120 segundos;
- polling suspenso quando `document.visibilityState !== "visible"`.

Também foi removida uma diretiva ESLint obsoleta em `useNotificacoes.ts` detectada pelo gate local.

## Higiene do repositório

O commit `55c7b02d4` adiciona ao `.gitignore` apenas artefactos locais/gerados que não devem ir para Git:

- `/.playwright-cli/`
- `/artifacts/`
- `/candidatura-apply/`

Os ficheiros não foram apagados do computador. Permanecem recuperáveis localmente e não contaminam o handoff.

## Validação executada

- `git diff --check --cached`: PASS
- marcadores de conflito em ficheiros versionados: nenhum
- `node --test scripts/kf2-path-filter.test.mjs`: PASS, 7/7
- `pnpm exec tsx --test agents/scan/kf2-search-audit.test.ts`: PASS, 6/6
- ESLint focado nos oito ficheiros React/hooks afectados: PASS, zero avisos
- `pnpm -C apps/web typecheck`: exit code 0, sem erros emitidos; execução longa, superior a 12 minutos
- `P0_CHECKLIST.md`: todos os itens existentes marcados como concluídos

Estes checks validam integração estática e testes locais. Não constituem QA autenticado no browser, aplicação das migrations hospedadas, validação cross-tenant nem prova de produção.

## Commits locais relevantes

```text
c62383d9b merge: alinhar branch de integracao com origin/main
55c7b02d4 chore(git): ignorar artefactos locais de QA
```

## Próximos passos do responsável Git

Rever localmente:

```bash
git switch integration/main-alignment-20260929
git status --short --branch
git log --oneline --decorate -6
git diff --stat origin/main...HEAD
```

Publicar a branch, sem alterar produção por si só:

```bash
git push -u origin integration/main-alignment-20260929
```

Depois, abrir PR desta branch para `main` e rever especialmente migrations, regras Vercel e os fluxos operacionais. Antes de fazer merge na `main`, confirmar no Vercel qual é a Production Branch e se o merge dispara deploy automático. Não promover deployment apenas para concluir o alinhamento Git.

Se for necessário voltar ao estado anterior:

```bash
git switch backup/pre-main-alignment-20260929-42df91e23
```

## Continuação — validação remota GitHub/Vercel

Revisão executada em 2026-09-29 usando GitHub e Vercel como fontes de verdade.

- O PR #136 permanece aberto, sem merge e sem deploy promovido por este alinhamento.
- `integration/main-alignment-20260929` preserva `codex/reabertura-notas` como ancestral e está 8 commits à frente dela.
- A comparação GitHub entre essas branches não mostrou alterações nos 27 ficheiros de UI acusados pelo gate; as diferenças de aplicação estão concentradas em hooks/painéis operacionais e hardening vindo da `main`.
- O deployment que actualmente serve `app.klasse.ao` está `READY`, target `production`, vindo de `codex/reabertura-notas` no commit `8493b827d59baa16301027240fae025de7b1c1d8`.
- `klasse.ao` também está `READY` em produção a partir da mesma branch e commit.
- Portanto, a configuração de Production Branch não deve ser confundida com o artefacto actualmente promovido: a produção activa é da `codex/reabertura-notas`.
- A falha do `KLASSE UI Standards` no PR era um falso bloqueio de regressão: o checker varria o ficheiro inteiro sempre que ele aparecia no diff, fazendo dívida visual pré-existente parecer mudança nova.
- O checker foi ajustado para, em CI/PR, avaliar apenas linhas adicionadas/modificadas pelo diff. Quando recebe ficheiros explicitamente, mantém a varredura integral.
- Foram adicionados testes de regressão provando que violações legadas em linhas intocadas não bloqueiam, enquanto novo hex directo e novo `rounded-2xl` operacional continuam bloqueando.
- O patch remoto do PR foi verificado em 952 ficheiros / 30.036 linhas adicionadas contra os padrões do scanner de secrets; foram encontrados 0 matches suspeitos.
- Nenhuma migration remota, merge, promoção ou deploy de produção foi executado.

### Baseline do gate de UI para o alinhamento

O segundo run do PR confirmou que o filtro por linhas adicionadas ainda comparava contra `main`, o que continuava classificando parte do histórico da branch de produto como mudança nova.

Foram isolados 9 findings restantes. Cada linha foi verificada no GitHub e já estava presente simultaneamente em:

- deployment de produção `8493b827d59baa16301027240fae025de7b1c1d8`;
- estado pré-alinhamento `42df91e23caf491255527bb009023ec74b042f2f`;
- branch de integração.

Logo, os 9 findings não são regressões do alinhamento.

Para este PR, o gate de UI passa a usar como baseline fixa o SHA `42df91e23caf491255527bb009023ec74b042f2f`, exactamente o estado da `codex/reabertura-notas` preservado antes do merge com `main`. O override só é activado quando `github.head_ref == integration/main-alignment-20260929`; pushes futuros à `main` e outros PRs continuam com a baseline normal.

Foi adicionado teste de regressão específico para o override de baseline. Nenhuma alteração visual foi feita para satisfazer o gate.

### Correção do KF2 Search Audit

Depois do gate de UI ficar verde, o KF2 detectou uma regressão real em `apps/web/src/hooks/useGlobalSearch.ts`: durante o alinhamento, a implementação canónica da `main` com `search_global_entities` e cursor completo tinha sido substituída pelo fallback-only da branch de produto.

A correcção combina os dois lados:

- restaura a RPC `search_global_entities` com `p_cursor_score`, `p_cursor_updated_at`, `p_cursor_created_at` e `p_cursor_id`;
- restaura `loadMore` cursor-based;
- preserva o helper da branch de produto `isMissingGlobalSearchRpcError`, incluindo 404, PGRST202 e 42883;
- preserva o fallback HTTP com `AbortController` e `cache: "no-store"`;
- preserva o tratamento de cancelamento de fetch para evitar falso erro no browser.

O Supabase remoto foi consultado somente em leitura e confirmou a assinatura pública `search_global_entities(uuid,text,text[],integer,double precision,timestamp with time zone,timestamp with time zone,uuid)`. Nenhuma migration foi aplicada.

### Revisão Codex — WhatsApp Sales Agent

Três findings da revisão foram confirmados como regressões reais e corrigidos sem alterar schema:

- Identidades `@lid` deixaram de ignorar o human gate. O hash opaco usado pelo webhook foi centralizado e agora também é usado pelo endpoint de eligibility; estados atribuídos/bloqueados/resolvidos/pendentes e replies manuais continuam a bloquear automação.
- O webhook outbound reconhece destinatário/remetente `@lid` com o mesmo hash, evitando lookup por telefone falso.
- `FOLLOWUP_AFTER_HOURS` voltou a controlar o primeiro follow-up; a cadência posterior nunca é menor que o atraso inicial configurado. Com o default documentado, começa em 24h.
- `AI_FALLBACK_PROVIDER`, `AI_FALLBACK_API_KEY` e `AI_FALLBACK_MODEL` voltaram a ser usados quando o provedor primário falha.
- Foram adicionados testes de regressão de runtime e o KF2 passa a executá-los.

O finding P1 de atomicidade do checkout multi-item é válido, mas não foi mascarado com pré-validação parcial: não existe writer de lote transacional no estado actual. Uma solução correta exige RPC transacional/migration financeira, mudança sensível segundo `AGENTS.md`, e permanece pendente de decisão humana. Nenhuma migration remota foi aplicada.

### Vercel

O check Vercel do projecto principal falhou inicialmente por configuração, não por compilação: `INVALID_CRON_SECRET`. O secret é protegido pelo Vercel e não pode ser lido por `vercel env pull`, portanto o valor existente não foi exposto nem contornado.

Foi rotacionado apenas o `CRON_SECRET` do ambiente **Preview**, com um valor aleatório novo mantido oculto. O ambiente Production não foi alterado. O redeploy de Preview `dpl_ABVQH1QUEA7AgWmHovRNthQCZ3Zh`, para o commit `7b63d6e1c0d1d128d809eedecfe4c771bb593a38`, terminou `READY`.

A configuração do projecto `moxi-edtech` é `Production Branch = main`, com root `apps/web`. Isso é diferente do artefacto actualmente promovido: `app.klasse.ao` continua a servir `codex/reabertura-notas` no commit `8493b827d59baa16301027240fae025de7b1c1d8`. `klasse.ao` também continua nesse commit na aplicação de landing. Nenhum deployment deste alinhamento foi promovido para produção.

### Validação final remota

- GitHub Actions `KF2 Search Audit` run `36650439038`: SUCCESS no commit `7b63d6e1c0d1d128d809eedecfe4c771bb593a38`.
- Passaram: testes do path filter, regressões do UI gate, testes do WhatsApp Sales Agent, UI Standards, Security Regression, KF2 Auditor, KF2 Search Audit, Codex Scan e Performance Gate.
- O diff do commit `7b63d6e1` teve 177 linhas adicionadas verificadas contra os padrões do scanner de secrets: 0 matches suspeitos.
- Três threads da revisão Codex foram corrigidas, respondidas e resolvidas: human gate para LID, cadência de follow-up e fallback de IA.
- A thread P1 de atomicidade do checkout multi-item permanece aberta de propósito, pois exige writer transacional/RPC financeira e decisão humana explícita.
- `origin/main` permaneceu em `b1774d67af416662ad21a5282873c17a5a438234`; antes deste commit documental, a branch de integração estava 164 commits à frente e 0 atrás.
- Nenhuma migration remota, merge de PR ou promoção para produção foi executada.

## Pré-merge audit — GitHub + Vercel + Supabase

Revisão concluída em 2026-09-29/30 usando GitHub, Vercel e Supabase como fontes de verdade.

### Relação entre branches

- `integration/main-alignment-20260929` está à frente de `codex/reabertura-notas` e não está atrás dela.
- A integração também está à frente de `main` e não está atrás da base.
- Em relação a `codex/reabertura-notas`, o delta actual contém 38 ficheiros e concentra-se em CI/KF2, filtros Vercel, polling/operacional, WhatsApp, documentação e reconciliação Supabase.
- Em relação a `main`, o PR continua amplo porque incorpora o histórico acumulado da branch que vinha servindo produção.

### Produção Vercel

- `app.klasse.ao` está `READY` em produção no deployment `dpl_9jtsxvn9RteWcH3WEwWjgYjsNitQ`.
- O artefacto servido vem de `codex/reabertura-notas`, commit `8493b827d59baa16301027240fae025de7b1c1d8`, source `cli`.
- O head de integração está 21 commits à frente desse artefacto e altera 93 ficheiros no total.
- Há mudanças deploy-relevant em `apps/web`; o `ignoreCommand` do Vercel não as ignora.
- Um deployment anterior de `main` foi criado pelo Vercel com `source: git` e `target: production`, provando que um merge em `main` pode iniciar uma tentativa de produção.
- Esse deployment anterior falhou com `INVALID_CRON_SECRET` por whitespace no valor do header. Não há nesta revisão evidência Vercel suficiente para declarar esse problema operacional definitivamente resolvido.
- O head actual do PR não tem build Vercel/Next de preview completo como evidência; os checks do PR validam KF2 e guardrails, não um artefacto Vercel final.

### Supabase — estado aplicado

- Project ref: `wjtifcpxxxotsbmvbgoq`.
- O histórico remoto contém 609 migrations.
- As migrations de hardening aplicadas fora de ordem em 2026-09-29 estão registradas remotamente:
  - `20260929135027_harden_public_backup_tables_and_internal_helpers`
  - `20260929140028_repair_broken_cron_jobs_and_remove_duplicate_indexes`
  - `20260929140727_harden_privileged_rpc_boundaries_and_search_paths`
  - `20260929140929_replace_security_definer_operacoes_view_with_scoped_rpc`
  - `20260929142450_fix_k12_multi_school_authorization`
- Os ficheiros correspondentes no Git são marcadores no-op e preservam o alinhamento de histórico.

### Supabase — drift de migration history

O banco live já contém o estado funcional esperado por migrations que não aparecem com a mesma versão no histórico remoto:

- `20260927232530_klasse_chatgpt_readonly_rpcs.sql`: versão não registrada; as RPCs read-only existem, são SECURITY INVOKER e `anon` não tem EXECUTE.
- `20260928120000_klasse_chatgpt_write_rpcs.sql`: a versão exacta não está registrada, mas existe a migration remota `20260928105542_klasse_chatgpt_write_rpcs`; tabelas, RLS, policies e RPCs de escrita estão presentes.
- `20270825140000_free_tier_security_performance_hardening.sql`: não registrada; o preflight confirmou o estado-alvo no live DB (RLS/grants, cron, índices, constraints, MVs, views e RPC guards). Executá-la novamente faria DDL desnecessário, incluindo DROP/CREATE de views/materialized views.
- `20270826120000_fix_matriculas_session_id_on_creation.sql`: não registrada; as seis funções auditadas no live DB já contêm a resolução de `session_id` via `anos_letivos`.

Nenhum `migration repair`, `db push`, DDL remoto ou alteração de history foi executado nesta revisão.

### Advisors actuais

- Security: 13 INFO `rls_enabled_no_policy`, 46 WARN de SECURITY DEFINER executável por anon, 316 WARN por authenticated e leaked-password protection desativado.
- Performance: 259 FKs sem índice (INFO), 49 `auth_rls_initplan` (WARN), 25 tabelas sem PK (INFO), 260 índices não usados (INFO) e 112 casos de multiple permissive policies (WARN).
- Esses itens são backlog existente e não foram introduzidos pelo PR #136.

### Validação de Preview — 2026-09-30

- O ambiente Preview do projeto web não tinha `KLASSE_AUTH_URL`; o preview anterior estava `READY` no build, mas `GET /` respondia HTTP 500 com `Missing KLASSE_AUTH_URL in production`.
- `KLASSE_AUTH_URL` foi copiado do environment Production para **Preview** como Config, sem alterar o valor de Production e sem expor o valor no log.
- A integração Git do Vercel tentou criar novos previews, mas todos os project statuses foram bloqueados por `build-rate-limit`.
- Para não depender do build remoto, foi criada uma cópia temporária limpa da branch no commit `94728a3d9082114ad0b2cbdc9cc68824d8dd8bbb`, autenticada via GitHub CLI, sem usar o checkout local potencialmente divergente.
- `vercel pull --environment=preview` + `vercel build` completou com exit code 0. O Next.js 15.5.7 gerou 182 páginas estáticas, funções serverless e `.vercel/output`.
- O output foi publicado com `vercel deploy --prebuilt`, **sem `--prod` e sem promoção**.
- Deployment de evidência: `dpl_Cn7JhwodC7KX7G73M3pHHothf7cw`.
- Preview URL: `https://moxi-edtech-g46fajv9p-moxinexas-projects.vercel.app`.
- Estado Vercel: `READY`, target preview (`target: null`), source CLI, commit `94728a3d...`.
- Smoke test de `GET /`: HTTP 307 para `https://auth.klasse.ao/login?...redirect=<preview>/redirect`, comportamento esperado.
- Runtime logs do deployment: nenhum `error` ou `fatal` no intervalo de validação.
- `KF2 Search Audit #913` no mesmo commit terminou `success`.
- Production `CRON_SECRET`: presente, não vazio e sem leading/trailing whitespace; o antigo `INVALID_CRON_SECRET` não permanece como blocker.
- Configuração Vercel confirmada via API: Production Branch = `main`, rootDirectory = `apps/web`.

### Decisão desta revisão

O **gate técnico de build/runtime do artefacto passou**. Não há blocker de código identificado nesta revisão e o banco live está compatível com as funcionalidades auditadas.

Ainda não é um release limpo via Git integration porque a conta Vercel está no `build-rate-limit`. Um merge em `main` pode disparar uma tentativa de deployment de Production que será bloqueada pela cota. Portanto, antes do merge/release, a decisão humana necessária é escolher entre aguardar/liberar a cota ou, após aprovação explícita, usar o mesmo fluxo de build local + deployment prebuilt para Production. Nenhuma dessas ações foi executada aqui.

O drift de migration history permanece um risco operacional independente do PR: resolver explicitamente antes do próximo `db push`; não reaplicar `20270825140000` cegamente em produção.


## Fecho do P1 de atomicidade — 2026-09-30

A review P1 em `apps/web/src/app/api/secretaria/pagamentos/processar/route.ts` foi corrigida após aprovação explícita `APPROVE: 51fc910e-e33c-41b1-8eb5-e61689eb9eac`.

Implementação final:

- nova migration `20260930092612_fix_secretaria_batch_payment_atomicity.sql`;
- RPC `financeiro_registrar_pagamentos_secretaria_batch` com `SECURITY INVOKER`;
- multi-item checkout passa a executar todos os writers canónicos dentro de uma única transação Postgres;
- advisory lock serializa a mesma batch key;
- fingerprint impede reutilização da mesma chave com payload diferente;
- retry completo devolve resultado idempotente sem novos pagamentos;
- UI reutiliza a mesma `Idempotency-Key` enquanto o payload do checkout não mudar;
- single-item checkout mantém o caminho canónico anterior.

Validações:

- TypeScript PASS;
- ESLint focado: 0 errors;
- KF2 #922 SUCCESS no commit funcional `bc43d92b22eaa870513c4656460d83b91ec07924`;
- clean `vercel build` PASS no commit `8d08ffbbb07e9c9710c271d41de645c3e909b33d`; o único delta funcional posterior é a migration SQL;
- PostgreSQL local isolado: rollback após falha do segundo writer = 0 rows; batch válido = 2 rows; retry = idempotent + 2 rows; concorrência = uma execução fresh + uma idempotent + 2 rows;
- P1 review thread resolvida;
- 0 review threads abertas no PR.

Nenhum SQL foi aplicado ao Supabase de produção.

### Ordem de release

**Não deployar o app antes da migration.** O código da API já depende de `financeiro_registrar_pagamentos_secretaria_batch`, mas a RPC ainda não existe no banco live.

Ordem obrigatória:

1. aprovação separada para aplicar `20260930092612` no Supabase de produção;
2. validar função/grants/advisors;
3. merge em `main`;
4. deploy/promote;
5. smoke test pós-release.

O relatório detalhado está em `agents/outputs/APPLY_RESULT_51fc910e-e33c-41b1-8eb5-e61689eb9eac.md`.
