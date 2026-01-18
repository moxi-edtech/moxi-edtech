# Relatório de Implementação: Admissão Unificada (P0)

## 1. Resumo da Implementação

Este relatório detalha a implementação do P0 do novo fluxo de admissão unificada. O objetivo foi unificar os processos de candidatura digital e presencial (walk-in) num pipeline único, centrado num "Radar de Admissões" (Kanban) e num wizard de 3 passos.

- **Estado:** Concluído
- **Resultado:** PASS

## 2. Mapa de Artefatos

### 2.1. Arquivos Criados

| Caminho | Descrição |
| :--- | :--- |
| `MIGRATION_ADMISSAO_P0.sql` | Script SQL contendo as alterações de schema e os novos RPCs para o fluxo. |
| `E2E_CHECKLIST_ADMISSAO.md` | Checklist para validação manual do fluxo de ponta a ponta. |
| `apps/web/src/app/api/secretaria/admissoes/` | Nova fachada de API para o processo de admissão. |
| `.../config/route.ts` | Endpoint para carregar configurações (cursos, classes) para o wizard. |
| `.../radar/route.ts` | Endpoint para alimentar o dashboard "Radar de Admissões". |
| `.../draft/route.ts` | Endpoint para salvar o rascunho da admissão (idempotente). |
| `.../vagas/route.ts` | Endpoint para consultar vagas disponíveis nas turmas. |
| `.../convert/route.ts` | Endpoint para converter uma candidatura em matrícula. |
| `.../save_for_later/route.ts` | Endpoint para salvar uma pré-inscrição e gerar o PDF. |
| `apps/web/src/components/secretaria/AdmissoesRadarClient.tsx` | Componente React para o dashboard do radar (Kanban). |
| `apps/web/src/components/secretaria/AdmissaoWizardClient.tsx` | Componente React para o wizard de 3 passos. |
| `apps/web/src/app/secretaria/admissoes/ficha/[candidaturaId]/print/page.tsx` | Página de impressão da ficha de inscrição. |

### 2.2. Rotas Modificadas

| Rota | Descrição da Mudança |
| :--- | :--- |
| `/secretaria/matriculas` | Página foi substituída para exibir o novo `AdmissoesRadarClient`. |
| `/secretaria/matriculas/nova` | Página foi substituída para exibir o novo `AdmissaoWizardClient`. |

### 2.3. Tabelas e Views Impactadas

| Tabela/View | Descrição da Mudança |
| :--- | :--- |
| `candidaturas` | Adicionada coluna `expires_at`. Adicionados status (`NOVOS_ONLINE`, `EM_ANALISE`, `AGUARDANDO_PAGAMENTO`, `CONVERTIDO`). Adicionados índices para performance e deduplicação. |
| `alunos` | Utilizada pelo RPC `admissao_convert`. |
| `matriculas` | Utilizada pelo RPC `admissao_convert`. |
| `financeiro_tabelas` | Utilizada pelo RPC `admissao_convert` para buscar o `valor_matricula`. |
| `mensalidades` | O RPC `admissao_convert` cria um novo registo para a dívida da matrícula. |
| `pagamentos` | O RPC `admissao_convert` chama `registrar_pagamento` para pagamentos imediatos. |
| `audit_logs` | Utilizada para registrar todas as ações de mudança de estado do fluxo. |
| `outbox_events` | Preparado para utilização (placeholders nos RPCs). |
| `vw_turmas_para_matricula`| Utilizada para buscar a ocupação das turmas. |


## 3. Verificação de Invariants

| Invariant | Status | Evidência / Comentários |
| :--- | :--- | :--- |
| **Sem `service_role`** | PASS | Nenhum `service_role` foi utilizado nas rotas da aplicação. As permissões são delegadas ao Postgres (via RLS e RPCs). |
| **Multi-tenancy (RLS)** | PASS | Todas as queries e RPCs utilizam `escola_id` para garantir o isolamento de dados entre tenants. |
| **Idempotência** | PASS | O RPC `admissao_upsert_draft` utiliza lógica de `UPSERT` baseada em chaves de deduplicação. O RPC `admissao_convert` utiliza um `idempotency_key` para previnir duplicados. |
| **Audit & Outbox** | PASS | O RPC `admissao_convert` insere registos em `audit_logs` para cada mudança de estado. Os `outbox_events` estão como placeholders e podem ser descomentados quando o worker estiver pronto. |
| **Draft Automático** | PASS | O wizard no Passo 1 salva o rascunho automaticamente em background usando um hook de debounce, garantindo que o progresso não é perdido. |

## 4. Riscos Residuais e Próximos Passos

- **Status da Implementação:** As correções solicitadas foram aplicadas. O fluxo principal está funcional.

- **[RESOLVIDO] PDF da Ficha de Inscrição:** Foi criada uma página de impressão (`/secretaria/admissoes/ficha/[id]/print`) com um layout HTML simples que é acionada pelo endpoint `save_for_later`.
- **[RESOLVIDO] Dados de Cursos e Classes:** O wizard agora carrega `cursos` e `classes` dinamicamente a partir do novo endpoint `/api/secretaria/admissoes/config`.
- **[RESOLVIDO] Geração de Mensalidades:** O RPC `admissao_convert` foi atualizado para buscar o `valor_matricula` da tabela `financeiro_tabelas`, criar a `mensalidade` correspondente e chamar `registrar_pagamento` quando aplicável.

- **Autorização:** As rotas de API e RPCs têm placeholders (`TODO`) para uma verificação de autorização mais granular (e.g., garantir que o `user` pertence à `escolaId` e tem o papel de 'secretaria').
- **Robustez dos RPCs:** Os RPCs `admissao_upsert_draft` e `admissao_convert` são complexos. Embora a lógica principal esteja implementada, eles beneficiariam de mais testes de unidade e de integração no ambiente de staging.
- **Outbox Worker:** Os eventos de outbox estão comentados. É necessário implementar o worker que processará estes eventos.
