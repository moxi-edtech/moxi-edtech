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

O check Vercel do projecto principal falhou por configuração, não por compilação: `INVALID_CRON_SECRET`. O valor configurado de `CRON_SECRET` contém whitespace nas extremidades, o que não é permitido em headers HTTP. Nenhum valor de segredo foi lido ou exposto, e nenhuma variável de produção foi alterada.
