# Handoff — Certificação Fiscal AGT / BILL-009 em diante

Data: 2026-09-27  
Repositório: `moxi-edtech/moxi-edtech`  
Branch de continuação: `fix/bill-009-tax-engine-vat`  
Head no momento do handoff: `dd85913f2120a34320a2f9ecaad5e95075bfc09b`

## Objetivo

Continuar o fechamento técnico dos gaps fiscais do KLASSE para preparação de certificação/homologação AGT em Angola.

Não declarar o KLASSE “certificado” enquanto não houver evidência externa real da AGT. O objetivo dos BILLs é deixar código, banco, segurança, documentos e testes prontos para homologação e produzir evidência reproduzível.

A fonte canónica do estado é:

`docs/fiscal/certificacao/backlog-certificacao-agt.md`

Este handoff explica como continuar sem reabrir decisões já validadas.

---

## Stack actual dos PRs

Os trabalhos estão empilhados, não independentes:

- PR #118 — BILL-001–005 — `fix(fiscal): close BILL-001–005 hardening blockers`
- PR #119 — BILL-006 — Facturação Electrónica AGT/outbox
- PR #120 — BILL-007 — pagamentos/ledger/RC
- PR #121 — BILL-008 — SAF-T(AO) semântico
- BILL-009 continua em `fix/bill-009-tax-engine-vat`

Os PRs #118–121 estão abertos e foram criados em sequência. Não perder essa ordem ao fazer merge/rebase.

---

## Estado dos BILLs

- BILL-001 — CLOSED
- BILL-002 — CLOSED
- BILL-003 — CLOSED
- BILL-004 — CLOSED
- BILL-005 — READY FOR HOMOLOGATION
- BILL-006 — READY FOR HOMOLOGATION
- BILL-007 — CLOSED
- BILL-008 — READY FOR HOMOLOGATION para SAF-T Facturação (`TaxAccountingBasis=F`)
- BILL-009 — NEEDS WORK / EM CURSO
- BILL-010 — BACKLOG
- BILL-011 — BACKLOG
- BILL-012 — BACKLOG
- BILL-013 — BACKLOG
- BILL-014 — BACKLOG

BILL-005, BILL-006 e BILL-008 só devem virar CLOSED depois da evidência externa prevista no BILL-013.

---

## Invariantes que NÃO podem ser quebrados

1. Documento fiscal emitido é imutável. Não resolver bugs alterando/apagando documentos emitidos.
2. Itens fiscais e eventos são append-only.
3. Numeração fiscal é reservada atomicamente no banco.
4. Série de produção FE deve estar provisionada pela AGT.
5. Emissão usa um único contrato `fiscal_emitir_documento`.
6. Documento nasce `pendente_assinatura` e a assinatura é finalizada no backend.
7. A integração AGT é assíncrona:
   `emitido -> outbox -> registarFactura -> requestID -> obterEstado -> V/I`.
8. O mesmo documento fiscal não recebe uma nova identidade de submissão por timeout/retry.
9. Pagamento é aplicado por RPC canónica/idempotente.
10. Ledger, alocações, reversões e estornos preservam histórico.
11. RC deriva das alocações reais e usa `paymentReceipt.sourceDocuments`; RC não inventa linhas fiscais.
12. Pagamento parcial exige FT/ND fiscal de origem.
13. Reversão financeira de pagamento fiscalizado é fail-closed até o ciclo documental ser resolvido no BILL-010.
14. SAF-T não “corrige” documento histórico silenciosamente.
15. SAF-T Facturação é suportado; SAF-T Contabilidade C/I não deve ser declarado sem plano de contas + razão contabilístico real.
16. Alterações de banco devem entrar via migration e o mesmo SQL deve existir no Git.
17. Testes contra dados reais devem ser rollback-only quando houver risco de produzir documento/estado financeiro.
18. Nunca expor chave privada fiscal, secret, credential AGT ou KMS material para client/browser.

---

## Arquitectura fiscal actual

Fluxo principal:

`financeiro/catalogo/mensalidade -> pagamento -> alocação financeira -> fiscal_emitir_documento -> fiscal_documentos + fiscal_documento_itens -> assinatura -> emitido -> AGT outbox -> registarFactura -> obterEstado`

Para pagamento diferido:

`FT/ND -> pagamento -> financeiro_pagamento_alocacoes -> RC -> financeiro_recibo_alocacoes -> paymentReceipt.sourceDocuments -> AGT`

SAF-T:

`fiscal_documentos + fiscal_documento_itens + eventos + séries -> saftAo.ts -> validação semântica -> XSD AO 1.01_01 -> storage privado -> fiscal_saft_exports`

O SAF-T possui cadeia de hash própria quando o software estiver validado; não reutilizar a assinatura JWS/RSA-2048 da Facturação Electrónica como campo `Hash` do SAF-T.

---

## BILL-009 — estado REAL no momento do handoff

O BILL-009 NÃO está vazio.

Branch:

`fix/bill-009-tax-engine-vat`

Migrations já aplicadas no Supabase vivo e presentes no branch:

- `20260927181109_bill_009_tax_profiles_and_item_semantics.sql`
- `20260927181334_bill_009_financial_catalog_tax_profiles.sql`
- `20260927181708_bill_009_tax_compute_function.sql`
- `20260927181922_bill_009_wire_tax_engine_to_emitter.sql`
- `20260927182435_bill_009_catalog_fiscal_classification.sql`
- `20260927182915_bill_009_tuition_tax_profile_default.sql`
- `20260927183018_bill_009_preserve_reserved_agt_invoice_no.sql`

Arquivos relevantes já criados/alterados:

- `apps/web/src/lib/fiscal/taxProfiles.ts`
- `apps/web/src/lib/fiscal/agtInvoicePayload.ts`
- `apps/web/src/lib/fiscal/saftAo.ts`
- `apps/web/src/lib/fiscal/financeiroFiscalAdapter.ts`
- catálogo/tabelas financeiras
- `apps/web/tests/unit/agt-tax-engine.spec.ts`

Perfis actualmente definidos:

- `IVA_EDUCACAO_M21`
- `IVA_NORMAL_14_AO`

O perfil `IVA_EDUCACAO_M21` representa serviço de ensino isento, com código M21.
O perfil `IVA_NORMAL_14_AO` representa IVA normal 14%.

---

## Motor tributário já implementado

Existe a tabela `fiscal_tax_profiles`, versionada por `code + version`, com:

- tipo de imposto;
- TaxCode;
- região;
- percentagem;
- código/motivo de isenção;
- operationType;
- vigência `valid_from/valid_to`;
- referência legal;
- metadata.

Itens fiscais ganharam semântica canónica persistida:

- `tax_profile_code`
- `tax_type`
- `tax_code`
- `tax_country_region`
- `operation_type`
- `unit_of_measure`
- `product_type`
- `unit_price_base`
- `settlement_amount`
- totais na moeda do documento
- totais AOA

Existe `fiscal_tax_compute_document(...)`.

Essa função actualmente:

- exige `tax_profile_code`;
- resolve a versão válida pela data da factura;
- rejeita taxCode/taxa explícitos divergentes do perfil;
- valida isenção;
- valida desconto/settlement contra `quantity * (unitPriceBase - unitPrice)`;
- calcula totais;
- converte moeda estrangeira para AOA;
- aplica as funções de arredondamento do motor;
- actualmente calcula apenas IVA e rejeita outros tipos percentuais de imposto como não implementados.

`fiscal_emitir_documento` já usa esse motor antes de persistir as linhas.

O mapper AGT e o SAF-T foram alterados para consumir a semântica persistida em vez de reinterpretar a tributação depois.

O catálogo financeiro já começa a carregar `tax_profile_code`, classificação bem/serviço e código de produto estável.

---

## Evidência de testes BILL-009 já existente

Arquivo:

`apps/web/tests/unit/agt-tax-engine.spec.ts`

Cenários já cobertos:

- M21 educação isenta;
- IVA normal 14%;
- desconto com `unitPriceBase`, `unitPrice` e `settlementAmount`;
- moeda estrangeira + contravalor AOA;
- rejeição de linha sem perfil tributário canónico.

Não assumir que isso fecha o BILL-009. Ainda é necessário provar o motor no banco, os callers e os casos-limite abaixo.

---

## Próximo trabalho — BILL-009

### 1. Validar a tabela fiscal versionada

Verificar e corrigir, se necessário:

- sobreposição temporal de versões do mesmo `code`;
- impedir duas versões válidas simultaneamente para a mesma data;
- impedir UPDATE/DELETE de perfis que já foram usados por documento fiscal;
- definir forma segura de encerrar uma versão e abrir outra;
- grants/RLS/SECURITY DEFINER;
- quem pode criar perfis: não deixar operador escolar inventar tributação legal;
- preservar `legal_reference` e `legal_source_url`.

### 2. Confirmar matriz tributária contra fontes AGT/MinFin actuais

Não assumir que os únicos casos são M21 e 14%.

Pesquisar fontes oficiais e construir matriz:

`tax_type + tax_code + rate + exemption_code + operation_type + product_type + effective dates`.

Se um imposto/taxa não for aplicável ao KLASSE hoje, documentar como NOT APPLICABLE ou fail-closed. Não implementar por especulação.

### 3. Rounding oracle

Validar exactamente as regras usadas em:

- FT/FR/ND;
- NC;
- taxContribution;
- unit price;
- settlement;
- moeda estrangeira.

Criar casos com casas decimais difíceis, ex.:

- 1 x 33.3333;
- 3 x 33.3333;
- IVA com resultado x.xx5;
- NC com os mesmos números;
- FX com taxa não inteira.

O resultado esperado deve vir da especificação AGT, não de intuição.

### 4. Descontos

Validar:

- desconto unitário;
- desconto de linha;
- eventual desconto global;
- `unitPriceBase`;
- `unitPrice`;
- `settlementAmount`;
- reconciliação:
  `quantity * unitPrice -> net`;
- AGT payload e SAF-T devem carregar a mesma semântica.

Se desconto global não existir no produto, não fingir suporte; bloquear ou documentar.

### 5. FX

Provar:

- moeda AOA não aceita taxa de câmbio arbitrária;
- moeda != AOA exige taxa > 0;
- totais da moeda original;
- contravalor AOA;
- mapper AGT;
- SAF-T;
- arredondamento após conversão;
- retry/idempotência não recalcula usando outra taxa.

Ideal: taxa utilizada fica persistida no documento e nunca depende de valor externo posterior.

### 6. Isenções

Garantir:

- perfil isento exige TaxCode ISE;
- percentagem zero;
- código Mxx válido;
- motivo;
- perfil tributável rejeita exemption code;
- o item persistido carrega exactamente o snapshot do perfil usado.

### 7. Goods vs services / operationType

Garantir que:

- propina/ensino -> serviço + operationType coerente;
- venda de bem -> ProductType P e operação de bens;
- catálogo não permite combinação impossível;
- o mesmo ProductCode não muda de identidade fiscal entre documentos;
- SAF-T MasterFiles e AGT payload vêm do mesmo snapshot.

### 8. Retenções e outros impostos

O motor hoje falha para percentuais fora de IVA.

Antes de implementar IS/IEC/CEOC/etc.:

- confirmar se existem cenários realmente aplicáveis às operações escolares do KLASSE;
- confirmar como a API AGT actual os representa;
- implementar apenas com fonte oficial e teste oracle.

Se não aplicável: manter fail-closed e documentar.

### 9. Backfill/histórico

NÃO alterar silenciosamente itens de documentos emitidos.

Para linhas antigas sem perfil fiscal completo:

- diagnosticar;
- separar histórico legado de documentos novos;
- preferir cutover/compatibility layer;
- qualquer correcção documental pertence ao BILL-010 se exigir mudança de documento fiscal já emitido.

### 10. Testes obrigatórios para fechamento

No mínimo:

- perfil M21;
- IVA 14%;
- combinação taxCode/rate inválida;
- perfil vencido;
- overlap de vigência;
- desconto;
- FX;
- NC rounding;
- FT/FR rounding;
- consumidor final;
- goods/service classification;
- mapper AGT;
- SAF-T;
- rollback-only no banco;
- idempotência;
- advisors de segurança/performance.

---

## Critério de fechamento do BILL-009

Só marcar CLOSED quando:

1. todas as emissões novas passam pelo motor canónico;
2. nenhum caller calcula IVA por conta própria;
3. perfil tributário usado fica persistido no item;
4. versões tributárias são historicamente reproduzíveis;
5. combinações inválidas são bloqueadas no banco;
6. descontos e FX reconciliam entre banco, AGT e SAF-T;
7. arredondamentos têm testes oracle;
8. produtos/serviços têm classificação fiscal estável;
9. histórico emitido não é mutado;
10. security/performance advisors foram revistos;
11. migrations live e Git estão sincronizadas;
12. backlog canónico é actualizado com evidência real.

---

## Depois do BILL-009

### BILL-010 — ciclo documental

Prioridades já descobertas:

- NC/ND e referências;
- rejeição AGT;
- anulação;
- contingência;
- documentos recuperados;
- desbloquear reversão financeira após tratamento fiscal;
- investigar documentos históricos `tipo_documento='FT'` com número `FR-...`;
- tratar os 98 documentos comerciais históricos fora do formato canónico;
- tratar os 8 RC históricos sem `paymentReceipt.sourceDocuments`.

Nunca “corrigir” esses documentos com UPDATE directo.

### BILL-011 — segurança fiscal

Auditar RLS, grants, SECURITY DEFINER, storage, KMS refs e cross-tenant.

### BILL-012 — observabilidade

DLQ, replay, métricas, alertas e correlação local/AGT.

### BILL-013 — homologação

Só aqui fechar:

- série AGT real;
- `solicitarSerie`;
- `registarFactura`;
- `requestID`;
- `obterEstado`;
- V/I;
- SAF-T no validador/portal;
- fixtures FT/FR/NC/ND/RC/isenção/FX;
- evidências sanitizadas.

### BILL-014 — governance/go-live

Retenção, rotação de chaves, backup, procedimento operacional, dossiê e GO/NO-GO.

---

## Método de trabalho obrigatório

Para cada BILL:

1. Fazer discovery antes de alterar.
2. Ler banco vivo e código; não confiar só em docs antigos.
3. Para Supabase, usar migration para DDL.
4. Se migration já está live, versionar exactamente o mesmo SQL no Git — não reaplicar.
5. Preferir invariantes no banco a validação apenas na UI.
6. Usar fail-closed para estado fiscal ambíguo.
7. Fazer testes rollback-only para cenários reais.
8. Guardar evidência: função/tabela/migration/arquivo/commit.
9. Rodar unit/fiscal/security tests e advisors.
10. Distinguir regressão do BILL de falha preexistente do monorepo.
11. Actualizar `backlog-certificacao-agt.md` no mesmo PR.
12. Só depois mudar o estado do BILL.

---

## Limitações de CI conhecidas

O repositório possui falhas que não devem ser automaticamente atribuídas ao BILL corrente:

- Vercel tem apresentado `build-rate-limit`;
- KF2 Search Audit possui findings históricos de LIMIT/ORDER BY em outras áreas.

Sempre comparar o resultado com o branch-base antes de classificar como regressão.

---

## Instrução curta para continuar

Comece em:

`fix/bill-009-tax-engine-vat`

Não recrie BILL-009 do zero.

Primeiro execute:

- diff branch vs BILL-008;
- migrations BILL-009 Git vs Supabase live;
- testes fiscais existentes;
- advisors;
- search de todos os callers que calculam `taxa_iva`, `tax_code`, `tax_exemption_code`, `settlement_amount`, `unit_price_base` e `taxa_cambio_aoa`.

Depois feche os gaps do BILL-009 segundo os critérios acima.

Se durante o trabalho surgir requisito de alterar um documento fiscal já emitido, pare esse caminho e mova-o para BILL-010. Não mutar histórico para fazer teste passar.
