# Plano de Implementação: Ledger Financeiro Central (SSOT)

**Status:** Produção completa (leitura e escrita ativas; portal do aluno e dashboard admin integrados; checkout de balcão unificado)  
**Contexto:** K12 (Escolar)  
**Objetivo:** Transitar de um modelo financeiro baseado em estados para um modelo baseado em transações (Livro Razão).

---

## 1. Justificativa Estratégica
Atualmente, a "verdade financeira" do aluno está dispersa entre `mensalidades`, `pagamentos`, `financeiro_lancamentos` e `servico_pedidos`. Isso causa:
- **Cálculo Lento:** A inadimplência é calculada somando/subtraindo estados em tempo real.
- **Divergência Fiscal:** Dificuldade em reconciliar o que foi faturado vs. o que é devido.
- **Falta de Histórico Temporal:** Não é possível saber o saldo exato de um aluno em uma data retroativa de forma performática.

## 2. Nova Estrutura de Dados (Foundation)

### 2.1 Tabela `public.financeiro_ledger`
Uma tabela imutável (append-only) que registra todo movimento de débito (geração de dívida) e crédito (liquidação).

```sql
CREATE TABLE public.financeiro_ledger (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    escola_id uuid NOT NULL REFERENCES public.escolas(id),
    aluno_id uuid NOT NULL REFERENCES public.alunos(id),
    
    -- Natureza
    tipo public.financeiro_tipo_transacao NOT NULL, -- 'debito' | 'credito'
    origem public.financeiro_origem NOT NULL, -- 'mensalidade', 'matricula', 'venda_avulsa', 'estorno', 'ajuste'
    
    -- Rastreabilidade (Links)
    referencia_tabela text NOT NULL, -- ex: 'mensalidades', 'pagamentos'
    referencia_id uuid NOT NULL,
    tipo_evento text NOT NULL, -- ex: 'criado', 'liquidado', 'estornado', 'cancelado', 'ajuste_valor'
    versao_evento int NOT NULL DEFAULT 1, -- permite múltiplos eventos legítimos na mesma referência
    event_key text NOT NULL, -- hash/chave idempotente do evento de origem

    -- Financeiro
    valor numeric(14,2) NOT NULL,
    saldo_apos_movimento numeric(14,2), -- opcional: snapshot assíncrono (não fonte primária)
    
    -- Tempo
    data_competencia date NOT NULL, -- Mês/Ano que a cobrança se refere
    data_movimento timestamptz NOT NULL DEFAULT now(),
    
    -- Metadados
    descricao text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now()
);

-- Idempotência forte por evento, não apenas por referência
CREATE UNIQUE INDEX ux_financeiro_ledger_event_key
  ON public.financeiro_ledger(event_key);

-- Ordenação determinística para extrato/saldo por aluno
CREATE INDEX ix_financeiro_ledger_aluno_movimento
  ON public.financeiro_ledger(escola_id, aluno_id, data_movimento, id);
```

## 3. Estratégia de Implementação: "Shadow Writing"
Para garantir que a operação não pare, usaremos **Database Triggers**. Isso permite que as RPCs e Endpoints atuais continuem funcionando sem alterações no código TypeScript/SQL existente.

### Fase 1: Sincronização Automática
1. **Trigger em `mensalidades`**:
   - `INSERT`: Cria um `debito` no Ledger.
   - `UPDATE` (valor): Cria um `debito` ou `credito` de ajuste.
2. **Trigger em `pagamentos`**:
   - `UPDATE` (status = 'settled'): Cria um `credito` no Ledger.
   - `UPDATE` (reversão/estorno/cancelamento): Cria movimento compensatório (`debito`) no Ledger.
   - Mudança repetida de status deve ser idempotente por `event_key`.
3. **Trigger em `financeiro_lancamentos`**:
   - `INSERT` (vendas avulsas): Cria o registro correspondente.

### Fase 1.1: Emissão Automática de Recibo (Back-end)
1. **Trigger em `pagamentos` para outbox**:
   - Em `INSERT/UPDATE` com `status IN ('settled','concluido')`, enfileirar evento `financeiro_recibo_pagamento`.
   - Deduplicação por `dedupe_key/idempotency_key` baseada em `pagamento_id`.
2. **Worker de outbox**:
   - Consumir `financeiro_recibo_pagamento`.
   - Gerar `documentos_emitidos` tipo `recibo` de forma idempotente.

### Fase 1.2: Unificação do Flow de Balcão (Checkout Atômico)
1. [x] **Consolidação de Endpoints**: O endpoint `/api/financeiro/pagamentos/registrar` agora retorna os dados fiscais (recibo) no mesmo request do registro.
2. [x] **Otimização de UI**: `ModalPagamentoRapido` agora realiza apenas uma chamada de rede, disparando a impressão do recibo imediatamente com os dados do Ledger.
3. [x] **Integridade Garantida**: Redução de race conditions e timeouts entre o registro financeiro e a emissão documental.

### Fase 2: Backfill do Histórico
Execução de um script de migração para povoar o Ledger com os dados retroativos (ex: converter as 222 mensalidades da Escola KLASSE em 222 débitos no Ledger).

### Fase 3: Migração de Leitura (UI/API)
1. [x] **Extrato Unificado (Secretaria)**: `/api/financeiro/extrato/aluno/[alunoId]` agora lê 100% da `financeiro_ledger`.
2. [x] **Portal do Aluno (UI & API)**: `/api/aluno/financeiro` atualizado com movimentos do Ledger e timeline visual no componente `TabFinanceiro`.
3. [x] **Dashboard Admin (API)**: Criado `/api/financeiro/dashboard/saldo-consolidado` para KPIs globais da escola baseados no Ledger.

### Fase 4: Reconciliação e Cutover Controlado
1. [x] **View de Reconciliação**: `vw_financeiro_reconciliacao_ledger` criada e validada.
2. [x] **Validação Piloto**: 169 alunos auditados com **0.00 de discrepância**.
3. [x] **Cutover de Leitura**: Aplicado em extratos e portal do aluno.

## 4. Riscos e Mitigações

| Risco | Mitigação |
|---|---|
| Duplo Lançamento | Idempotência por `event_key` com `UNIQUE INDEX`, suportando múltiplos eventos legítimos por referência. |
| Divergência por reversão | Triggers tratam `settled`, `estornado`, `cancelado` e geram movimentos compensatórios. |
| Performance de Escrita | Trigger `AFTER` ainda impacta a transação; monitorar latência e migrar para fila assíncrona se p95 degradar. |
| Divergência de Saldo | Criação de uma View de Reconciliação para monitorar discrepâncias Ledger vs. Legado. |

## 5. Estado Atual e Próximos Passos
### 5.1 Já implementado no repositório
1. [x] Foundation do ledger criada em migration dedicada.
2. [x] Idempotência por `event_key` + índices de leitura temporal.
3. [x] Triggers de sincronização para `mensalidades`, `pagamentos` e `financeiro_lancamentos`.
4. [x] Backfill inicial do ledger executado.
5. [x] **Endpoint de Extrato Migrado**: `/api/financeiro/extrato/aluno/[alunoId]` agora é SSOT.
6. [x] **Portal do Aluno Migrado**: `/api/aluno/financeiro` + UI `TabFinanceiro` com timeline visual.
7. [x] **Checkout Atômico**: Unificação de registro + recibo em uma única transação no balcão.

### 5.2 Já aplicado em produção (2026-05-10)
1. [x] Migrations aplicadas no banco remoto.
2. [x] Triggers ativos e sincronizando em tempo real.
3. [x] **Reconciliação Validada**: 169 alunos auditados sem erros.

### 5.3 Pendências para operação controlada
1. [ ] Monitorar latência p95 no balcão após unificação.
2. [ ] Substituir gradualmente as views legadas (`vw_financeiro_kpis_mes`, etc) pelo novo Ledger.
3. [ ] Implementar página de validação pública (`/v/[hash]`) vinculada ao Ledger ID.

---
**Elaborado por:** Gemini CLI Agent  
**Data:** 2026-05-10
