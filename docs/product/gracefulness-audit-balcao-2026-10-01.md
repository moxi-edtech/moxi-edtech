# Gracefulness Audit — Balcão de Atendimento

**Status:** baseline canônico de auditoria  
**Data:** 2026-10-01  
**Escopo:** `/secretaria/balcao` e fluxos diretamente acionados pelo Balcão  
**Método:** leitura do código na `main` + inspeção read-only do schema, funções, índices e RLS do Supabase  
**Commit de referência da auditoria:** `5f09ed3ac6766544bb71e4848b69fe462a9f7c11`  
**Regra:** nenhuma biblioteca deve ser adotada por este relatório sem lacuna recorrente demonstrada.

Este documento aplica o padrão definido em [Graciosidade no KLASSE](./graciosidade.md). Ele serve como baseline para correções futuras do Balcão. Achados devem manter os IDs `BAL-GR-xxx` em commits, PRs, testes e relatórios de fechamento.

---

## Estado de implementação

| ID | Estado | Branch / evidência |
|---|---|---|
| BAL-GR-001 | **IMPLEMENTADO — validação pendente** | `gracefulness/balcao-hardening`: authz dentro da RPC + regressão cross-tenant/role |
| BAL-GR-002 | **IMPLEMENTADO — validação pendente** | checkout preserva `settled | pending | unknown`; documento só libera em `settled` |
| BAL-GR-003 | **IMPLEMENTADO — validação pendente** | idempotência server-side de documentos + replay/fingerprint + regressão SQL |
| BAL-GR-004 | **IMPLEMENTADO — validação pendente** | `DOCUMENT_PENDING` classificado e apresentado como conclusão parcial |

**Não considerar fechado ainda.** O fechamento exige CI verde, regressões SQL em banco descartável, aplicação da migration no ambiente alvo e prova pós-migration conforme a seção 11.

---

## 1. Resumo executivo

A auditoria encontrou quatro problemas P0 confirmados, além de riscos P1/P2. A conclusão técnica é que os P0 atuais não exigem XState, TanStack Query, CASL, Zustand ou outra biblioteca nova. São problemas de contrato de domínio, autorização, idempotência, recuperação e representação correta dos estados.

| ID | Severidade | Achado | Critérios |
|---|---|---|---|
| BAL-GR-001 | P0 | `finalizar_rematricula_balcao` é `SECURITY DEFINER`, executável por `authenticated`, sem validação interna de ator/papel/escola | 8, 9 |
| BAL-GR-002 | P0 | Pagamento não-caixa pode permanecer `pending`, mas a UI apresenta “Pago — emitir documento” | 1, 4, 6, 10 |
| BAL-GR-003 | P0 | Emissão de documento oficial não possui idempotência server-side equivalente à usada em pagamentos | 3, 5, 7 |
| BAL-GR-004 | P0 | `DOCUMENT_PENDING` HTTP 202 da rematrícula é transformado em tela normal de sucesso | 1, 4, 6, 10 |
| BAL-GR-005 | P1 | Falha de busca/dossiê vira estado vazio em vez de erro recuperável | 1, 2, 6 |
| BAL-GR-006 | P1 | Pagamento pode concluir com recibo/fiscal pendente ou falho e a UI encerrar o checkout como sucesso | 4, 6, 10 |
| BAL-GR-007 | P1 | Aluno escolhido pela busca interna não entra na URL; refresh perde contexto e carrinho | 3, 7 |
| BAL-GR-008 | P1 | Impressão pós-rematrícula usa `window.open` sem recuperação explícita de popup bloqueado | 2, 4, 10 |
| BAL-GR-009 | P1 risco | Draft de rematrícula guarda dados operacionais em `sessionStorage` sem escopo de `user_id` | 3, 8 |
| BAL-GR-010 | P2 | CTA final desabilitado não explica por que está bloqueado | 1, 2 |
| BAL-GR-011 | P2 | Remoção de item depende visualmente de hover | 9 |
| BAL-GR-012 | P2 | No mobile o checkout aparece depois do catálogo e perde prioridade operacional | 9 |

---

## 2. Fluxo: entrada e seleção do aluno

### Entrada e saída

```text
/secretaria/balcao
ou
/secretaria/balcao?alunoId=<uuid>

→ aluno identificado
→ dossiê carregado
→ contexto académico/financeiro disponível
→ ações do atendimento disponíveis
```

### Mapa técnico

```text
BalcaoPage
→ BalcaoPageClient
→ BalcaoAtendimento
→ useAlunoSearch
   → GET /api/secretaria/balcao/alunos/search
→ useAlunoDossier
   → get_aluno_dossier
   → get_aluno_dossier_contextual
   → matriculas / turmas / mensalidades
```

### BAL-GR-005 — P1 — erro vira empty state

**Evidência:**
- `apps/web/src/components/secretaria/BalcaoAtendimento.tsx:184-197`
- `apps/web/src/components/secretaria/BalcaoAtendimento.tsx:370-373`
- `apps/web/src/components/secretaria/BalcaoAtendimento.tsx:2029-2034`

Falha de rede/500 na busca ou no dossiê é reduzida a lista vazia ou `aluno = null`. A interface então mostra “Nenhum aluno seleccionado”, que não representa o ocorrido.

**Lacuna:** ausência de estado de erro discriminado.

**Candidata:** resolver sem biblioteca com `idle | loading | loaded | error`, mantendo o aluno/contexto quando a leitura falhar e expondo “Tentar novamente”.

### BAL-GR-007 — P1 — refresh perde o aluno selecionado internamente

**Evidência:**
- `apps/web/src/app/secretaria/balcao/BalcaoPageClient.tsx:12-15`
- `apps/web/src/components/secretaria/BalcaoAtendimento.tsx:1947-1952`
- `apps/web/src/components/secretaria/BalcaoAtendimento.tsx:439-464`

Deep links usam `?alunoId=`, mas a seleção feita dentro do Balcão apenas carrega state React e não sincroniza o URL. O carrinho também vive apenas em memória.

**Lacuna:** contexto durável não acompanha o utilizador.

**Candidata:** resolver sem biblioteca. Sincronizar aluno/ano letivo na URL e decidir explicitamente quais partes do draft podem ser persistidas com segurança.

---

## 3. Fluxo: registar pagamento

### Entrada e saída

```text
aluno
→ mensalidade/serviço
→ carrinho
→ método
→ submissão
→ pagamento settled ou pending
→ recibo/fiscal/documento conforme resultado real
```

### Mapa técnico

```text
BalcaoAtendimento.useCheckout
→ POST /api/secretaria/pagamentos/processar
   ├─ item único
   │  → /api/secretaria/balcao/pagamentos
   │  → financeiro_registrar_pagamento_secretaria()
   └─ múltiplos
      → financeiro_registrar_pagamentos_secretaria_batch()

→ pagamentos
→ recibo
→ caixa
```

### Controle já correto: idempotência de pagamento

A camada atual possui:
- `Idempotency-Key` obrigatório no endpoint unitário;
- replay no backend;
- batch com chave e fingerprint;
- índice único live `ux_pagamentos_escola_idempotency`.

Portanto, duplo clique no pagamento principal não deve ser tratado como lacuna atual.

### BAL-GR-002 — P0 — `pending` apresentado como “Pago”

**Evidência:**
- `apps/web/src/components/secretaria/BalcaoAtendimento.tsx:1471-1504`
- `supabase/migrations/20270521162000_block_future_mensalidade_payment_when_prior_open.sql:302-306`
- função live `financeiro_registrar_pagamento_secretaria` inspecionada em 2026-10-01.

No domínio, `cash` é `settled`; métodos não-caixa podem permanecer `pending`. A UI, porém, coloca serviços em um bloco “Pago — emitir documento” assim que o endpoint retorna `ok`.

**Lacuna:** o client achata “registrado/pending” em “pago”.

**Candidata:** resolver sem biblioteca com resultado discriminado:
- `settled` → Pago / ação dependente liberada;
- `pending` → Pagamento registado / aguardando validação;
- `failed` → não confirmado / retry.

### BAL-GR-006 — P1 — sucesso parcial escondido

**Evidência:**
- `apps/web/src/app/api/secretaria/balcao/pagamentos/route.ts:352-395`
- `apps/web/src/app/api/secretaria/balcao/pagamentos/route.ts:436-467`
- `apps/web/src/app/api/secretaria/pagamentos/processar/route.ts:339-391`

O pagamento pode persistir corretamente enquanto recibo ou fiscal permanecem pendentes/falhos. O HTTP ainda retorna `ok: true`. A UI não preserva a distinção.

**Lacuna:** resultado composto sem representação de pendências.

**Candidata:** convergir gradualmente para o contrato semântico `KlasseActionResult` já definido em `graciosidade.md`.

---

## 4. Fluxo: emitir declaração/documento

### Entrada e saída

```text
serviço documental
→ identificar tipo
→ POST /api/secretaria/documentos/emitir
→ documento persistido
→ docId + URL de impressão
→ impressão ou fila de recuperação
```

### Mapa técnico

```text
BalcaoAtendimento
→ emitirDocumento()
→ POST /api/secretaria/documentos/emitir
→ auth + escola + role
→ contexto académico/matrícula
→ next_documento_numero()
→ documentos_emitidos
→ URL de impressão
```

### BAL-GR-003 — P0 — emissão oficial sem idempotência server-side

**Evidência:**
- `apps/web/src/lib/documentos/emissaoClient.ts:34-74`
- `apps/web/src/app/api/secretaria/documentos/emitir/route.ts:192-247`
- índices live de `documentos_emitidos` inspecionados em 2026-10-01.

A chamada não envia `Idempotency-Key`. Uma tentativa que persiste o documento e perde a resposta pode ser repetida e gerar outro documento oficial equivalente. O `disabled` no frontend reduz clique duplo, mas não garante idempotência.

**Lacuna:** retry não é seguro.

**Candidata:** sem biblioteca:
```text
idempotency_key
+ persistência da operação
+ unique constraint
+ replay devolve o mesmo docId
```

### Controle já correto: recuperação de popup no Balcão genérico

`apps/web/src/lib/documentos/emissaoClient.ts:99-132` detecta bloqueio de popup e devolve o URL; `BalcaoAtendimento.tsx:1508-1548` expõe fila de impressão recuperável. Esse padrão deve ser reutilizado.

---

## 5. Fluxo: rematrícula no Balcão

### Entrada e saída

```text
aluno
→ elegibilidade
→ decisão académica
→ turma destino
→ financeiro
→ pagamento
→ matrícula destino
→ comprovante
```

### Mapa técnico

```text
BalcaoAtendimento
→ useRematriculaBalcao
→ RematriculaBalcaoModal
→ GET /api/secretaria/balcao/rematriculas/status
→ POST /api/secretaria/balcao/rematriculas
→ POST /api/secretaria/balcao/rematriculas/reconcile

DB:
→ servico_pedidos
→ pagamento_intents
→ pagamentos
→ matriculas
→ finalizar_rematricula_balcao()
→ documentos_emitidos
→ audit_logs
```

### BAL-GR-001 — P0 — `SECURITY DEFINER` sem autorização interna

**Evidência versionada:**
- `supabase/migrations/20270823210000_allow_closed_origin_rematricula_activation.sql:6-18`
- `supabase/migrations/20270823210000_allow_closed_origin_rematricula_activation.sql:36-60`
- `supabase/migrations/20270823210000_allow_closed_origin_rematricula_activation.sql:195-196`

**Evidência live 2026-10-01:**
- `security_definer = true`;
- `authenticated_execute = true`;
- `anon_execute = false`.

A rota Next.js faz autorização, mas a RPC pode ser chamada diretamente por um cliente autenticado. O corpo usa IDs fornecidos sem verificar `auth.uid()`, `current_tenant_escola_id()` ou `user_has_role_in_school()`.

**Lacuna:** autoridade final de segurança não está dentro da operação privilegiada.

**Candidata:** sem biblioteca. Avaliar `SECURITY INVOKER`; se `SECURITY DEFINER` for realmente necessário, validar ator, tenant e role dentro da função e restringir grants. Cobrir com teste de chamada direta entre tenants.

### BAL-GR-004 — P0 — `DOCUMENT_PENDING` vira sucesso completo

**Evidência:**
- `apps/web/src/app/api/secretaria/balcao/rematriculas/reconcile/route.ts:301-304`
- `apps/web/src/app/api/secretaria/balcao/rematriculas/reconcile/route.ts:418-421`
- `apps/web/src/hooks/useRematriculaBalcao.ts:629-633`
- `apps/web/src/components/secretaria/RematriculaBalcaoModal.tsx:1073-1133`

O backend modela corretamente rematrícula concluída com comprovante pendente usando HTTP 202 / `DOCUMENT_PENDING`. O client trata qualquer 202 como `result` de sucesso, remove o draft e abre uma `SuccessView` que mostra “Rematrícula concluída” e “Estado: Pago” sem a pendência documental.

**Lacuna:** estado parcial é achatado.

**Candidata:** sem biblioteca:
```text
completed
completed_document_pending
reconciliation_required
blocked
error
```

### BAL-GR-008 — P1 — impressão pós-rematrícula sem recuperação

**Evidência:** `apps/web/src/components/secretaria/RematriculaBalcaoModal.tsx:1150-1179`.

O footer volta a usar `window.open` diretamente, sem verificar bloqueio e sem fila/link de recuperação.

**Candidata:** reutilizar `abrirParaImpressao` e o mesmo padrão já usado no Balcão principal.

### BAL-GR-009 — P1 risco — draft sem escopo de operador

**Evidência:** `apps/web/src/hooks/useRematriculaBalcao.ts:192` e `:337-357`.

A chave contém escola, aluno, matrícula e ano, mas não `user_id`. O draft guarda método, referências, contacto, decisão, observação e idempotency key.

**Estado:** risco estrutural confirmado; exposição ponta a ponta deve ser validada em smoke de logout/login no mesmo dispositivo.

**Candidata:** escopo `tenant + user + flow + entity + expires_at`; evitar persistência local para informação que exija isolamento mais forte.

---

## 6. Bloqueios e mobile

### BAL-GR-010 — P2 — CTA desabilitado sem motivo

**Evidência:** `apps/web/src/components/secretaria/BalcaoAtendimento.tsx:1626-1649`.

`prontoParaPagar` pode falhar por carrinho vazio, TPA sem referência, transferência sem comprovativo, dinheiro insuficiente ou submissão ativa. O operador não recebe a razão junto do CTA.

**Candidata:** `disabledReason` explícito; sem biblioteca.

### BAL-GR-011 — P2 — remoção de item dependente de hover

**Evidência:** `apps/web/src/components/secretaria/BalcaoAtendimento.tsx:1460-1464`.

O botão de remover usa `opacity-0 group-hover:opacity-100`, inadequado como affordance principal em touch.

**Candidata:** ação visível no mobile e label acessível.

### BAL-GR-012 — P2 — checkout perde prioridade no mobile

**Evidência:**
- `apps/web/src/components/secretaria/BalcaoAtendimento.tsx:1973-2028`
- `apps/web/src/components/secretaria/BalcaoAtendimento.tsx:1393-1397`

Em uma coluna, o carrinho vem depois de ficha + catálogo. Para atendimento móvel, testar primeiro uma barra inferior simples “N itens · total · Rever e pagar” antes de considerar drawer/bottom-sheet.

---

## 7. Matriz dos 10 critérios

| Critério | Seleção/Dossiê | Pagamento | Documento | Rematrícula |
|---|---:|---:|---:|---:|
| 1. Estado explícito | ❌ | ❌ | ✅ | ⚠️ |
| 2. Bloqueio → ação | ❌ | ⚠️ | ✅ | ✅ |
| 3. Preserva trabalho | ❌ | ❌ | ⚠️ | ✅/⚠️ |
| 4. Feedback verdadeiro | ⚠️ | ❌ | ✅ | ❌ |
| 5. Retry seguro | N/A | ✅ | ❌ | ✅ |
| 6. Não promete o que não fez | ❌ | ❌ | ✅ | ❌ |
| 7. Contexto acompanha | ❌ | ✅ | ✅ | ✅ |
| 8. Papel correto | ✅ | ✅ | ✅ | ❌ |
| 9. Mobile completo | ⚠️ | ❌ | ⚠️ | ⚠️ |
| 10. Conclusão clara | N/A | ❌ | ✅ | ❌ |

---

## 8. Lacunas recorrentes e candidatas

| Lacuna | Evidência | Candidata |
|---|---|---|
| Estados parciais achatados em sucesso/erro | pagamento, recibo, fiscal, rematrícula | `KlasseActionResult` discriminado |
| Proteção na UI/API mas não na autoridade final | RPC de rematrícula | autorização dentro da função / `SECURITY INVOKER` |
| Idempotência não transversal | pagamentos têm; documentos não | contrato compartilhado de idempotência |
| Falha de leitura vira empty state | busca e dossiê | estados simples `loading/error/loaded` |
| Contexto reside em memória | aluno/carrinho | URL + draft seguro |
| Recuperação de popup inconsistente | Balcão vs rematrícula | reutilizar `abrirParaImpressao` |
| CTA bloqueado sem motivo | pagamento | `disabledReason` |
| Mobile herda desktop | carrinho | sticky/bottom CTA antes de nova lib |

---

## 9. Decisão sobre bibliotecas após esta auditoria

- **XState:** não justificado pelos achados atuais.
- **TanStack Query:** não resolve nenhum P0 identificado.
- **CASL:** não resolve autorização de uma RPC privilegiada.
- **Zustand/localForage:** não introduzir para contornar falta de persistência segura.
- **ts-pattern:** opcional depois de existir union discriminado consistente; não é requisito.
- **Playwright/MSW:** continuam candidatos de teste/validação, não solução dos achados.

Regra mantida:

> Auditar antes de instalar. Uma dependência só entra quando uma lacuna recorrente demonstrada não for resolvida de forma mais simples e segura pelo stack atual.

---

## 10. Ordem de execução

### Gate 0 — Segurança
- [ ] **BAL-GR-001** — fechar autorização da RPC privilegiada.

### Gate 1 — Verdade do sistema
- [ ] **BAL-GR-002** — `pending` não pode ser apresentado como pago.
- [ ] **BAL-GR-004** — `DOCUMENT_PENDING` deve permanecer estado parcial visível.

### Gate 2 — Retry seguro
- [ ] **BAL-GR-003** — idempotência de emissão documental.

### Gate 3 — Recuperação
- [ ] **BAL-GR-005**
- [ ] **BAL-GR-006**
- [ ] **BAL-GR-007**
- [ ] **BAL-GR-008**
- [ ] **BAL-GR-009**

### Gate 4 — Fricção/mobile
- [ ] **BAL-GR-010**
- [ ] **BAL-GR-011**
- [ ] **BAL-GR-012**

---

## 11. Definição de fechamento de um achado

Um `BAL-GR-xxx` só pode ser marcado como fechado quando houver:

1. correção versionada;
2. teste cobrindo o cenário de falha original;
3. evidência de autorização/idempotência quando aplicável;
4. smoke do fluxo real quando necessário;
5. atualização deste documento com:
   - status;
   - commit/PR;
   - teste/evidência;
   - data de fechamento.

Não fechar achado apenas porque a UI “parece correta”.

---

## 12. Baseline

Este relatório é a base da primeira rodada de Gracefulness Audit prevista em `docs/product/graciosidade.md`.

Próxima regra operacional:

```text
achar
→ documentar
→ corrigir a causa
→ testar a falha
→ registrar evidência
→ só então fechar
```
