# KLASSE — reconciliação académica histórica com evidência

Data: 29/10/2026. Scope: ciclos 2025/2026 → 2026/2027 e generalização por escola. **Não altera o módulo fiscal/AGT.**

## Constatações verificadas no Supabase

A escola Curtume tem 550 matrículas 2025 em estado `pendente`. Todas pertencem à coorte `CURTUME_2025_SEM_PAUTAS` (virada assistida por falta de pautas oficiais); a elegibilidade **não é resultado académico**. Das 550 origens, 301 têm destino explicitamente ligado e 306 alunos possuem destino ativo em 2026, mas não existe histórico anual das 550; apenas cinco possuem notas isoladas e a vista do boletim oficial devolve zero linhas para todas. Nenhuma dessas evidências autoriza decidir aprovação/reprovação em massa.

Existem mais 14 históricos de 2025 registados e abertos. Dois apresentam resultado `reprovado` mas matrícula `concluido`; 13 decisões importadas têm auditoria sem `actor_id`. Um histórico não tem vínculo completo ao `ano_letivo_id`. **Não foram fechados automaticamente.** A ratificação pela direção da escola é imprescindível.

## Regras de reconciliação

1. **GradeEngine:** se o boletim não possui disciplinas oficiais, retorna `incompleto`. Nunca interpreta um conjunto vazio como aprovado.
2. **Decisão da escola:** requer coorte assistida válida, utilizador autenticado autorizado, resultado confirmado, motivo e referência documental. A função `finalizar_origem_academica` vincula a matrícula ao histórico e conserva `snapshot_status='aberto'`. Reprovação grava o encerramento `reprovado`, não `concluido`.
3. **Importações legadas:** a direção ratifica o resultado já registado através de `ratificar_resultado_historico_escola`. A ratificação exige administrador autenticado, referência à ata/documento, motivo e resultado igual ao registado. Só após essa ratificação é possível corrigir o estado administrativo inconsistente sem inventar notas nem substituir o resultado académico.
4. **Fecho legal:** é uma ação **separada e explícita**, invocando `historico_set_snapshot_state` após validação de matrícula, ano, histórico, resultado, prova auditada de decisão, ausência de conflito e motivo. O trigger `lifecycle_validate_historico_legal_lock` grava `historico_ano_id` a partir da tabela oficial, não do pedido do utilizador.
5. **Portais:** as leituras do aluno e da Secretaria continuam a consumir o SSOT `v_student_lifecycle_ssot_v1` do #282; um resultado registrado mas ainda `aberto` não aparece como oficial. Os fluxos administrativos oferecem recuperação contextual no painel Operações Académicas.
6. **Fechamento em lote:** `runFechamentoOrchestration` deve tratar `{ok:false,status:'incompleto'}` como erro, não como sucesso do RPC. Qualquer erro impede bloqueio legal e mudança do ano letivo, com estado de job `FAILED` e registos auditáveis.

## Como a escola resolve

Em **Secretaria → Operações Académicas → Reconciliação académica histórica**, filtre pelo ano de origem e use uma das duas filas:

- **Decisões pendentes:** seleccionar o aluno, confrontar documentos/ata, indicar resultado, referência e motivo e registar a decisão, apenas quando confirmada. A eventual matrícula de destino não prova o resultado.
- **Históricos por fechar:** a direção ratifica os resultados importados sem autor, confirmando a referência documental. Em passo posterior, confere histórico e clica explicitamente em **Fechar histórico oficialmente**.

Se faltar documento ou houver contradição, deixar o registo em análise e solicitar confirmação à direção, sem reclassificar automaticamente.

## Testes executados

- Simulação transacional reversível de falta de documento: operação rejeitada.
- Simulação transacional reversível de encerramento legal de matrícula pendente: operação rejeitada.
- Simulação transacional reversível de decisão documental + histórico vinculado + bloqueio legal: sucesso; `ROLLBACK` aplicado.
- Simulação transacional reversível de ratificação escolar + encerramento legal em histórico importado: sucesso; `ROLLBACK` aplicado.
- Regressão de produção somente leitura: `supabase/ops/tests/regression_student_lifecycle_evidence_20261029.sql`.
- Unit contracts: `apps/web/tests/unit/lifecycle-evidence-reconciliation.spec.ts`; CI dedicado em `.github/workflows/lifecycle-evidence-reconciliation.yml`.

## Implantação e responsabilidades

O backend foi corrigido diretamente no Supabase em três migrações auditadas, espelhadas em `supabase/ops/applied_lifecycle_20261029/`. A migração pós-replay `20271029100000_lifecycle_reconciliation_evidence_guards.sql` apenas recompõe a estrutura num banco novo após dependências de 2027; **não executar novamente como alteração produtiva duplicada sem planeamento**.

A página e API de reconciliação ficam na PR empilhada sobre #282 até CI, ensaio autenticado dos portais e integração. Os 550 históricos pendentes ainda exigem decisões escolares documentadas; os 14 anteriores ainda aguardam ratificação e fecho legal. Nenhuma nota, recibo fiscal, estado escolar legado ou snapshot foi fabricado para desbloquear esse trabalho.
