# GO_LIVE_CHECKLIST.md — Pilot Readiness (3–5 escolas)

## 🔴 P0 — Segurança, Multi-Tenant, Integridade (BLOCKER)

### Core DB
- Todas as tabelas críticas com escola_id NOT NULL.
- Índice composto começando por escola_id nas tabelas grandes (alunos, turmas, matriculas, financeiro_*).
- Constraints anti–cross-tenant:
  - FK com MATCH FULL quando necessário.
  - Triggers que bloqueiam updates cross-tenant.
- RLS ativo em todas as tabelas acessadas por humanos:
  - secretaria
  - professor
  - admin_escola
  - alunoz
- Service Role NUNCA acessa endpoints humanos.

### Integridade Temporal
- created_at, updated_at, ano_letivo consistentes.
- UNIQUE(aluno_id, ano_letivo, escola_id) garantindo uma matrícula ativa por ano.

---

## 🔴 P1 — Fluxo Crítico End-to-End (Admissão + Matrícula + Financeiro)

### Admissão
- admissao_upsert_draft funcionando e idempotente.
- admissao_submit trava edição e envia para aprovação.
- Secretaria não converte — apenas valida e envia.

### Financeiro (pré-matrícula)
- Inbox lista candidaturas AGUARDANDO_PAGAMENTO ou APROVADA_SECRETARIA.
- Confirmação de pagamento cria selo financeiro:
  - financeiro_validacoes (ou financeiro_aprovado_at).
  - UNIQUE(candidatura_id) → evita duplo-click.
- Transações manuais são idempotentes por:
  - transacao_id_externo
  - ou dedupe_key

### Conversão para Matrícula
- RPC admissao_convert_to_matricula com:
  - Gate obrigatório: somente se houver selo financeiro.
  - Checagem de idempotência por converted_at ou UNIQUE em matriculas(candidatura_id).
  - Criação de matrícula limpa.
  - Retorno consistente mesmo em “replay”.

### Financeiro Boot
- Geração automática do “Kit financeiro” da matrícula:
  - Taxa de matrícula (se configurada).
  - Mensalidade do mês corrente.
  - Regra clara para retroativos.
- Caso Wizard tenha pagamento inserido:
  - gerar cobrança → marcar como paga → criar recibo.

---

## 🔴 P2 — Operação Diária do Portal (Secretaria + Professores)

### Presença / Frequência
- SSOT definido (qual tabela é verdade única).
- Estrutura com partição: UNIQUE(aluno_id, data) ou UNIQUE(matricula_id, aula_id) conforme modelo final.
- Views ou RPC para relatórios por turma → eficientes.
  - `vw_presencas_por_turma`
  - `vw_frequencia_resumo_aluno`
  - `professor_list_presencas_turma(p_turma_id, p_data_inicio, p_data_fim)`

### Disciplinas
- Turma possui vínculo com matriz → disciplinas carregadas automaticamente.
- Aluno NÃO precisa vincular disciplina manualmente.
- Todas as telas que listam disciplinas usam:
  - matriculas → turma → turma_disciplinas

### Notas
- Período letivo oficial (piloto Angola):
  - tipo = TRIMESTRE
  - valores: 1 | 2 | 3
  - escopo por escola + ano_letivo (2025)
- Avaliações (on-demand):
  - UNIQUE(escola_id, turma_disciplina_id, ano_letivo, trimestre, tipo)
  - Uma avaliação por disciplina + trimestre
- Notas (on-demand):
  - UNIQUE(escola_id, matricula_id, avaliacao_id)
  - Sem placeholders; INSERT só no lançamento do professor
- Sem placeholders: não criar linhas vazias na tabela notas.
- Pauta do professor lista alunos por matriculas.
- Primeira nota lançada → INSERT on-demand na tabela notas.
  - upsert por `(matricula_id, avaliacao_id)`
  - avaliação criada on‑demand (turma_disciplina_id + periodo_letivo_id + nome)
- Views para boletins:
  - `vw_boletim_por_matricula`
  - `missing_count` + `has_missing` quando faltar nota

---

## 🟡 P3 — Crescimento e Escalabilidade
- Endpoint de transferência de turma:
  - Checa vagas
  - Checa conflitos
  - Ajuda financeiro com ajuste pró-rata
  - Auditado
- Importação CSV idempotente por:
  - chave hash
  - ou aluno_id deduplicado
- Aprovação de importação:
  - somente admin
  - idempotente com optimistic lock

---

## 🟢 Eventos / Outbox (Mínimo Viável)
- AUTH_PROVISION_USER
  - inclui escola_id, role, user_id
- FINANCE_PAYMENT_CONFIRMED
  - inclui pagamento_id, escola_id, timestamp
- Todos eventos com:
  - dedupe_key
  - retry_count
  - payload validado

---

## 🟢 Observabilidade / Auditoria
- Log de ações de secretaria (update, aprovações).
- Log financeiro (pagamentos, transferências).
- Log de conversão (matrícula criada / replay).
- Log de documentos emitidos (declarações, recibos).
- Em caso de erro → stack detalhado, mas sem vazar dados sensíveis.

---

## 🟢 Admin / Super Admin (produção real)
- Confirmação de billing
- Dashboard funcionando sem N+1 queries
- Relatórios de onboarding
- Limpeza do cache incremental (paginação, filtros)

---

## 💚 Go-Live Gate — Só liberamos piloto quando:
- Matrícula end-to-end testada 3x (secretaria → financeiro → converte → financeiro boot).
- Lançamento de notas funcionando com 2 professores diferentes.
- Views de boletim e presença batem com registros.
- PDF de declaração de matrícula, frequência e ficha OK.
- Transferência de turma validada.
- Importação CSV testada com escola real.
- Auditoria revisada por você + logs limpos.
- Zero erro 500 no fluxo.