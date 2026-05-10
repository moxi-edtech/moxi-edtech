# Plano de Evolução — Virada de Ano Letivo K12 (SSOT)

## 1. Objetivo
Estabelecer uma virada de ano letivo confiável, auditável e reversível para produção, eliminando ambiguidade entre `ano_letivo`, `session_id` e artefatos acadêmico-financeiros.

## 2. Escopo
- K12 (apps/web + Supabase)
- Fluxos de: ano ativo, rematrícula, turmas, matrículas, mensalidades, histórico anual, snapshot de fechamento
- APIs de onboarding/session e rotas secretaria/admin relacionadas

## 3. SSOT Validado (base factual)
- `anos_letivos` suporta 1 ativo por escola (índice parcial)
- RPCs existentes:
  - `setup_active_ano_letivo`
  - `rematricula_em_massa`
  - `historico_set_snapshot_state`
  - `upsert_bulk_periodos_letivos`
- `matriculas` NÃO possui `ano_letivo_id`; possui `ano_letivo` e `session_id`
- Há endpoints usando `matriculas.ano_letivo_id` (incompatíveis com schema atual)
- Caso KLASSE: ano ativo 2025, dados operacionais ainda em 2026, `session_id` nulo em turmas/matrículas

## 4. Problemas Raiz
1. Modelo híbrido sem contrato único de referência temporal.
2. Código legado acessando coluna inexistente (`matriculas.ano_letivo_id`).
3. Virada funcionalmente parcial (ativa ano sem migrar operação viva).
4. Ausência de guardrail anti-rollback em produção.
5. Snapshot histórico não obrigatório antes do cutover.
6. **Inconsistência de Pautas**: Risco de alteração de notas após a impressão de documentos oficiais sem rastro auditável.

## 5. Princípio de Arquitetura (novo SSOT)
`session_id` (FK para `anos_letivos.id`) passa a ser a referência canônica operacional para:
- turmas
- matrículas
- rematrícula
- fechamento/snapshot
- **Pautas Oficiais e Históricos**

`ano_letivo` permanece como campo derivado/compatibilidade e nunca como chave primária de decisão de fluxo.

## 6. Plano por Fases

## Fase 0 — Hardening de Segurança de Virada
- Adicionar bloqueio de rollback em produção:
  - impedir ativar ano menor que o maior ano com movimento acadêmico/financeiro
- Exigir flag explícita de ambiente para permitir rollback apenas em dev/sandbox
- Criar auditoria semântica de virada (`ANO_LETIVO_CUTOVER_*`)

## Fase 1 — Alinhamento de Contrato de Dados
- Corrigir endpoints que usam `matriculas.ano_letivo_id` para `session_id`
- Revisar rotas de reassign/delete/rotate para usar colunas reais do schema
- Garantir filtros por `escola_id + session_id` nos fluxos críticos (incluindo `pautas_oficiais`)

## Fase 2 — Backfill Controlado
- Backfill de `session_id` em `turmas` a partir de `ano_letivo_id`/`ano_letivo`
- Backfill de `session_id` em `matriculas` por mapeamento de turma/ano
- Relatório de divergências não mapeáveis (sem update silencioso)

## Fase 3 — Cutover Atômico & Wizard de Virada
- **Frontend (UX)**: Implementar Assistente Guiado (Wizard) para eliminar erro humano.
- **Backend (DB)**: Criar serviço transacional `cutover_ano_letivo_v3` com etapas explícitas:
  1. Pré-checks de integridade (pendências, calendário, session_id).
  2. **Liquidação Acadêmica**: Geração em lote e congelamento de Pautas Anuais Oficiais.
  3. Snapshot histórico obrigatório (Freeze).
  4. Ativação de novo ano (Switch).
  5. Rematrícula/transferência por sessão em lote.
  6. Publicação de relatório de evidência.
- Lock operacional durante a execução para evitar concorrência.

## Fase 4 — Observabilidade e Gate de Produção
- Dashboard de saúde da virada por escola:
  - ano ativo
  - cobertura de session_id
  - distribuição de dados por sessão
  - status de snapshot
- Gate de deploy: bloquear release se checks críticos falharem

---

## 13. Especificação do Wizard (Assistente de Virada)
Para garantir que nada fique para trás, a interface deve guiar o usuário pelos seguintes marcos:

1.  **Check-up de Prontidão**: Validação automática de dados (ex: busca por turmas com `session_id` nulo ou calendários incompletos).
2.  **Liquidação e Congelamento (Freeze)**: 
    - Disparo da geração de **Pautas Anuais Oficiais** para 100% das turmas.
    - Confirmação de que o ano letivo atual não receberá mais alterações de notas/presenças (Hard Lock).
    - Geração do histórico anual consolidado na tabela `historico_anos`.
3.  **Configuração do Ano Novo**: Definição de datas e ativação da nova sessão.
4.  **Simulação (Dry-Run)**: Exibição de um relatório prévio de quantos alunos serão migrados e quantos estão bloqueados por inadimplência/reprovação.
5.  **Execução Suprema**: Acionamento da RPC atômica que processa a virada em uma única transação de banco de dados.

---

## 14. Atualização de Execução (2026-05-10)
Implementado nesta iteração:
- **E2: Alinhamento de Contrato de Dados (Matrículas)**:
  - Refatorados endpoints `/api/escolas/[id]/matriculas/route.ts` e `/novo/route.ts` para usar `session_id`.
  - Corrigidas rotas de onboarding `reassign` e `delete/force` para operar via `session_id`.
  - Eliminadas referências a colunas fantasmas (`matriculas.ano_letivo_id`) e tabelas legadas (`grades`, `courses`).
- **E1: Hardening de Segurança (Anti-Rollback)**:
  - Atualizada RPC `setup_active_ano_letivo` com bloqueio em produção para anos menores que o último ano com movimento.
- **E3: Backfill de Session ID**:
  - Criada migration `20260510000005_backfill_session_ids.sql` para sincronização de turmas e matrículas órfãs.
- **E9: Transporte e Clonagem (Baixa Fricção)**:
  - Criada RPC `clone_academic_structure_v1` (Migration `20260510000008`).
  - Permite espelhamento atômico de: Períodos Letivos, Tabela de Preços (com reajuste %), Turmas e Vínculos de Disciplinas (Professores).
  - Alinhamento de SSOT: Adicionada coluna `session_id` à tabela `financeiro_tabelas`.
- **E11: Motor de Contexto Temporal (Organismo Vivo)**:
  - Criada view `vw_escola_estado_hoje` para determinar fase operacional e bloqueios em tempo real.
  - Implementada trigger de segurança em `frequencias` para impedir lançamentos em feriados/pausas.
- **Evolução de Estratégia**: Definido modelo de **Wizard Guiado** + **RPC Atômica**.
- **Refinamento Pedagógico**: Incluída a **Liquidação de Pautas** como requisito bloqueante para a virada (equivalente ao SSOT financeiro).
- SSOT de saúde da virada centralizado em helper reutilizável:
  - `apps/web/src/lib/operacoes-academicas/cutover-health.ts`
- Endpoint de leitura operacional:
  - `GET /api/secretaria/operacoes-academicas/virada/health`
- Endpoint de simulação:
  - `POST /api/secretaria/operacoes-academicas/virada/dry-run`
- Painel `admin/operacoes-academicas` atualizado com badge `OK|WARN|BLOCKED`.
- Hardening aplicado após revisão:
  - Validações de sessão passam a comparar `escola_id` com `resolvedEscolaId`.
  - Health SSOT deixou de depender de `limit(...)` para contagens operacionais.
  - Falhas técnicas nas queries de health agora bloqueiam o relatório com motivo explícito.
- Ações corretivas ligadas ao painel:
  - correção de `session_id` em turmas/matrículas;
  - correção de mensalidades órfãs de matrícula;
  - realinhamento de competência das mensalidades ao período letivo da escola;
  - publicação de currículos pendentes por classe;
  - geração em lote de pautas anuais oficiais;
  - fechamento anual/snapshot histórico obrigatório.
- RPCs de suporte aplicadas no banco:
  - `remediate_cutover_gaps(p_escola_id, p_action, p_dry_run)`;
  - `cutover_ano_letivo_v3(p_escola_id, p_from_session_id, p_to_session_id)`.
- `cutover_ano_letivo_v3` não move dados históricos para o ano novo; preserva o ano anterior e cria a operação nova por rematrícula, com auditoria `ANO_LETIVO_CUTOVER_V3`.
- Pauta anual em lote corrigida para não depender de `upsert` com `periodo_letivo_id = null`; a escrita anual agora atualiza o registro existente ou insere explicitamente, evitando duplicados silenciosos.
- Pauta anual passa a exigir `periodo_letivo_id` real do ano letivo da turma; a virada só aceita pauta anual se o período pertence ao ano de origem.
- Endpoint genérico de documentos oficiais em lote também resolve o período final para pauta anual, evitando que o worker receba jobs anuais sem período letivo.

Pendências imediatas:
- Resolver blockers reais do piloto KLASSE antes da virada:
  - pautas anuais oficiais pendentes;
  - matrículas sem status final;
  - snapshots/locks históricos pendentes.
- Adicionar testes de integração para a RPC `cutover_ano_letivo_v3` e para os endpoints do wizard.
- Regenerar tipos Supabase após estabilizar as RPCs novas, substituindo wrappers temporários tipados por assinaturas geradas.

## 14.1 Estado operacional validado — KLASSE (2026-05-10)
Validação direta na base usada pelo ambiente de desenvolvimento:
- ano letivo ativo: `2025`;
- períodos letivos configurados no ano ativo: `3`;
- turmas ativas no ano ativo: `30`;
- pautas anuais oficiais pendentes com período correto: `30`;
- matrículas sem status final: `19`;
- snapshots/locks históricos pendentes: `19`.

Conclusão: o SSOT deve bloquear a virada da KLASSE até estes itens serem resolvidos. Isso é o comportamento correto; uma virada que apenas ativa o ano novo sem fechar pauta, aluno e histórico deixa a escola operacionalmente inconsistente.

## Fase 5 — Cockpit de Operações Académicas (Organismo Vivo)
O KLASSE deve evoluir de um repositório de dados para um orquestrador da vida escolar em tempo real, seguindo o calendário do MED.

- **Painel de Controle do Diretor**:
  - **Ação: Gerir Ciclos**: Abrir/Fechar trimestres e períodos de lançamento (ajusta `trava_notas_em`).
  - **Ação: Época de Exames**: Ativação de colunas de exame e bloqueio de avaliações contínuas.
  - **Ação: Pausas Dinâmicas**: Iniciar pausas pedagógicas ou feriados extraordinários com 1 clique.
- **Automação de Diário (Inteligência Temporal)**:
  - Bloqueio automático de lançamentos de faltas/notas em datas marcadas como FERIADO ou PAUSA no `calendario_eventos`.
- **Visibilidade de Estado**: Banner global no Admin indicando o "Momento Atual" (ex: "II Trimestre - Fase de Avaliações").

---

## 15. Épico E11: Motor de Contexto Temporal
Implementar a lógica de inteligência que diz ao sistema o que está acontecendo "Hoje".

- **View `vw_escola_estado_hoje`**: Consolida o ano ativo, o período letivo vigente e se há eventos de interrupção ativos.
- **Trigger de Diário**: Impedir fraude ou erro humano de lançar aulas em dias de interrupção pedagógica.

---

## 16. Atualização de Execução (2026-05-10)
... (mantendo histórico anterior) ...
- **Evolução de Visão**: O sistema passa a ser tratado como um **Organismo Vivo**, onde as datas do calendário ditam o comportamento das UIs e permissões de escrita (Cockpit de Operações Académicas).
