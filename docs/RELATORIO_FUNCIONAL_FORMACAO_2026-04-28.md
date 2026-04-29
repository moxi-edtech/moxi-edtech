# KLASSE Formação — Relatório funcional detalhado (sem Solo Creator)

Data: 2026-04-28
Objetivo: inventariar funcionalidades existentes do módulo Formação, estado de implementação, melhorias por funcionalidade, e backlog must-have/nice-to-have para reduzir fricção e aumentar eficiência operacional.

## 1) Premissas e recorte

- Este relatório considera **Formação Centro** como produto principal (`tenant_type=formacao`) e trata itens Solo Creator como **contaminação de escopo**.
- A arquitetura oficial documenta `k12 | formacao` como valores canônicos de tenant_type e define `apps/formacao` como produto dedicado.
- Existe dual-run em andamento e cleanup pendente de rotas legadas.

## 2) Evidências-base usadas

### 2.1 Superfície atual
- APIs em `apps/formacao/app/api/formacao/**/route.ts` (inventário por domínio: admin, admissões, agenda, backoffice, certificados, financeiro, funnel, honorários, inscrições, pagamentos, público, secretaria, talent-pool).
- Páginas em `apps/formacao/app/**/page.tsx` cobrindo admin/secretaria/financeiro/formador/formando/público.
- Rotas residuais de formação ainda em `apps/web/src/app/**/formacao/**`.

### 2.2 Segurança/performance
- Guard central backend com validação de sessão/role/tenant em `requireFormacaoRoles`.
- Rotas financeiras sensíveis com `dynamic = "force-dynamic"` e filtro por `escola_id`.
- MVs obrigatórias de Formação existentes com índice único, refresh concurrently, wrappers e cron.

### 2.3 Estado documental
- Roadmap indica fases 0-5 como completas, porém mantém pendências explícitas: assíncrono do B2B >500, migração final de rotas, e certificados de conclusão.

---

## 3) Inventário de funcionalidades + estado + melhorias

Legenda de estado:
- **PRONTO**: funcionalidade operacional com base sólida.
- **OPERACIONAL COM FRICÇÃO**: funciona, mas com gargalo relevante de UX/escala/risco.
- **PARCIAL**: existe implementação, mas incompleta para operação robusta.
- **DESALINHADO**: foge do recorte Formação Centro e gera ruído operacional.

### F1) Admissões da Secretaria (Balcão)
- **Evidência**: API dedicada com criação/resolução de formando, deduplicação e opção de criar cobrança (`/api/formacao/secretaria/inscricoes`).
- **Estado**: **PRONTO**.
- **Fricções**:
  1. Dependência forte de payload manual (campos críticos ainda livres para erro humano).
  2. Ambiguidade de matching por BI/telefone/email em alguns cenários.
- **Melhorias por funcionalidade**:
  - Introduzir “wizard de inscrição” com validações progressivas (server-side e client-side).
  - Normalizar e validar documento angolano (máscara + checksum/heurística) antes de submeter.
  - Idempotency key obrigatória por tentativa de inscrição.

### F2) Upload B2B em lote
- **Evidência**: endpoint de upload (`/secretaria/inscricoes/upload-b2b`) com dedupe, criação de usuários e geração de faturação; limite hard de 500 linhas por lote.
- **Estado**: **OPERACIONAL COM FRICÇÃO**.
- **Fricções**:
  1. Fluxo síncrono e limite de 500 linhas.
  2. Sem pipeline robusto de reprocessamento/retry por linha.
- **Melhorias por funcionalidade**:
  - Migrar para job assíncrono com `batch_id`, estados (`queued/running/partial/success/failed`) e retry idempotente por linha.
  - Exportar relatório final (CSV) com motivo de falha por registro.

### F3) Self-service de inscrição
- **Evidência**: endpoint legado `/api/formacao/publico/inscrever` retorna 410 e força fluxo canônico; existe página pública de inscrição por `centroSlug/cohortRef`.
- **Estado**: **PRONTO** no fluxo canônico, **com necessidade de hardening**.
- **Fricções**:
  1. Experiência de erro pode ser opaca quando dados batem em registros existentes.
  2. Falta trilha clara de retomada para usuário que abandonou checkout.
- **Melhorias por funcionalidade**:
  - Recuperação de sessão de inscrição incompleta (token curto + expiração).
  - Feedback de conflito de identidade com ação guiada (sem vazar existência de conta).

### F4) Inbox de admissões (staging -> aprovação)
- **Evidência**: API admin de inscrições staging com aprovação/rejeição e promoção via trigger.
- **Estado**: **PRONTO**.
- **Fricções**:
  1. Aprovação ainda centralizada em ação manual, sem SLA explícito por fila.
  2. Falta priorização automática (ex.: pagamento confirmado há mais tempo).
- **Melhorias por funcionalidade**:
  - Ordenação por risco/urgência (SLA breach, proximidade da data de início).
  - Macro-ações em lote com trilha auditável por operador.

### F5) Catálogo Académico (Cursos/Cohorts)
- **Evidência**: APIs de backoffice para cursos/cohorts + páginas admin correspondentes.
- **Estado**: **OPERACIONAL COM FRICÇÃO**.
- **Fricções**:
  1. Componentes críticos ainda têm blocos `MVP_B2C_ROWS` e `MVP_B2B_DATA` (dados estáticos).
  2. Risco de percepção falsa de saúde financeira/acadêmica.
- **Melhorias por funcionalidade**:
  - Eliminar mocks e forçar dados reais com estados loading/empty/error explícitos.
  - SLA de atualização e reconciliação entre matrícula, presença e faturação.

### F6) Financeiro (Dashboard, B2B/B2C, Conciliação)
- **Evidência**: dashboard financeiro usa `vw_formacao_inadimplencia_resumo` e `vw_formacao_margem_por_edicao`; APIs B2B/B2C/conciliacao com `force-dynamic` e `escola_id`.
- **Estado**: **PRONTO** para operação piloto.
- **Fricções**:
  1. Alguns formulários ainda exigem entrada manual por IDs técnicos (`formando_user_id`, `cohort_id`).
  2. Possível risco de erro operacional por UX orientada a IDs e não a busca por entidade.
- **Melhorias por funcionalidade**:
  - Lookup/autocomplete de aluno/cohort/cliente (sem expor IDs como campo primário).
  - Regras de validação fiscal/financeira server-side com mensagens acionáveis.

### F7) Pagamentos (upload de comprovativo)
- **Evidência**: endpoint de comprovativo faz upload para storage e marca item como `em_verificacao`; comentário no próprio código aponta ausência de tabela dedicada de verificação.
- **Estado**: **PARCIAL**.
- **Fricções**:
  1. Verificação de pagamento acoplada a metadata de item de fatura.
  2. Falta de entidade de verificação com lifecycle próprio (auditoria, anti-fraude, histórico de decisão).
- **Melhorias por funcionalidade**:
  - Criar `formacao_pagamentos_verificacao` com status formal (`submetido`, `em_analise`, `aprovado`, `rejeitado`, `contestacao`).
  - Motor de regras simples para divergência de valor/referência e duplicidade de comprovativo.

### F8) Certificados
- **Evidência**: APIs de templates/emissões existem e página de secretaria para emissão manual também existe.
- **Estado**: **OPERACIONAL COM FRICÇÃO**.
- **Fricções**:
  1. Processo ainda majoritariamente manual (entrada por `formando_user_id`).
  2. Roadmap ainda marca “certificado de conclusão” como pendência estratégica.
- **Melhorias por funcionalidade**:
  - Geração automática por evento de conclusão (com fila assíncrona e trilha legal).
  - Verificação pública por hash/QR e revogação controlada.

### F9) Portal do Aluno (meus cursos, pagamentos, carreira)
- **Evidência**: páginas `meus-cursos`, `pagamentos`, `aluno/dashboard` e componentes de carreira/talent opt-in.
- **Estado**: **OPERACIONAL COM FRICÇÃO**.
- **Fricções**:
  1. Mistura de objetivos (acadêmico vs talent pool) pode dispersar foco.
  2. Dependência de ações da secretaria para fechamento de ciclo de pagamento/acesso.
- **Melhorias por funcionalidade**:
  - Timeline única do aluno: inscrição -> pagamento -> validação -> acesso -> certificado.
  - Notificações proativas com próximos passos objetivos.

### F10) Fronteira de produto (Formação vs Solo Creator)
- **Evidência**: código de navegação/middleware/roles e várias páginas/rotas ainda incluem `solo_creator`, `mentor/*`, `talent-pool`.
- **Estado**: **DESALINHADO** com o direcionamento atual.
- **Fricções**:
  1. Complexidade extra de RBAC e roteamento para o time e para suporte.
  2. Ambiguidade de posicionamento do produto Formação.
- **Melhorias por funcionalidade**:
  - Hard split de escopo: remover dependências Solo do app Formação Centro.
  - Congelar novas features de Solo aqui e mover para produto próprio.

---

## 4) Must-have que eu incluiria (foco em reduzir fricção e aumentar eficiência)

### MH-1) Pipeline assíncrono de admissões B2B com idempotência
- Porque é must-have: elimina timeout, melhora throughput e reduz retrabalho da secretaria.
- Entrega mínima: fila + tabela de jobs + retry + relatório por linha + observabilidade.

### MH-2) Entidade formal de verificação de pagamentos
- Porque é must-have: hoje o fluxo está “improvisado” em metadata; isso é frágil para escala e auditoria.
- Entrega mínima: tabela dedicada, FSM de status, trilha de decisão e anexos por submissão.

### MH-3) UX anti-erro em financeiro (sem IDs manuais)
- Porque é must-have: digitação de IDs aumenta erro operacional e retrabalho.
- Entrega mínima: selectors pesquisáveis por nome/BI/email/coorte com validação server-side.

### MH-4) Remoção de mocks em telas de gestão
- Porque é must-have: dado fake em módulo financeiro/acadêmico é risco direto de decisão errada.
- Entrega mínima: bloquear build de produção se `MVP_*` permanecer em componentes críticos.

### MH-5) Desacoplamento de Solo Creator do app Formação Centro
- Porque é must-have: seu requisito de negócio mudou (Formação != Solo). O código ainda não acompanha.
- Entrega mínima: remover rotas `mentor/*` e referências `solo_creator` do domínio Formação Centro.

### MH-6) Testes de contrato para rotas críticas (auth/cache/tenant)
- Porque é must-have: proteção contra regressão em áreas de dinheiro e acesso.
- Entrega mínima: suite para `/financeiro/**`, `/secretaria/**`, `/pagamentos/**` cobrindo 401/403/200 e cache policy.

---

### 5) Nice-to-have que eu incluiria

### NH-5) Relatórios executivos com cohort economics
- **Estado**: **IMPLEMENTADO**
- **Entrega**:
  - Infraestrutura de dados: Adicionado `custo_marketing` em `formacao_cohort_financeiro`.
  - Views analíticas: `vw_formacao_cohort_economics` e `vw_formacao_course_economics` calculando CAC, ROI, LTV e Tempo Médio de Conversão.
  - UI: Novo dashboard executivo em `/financeiro/economics` integrado ao cockpit financeiro.

### NH-1) Inbox com prioridade inteligente


---

## 6) Crítica cética (direta)

O módulo Formação **já tem base forte**, mas ainda carrega dívida que trava eficiência:
1. mistura de escopo com Solo Creator,
2. pontos manuais em operações financeiras,
3. pagamentos sem entidade de verificação dedicada,
4. upload B2B ainda síncrono,
5. mocks em componentes de gestão.

Se quiser escalar com segurança (RLS + performance + operação), os 6 must-have acima são prioridade antes de expandir feature set.

---

## 7) Comandos executados para evidência

- `find apps/formacao/app/api/formacao -maxdepth 3 -type f -name 'route.ts' | sort`
- `find apps/formacao/app -maxdepth 5 -type f -name 'page.tsx' | sort`
- `find apps/web/src/app -type f | rg '/formacao/'`
- `rg -n --glob '!**/*.tsbuildinfo' "MVP_|solo_creator|mentor|talent-pool|force-dynamic|em_verificacao|LEGACY_ENDPOINT_GONE" apps/formacao docs`
- `sed -n` em rotas e libs-chave para validação pontual.

---

## 8) Atualização de execução (status real no código) — 2026-04-28

### 8.1 Must-have executados

- **MH-2 (Entidade formal de pagamentos)**: **IMPLEMENTADO (base pronta)**
  - Criada migration `formacao_pagamentos_verificacao`.
  - Fluxo de comprovativo agora cria submissão dedicada e conciliação passou a ler/atualizar essa entidade com estados formais.
  - Pendente evolutivo: regras anti-fraude mais ricas e automação adicional de decisão.

- **MH-3 (UX anti-ID-manual)**: **IMPLEMENTADO (núcleo financeiro + extensões)**
  - Financeiro B2C/B2B: seleção assistida de formando (lookup) e validação server-side por tenant.
  - Certificados: emissão com selects de formando/turma via endpoint de opções; validação de tenant no backend.
  - Honorários: seleção assistida de turma/formador via endpoint de opções; validação de tenant no backend.
  - Secretaria inscrições: removida orientação operacional de “informar `formando_user_id` explicitamente”; API agora retorna resolução guiada com candidatos (`FORMANDO_RESOLUTION_REQUIRED`).
  - **Front-end da Secretaria:** implementado modal `InscricaoBalcaoModal` nas páginas de Turmas e Mentorias, consumindo o status `FORMANDO_RESOLUTION_REQUIRED` e exibindo um seletor visual de candidatos (por nome, e-mail ou BI) para evitar duplicidade.

- **MH-4 (Remoção de mocks em gestão)**: **IMPLEMENTADO (escopo crítico tratado)**
  - Removidos blocos `MVP_B2C_ROWS` e `MVP_B2B_DATA` de componentes críticos.
  - Adicionado guard de build (`guard-no-mvp.mjs`) e `prebuild` para bloquear `MVP_*` em produção.

- **MH-5 (Desacoplamento Solo Creator)**: **EM EXECUÇÃO AVANÇADA**
  - Aplicado bloqueio de acesso/tenant para `solo_creator` no app Formação.
  - Rotas e superfícies de mentor/parceiro/talent pool foram endurecidas/bloqueadas no fluxo principal.
  - Pendente: limpeza final de código residual e remoção definitiva de superfícies legadas fora do recorte Formação Centro.

### 8.2 Reclassificação rápida do inventário funcional

- **F6 Financeiro**: de “PRONTO para piloto” para **PRONTO (com hardening em curso)**.
- **F7 Pagamentos**: de **PARCIAL** para **OPERACIONAL COM FRICÇÃO** (já com entidade dedicada; falta automação avançada).
- **F8 Certificados**: de **OPERACIONAL COM FRICÇÃO** para **OPERACIONAL (UX melhorada)**.
- **F10 Fronteira Formação vs Solo**: de **DESALINHADO** para **EM REMEDIAÇÃO**.

### 8.3 Pendências prioritárias pós-execução

1. **MH-1**: pipeline assíncrono de upload B2B (>500, retry por linha, relatório final).
2. **MH-5**: concluir purge de escopo Solo residual.
3. **MH-6**: suíte de testes de contrato para `/financeiro/**`, `/secretaria/**`, `/pagamentos/**`.
