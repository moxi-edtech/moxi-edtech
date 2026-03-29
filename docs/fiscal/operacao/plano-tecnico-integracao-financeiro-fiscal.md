# Plano Técnico — Integração Financeiro → Fiscal (KLASSE)

## Objetivo
Garantir que todos os processos financeiros da escola que geram obrigação fiscal passem pelo motor fiscal, com rastreabilidade completa e sem dupla emissão.

## Estado de implementação (2026-03-29)
1. Implementado: adapter único `apps/web/src/lib/fiscal/financeiroFiscalAdapter.ts`.
2. Implementado: regra Fase 1 para pagamentos diretos -> emissão `FR` (`immediate_payment`).
3. Implementado: fallback fiscal obrigatório de cliente final (`999999999` / `Consumidor final`) no adapter.
4. Implementado: integração inicial do adapter em:
5. `/api/financeiro/pagamentos/registrar`
6. `/api/financeiro/itens/venda`
7. `/api/financeiro/recibos/emitir`
8. Implementado: persistência inicial de vínculo em `financeiro_fiscal_links` para emissões com sucesso.
9. Implementado: status fiscal em `pagamentos`/`mensalidades` (`pending|ok|failed`) para fluxos integrados.
10. Implementado: migration `20270324113000_financeiro_fiscal_links_and_status.sql` aplicada no Supabase remoto.
11. Pendente: completar lock transacional por origem com mecanismo explícito de bloqueio antes da emissão.
12. Pendente: backfill controlado com dry-run e reconciliação final.

## Escopo prioritário
1. Mensalidades/propinas pagas.
2. Matrículas/inscrições cobradas.
3. Vendas avulsas (itens/serviços).
4. Retificação/anulação de documentos.
5. Fecho mensal com SAF-T consistente.

## Estado atual (gaps)
1. Fluxo fiscal já existe via `/api/fiscal/documentos`.
2. Há fluxos paralelos no financeiro fora do motor fiscal:
3. `/api/financeiro/recibos/emitir`
4. `/api/financeiro/itens/venda`

## Arquitetura alvo
1. Todo evento financeiro elegível cria documento fiscal por adapter único.
2. Adapter fiscal usa a API fiscal existente (não duplica regra fiscal no financeiro).
3. Persistir vínculo de origem financeira ↔ documento fiscal.
4. Fluxo idempotente por chave de negócio.
5. Falha fiscal não perde evento financeiro: enfileira retry e mantém estado `pendente_fiscal`.
6. Fluxo financeiro só é considerado completo com `status_fiscal = ok`.

## Regra crítica
1. Nenhum documento fiscal pode ser gerado fora do adapter fiscal.
2. Emissão direta fora do fluxo adapter é considerada inválida para operação e auditoria.

## Workstreams

### WS1 — Contrato de mapeamento financeiro-fiscal
1. Definir matriz oficial:
2. Regra determinística obrigatória:
3. Se pagamento imediato no ato -> `FR`.
4. Se pagamento posterior -> `FT` na obrigação + `RC` na liquidação.
5. `venda avulsa` segue a mesma regra determinística.
6. `estorno` -> `NC/ND/anulação` correspondente.
7. Definir `payment_mechanism` obrigatório para `RC`.

### WS2 — Camada de integração (adapter)
1. Criar serviço único em `apps/web/src/lib/fiscal/financeiroFiscalAdapter.ts`.
2. Esse serviço monta payload e chama `/api/fiscal/documentos` (ou RPC fiscal via server client, mantendo semântica atual).
3. Contrato obrigatório de estratégia:

```ts
tipoFluxoFinanceiro: "immediate_payment" | "deferred_payment"
```

4. Fase 1 (obrigatória agora): pagamentos diretos devem emitir `FR`.
5. Preparação futura obrigatória: suportar `FT -> RC` sem refactor estrutural.
6. Garantir fallback para cliente final quando o pagador não tiver dados fiscais válidos.
7. Se NIF ausente, vazio ou inválido, injetar `nif = 999999999` e `nome = Consumidor final` antes de chamar a API fiscal.
8. Impedir envio de payload fiscal com NIF inválido para evitar falhas permanentes na fila de retry.
9. Retornar `documento_id`, `numero_formatado`, `hash_control`, `key_version`.
10. Capturar `payload_snapshot` (jsonb) exatamente como enviado ao motor fiscal.

### WS3 — Persistência de vínculo e idempotência
1. Criar tabela `financeiro_fiscal_links`.
2. Campos mínimos:
3. `escola_id`, `empresa_id`, `origem_tipo`, `origem_id`, `fiscal_documento_id`, `status`, `idempotency_key`, `payload_snapshot`, `created_at`.
4. Constraints:
5. `UNIQUE(origem_tipo, origem_id)` para impedir dupla emissão.
6. `UNIQUE(idempotency_key)` para retries seguros.
7. `payload_snapshot jsonb NOT NULL` para rastreabilidade forense.

### WS4 — Refactor de endpoints financeiros
1. Alterar `/api/financeiro/recibos/emitir` para usar adapter fiscal.
2. Alterar `/api/financeiro/itens/venda` para usar adapter fiscal.
3. Manter compatibilidade de resposta para o frontend atual.
4. Registrar auditoria com `origem_financeira_id` e `fiscal_documento_id`.
5. Aplicar lock de emissão por origem antes da chamada fiscal:
6. `SELECT ... FOR UPDATE` no registro de origem ou lock lógico por `origem_id`.

### WS5 — Operação assíncrona e resiliência
1. Se fiscal falhar, criar job `financeiro/fiscal-sync.requested` (Inngest) para retry.
2. Expor status no financeiro: `fiscal_status = pending|ok|failed`.
3. Criar tela operacional de reconciliação de pendências fiscais.
4. Regra de negócio: operação financeira encerrada apenas quando `fiscal_status = ok`.

### WS6 — Backfill controlado
1. Migrar histórico recente (janela acordada, ex.: últimos 90 dias).
2. Executar apenas com filtro estrito:
3. `WHERE fiscal_documento_id IS NULL` e sem vínculo prévio em `financeiro_fiscal_links`.
4. Não reemitir documentos já fiscalizados.
5. Executar `dry-run` obrigatório antes de qualquer escrita.
6. Relatório de divergência: financeiro sem fiscal, fiscal sem origem, duplicados.

## Migrações de banco (propostas)
1. Nova tabela `financeiro_fiscal_links`.
2. Índices por `escola_id`, `empresa_id`, `origem_tipo`, `status`.
3. FK para `fiscal_documentos(id)`.
4. `payload_snapshot jsonb NOT NULL` em `financeiro_fiscal_links`.
5. Colunas obrigatórias de estado fiscal em `pagamentos`/`mensalidades`:
6. `status_fiscal` (`pending|ok|failed`), `fiscal_documento_id` nullable, `fiscal_error` nullable.

## Rollout
1. Fase A: feature flag por escola (`fiscal_adapter_enabled`).
2. Fase B: canário em 1 escola piloto.
3. Fase C: ativação progressiva por lote.
4. Fase D: bloquear fluxo legado (hard cutover).

## Critérios de sucesso (GO)
1. 100% dos novos eventos elegíveis geram vínculo em `financeiro_fiscal_links`.
2. 0 casos de dupla emissão por origem.
3. RC sempre com `payment_mechanism`.
4. SAF-T do período bate com movimentos financeiros fiscalizáveis.
5. Painel de pendências fiscais zerado ou dentro de SLO acordado.
6. Nenhum documento fiscal sem vínculo em `financeiro_fiscal_links`.
7. `payload_snapshot` persistido para 100% das emissões integradas.
8. Todos os pagamentos/mensalidades com estado fiscal explícito.

## Riscos e mitigação
1. Dupla emissão por corrida concorrente -> lock de origem + constraints + idempotência.
2. Divergência financeiro x fiscal -> `status_fiscal` explícito + reconciliação diária automatizada.
3. Perda de rastreabilidade do evento original -> `payload_snapshot` obrigatório.
4. Queda de KMS/fiscal -> fila de retry + estado `pendente_fiscal` visível.
5. Mudança de UX -> manter resposta compatível e migração gradual por flag.

## Primeiro sprint recomendado
1. Fechar matriz de mapeamento (WS1).
2. Criar `financeiro_fiscal_links` + constraints (WS3).
3. Implementar adapter e integrar `recibos/emitir` (WS2 + WS4 parcial).
4. Entregar dashboard mínimo de pendências fiscais (WS5 parcial).
