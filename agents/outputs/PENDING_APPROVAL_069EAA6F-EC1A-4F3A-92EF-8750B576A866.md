# Aprovação necessária — Agent 3
run_id:    069EAA6F-EC1A-4F3A-92EF-8750B576A866
timestamp: 2026-08-23T14:29:55Z

## Acção proposta

Alinhar portal do aluno, balcão e RPC de rematrícula ao mesmo preço canónico da
classe/curso destino. O valor será resolvido no servidor, congelado no pedido e
na intenção de pagamento e reutilizado pela secretaria ao concluir a matrícula.

O pacote inclui ainda:

- apresentar ao aluno classe destino, taxa e decomposição antes de pagar;
- remover o falso “taxa não configurada” quando `SERV_REMATRICULA.valor_base = 0`
  e existir `financeiro_tabelas.valor_confirmacao` para a classe;
- aceitar origem histórica `concluido`/`reprovado` no fallback do modal;
- manter o modal da secretaria no mesmo contexto após validar o pagamento;
- atualizar contrato e sprint de rematrícula.

## Diff

```diff
diff --git a/apps/web/src/app/api/aluno/rematricula/status/route.ts b/apps/web/src/app/api/aluno/rematricula/status/route.ts
@@
+import { resolveValorConfirmacao } from "@/lib/financeiro/resolve-confirmacao";
@@
-        .gt('valor_base', 0)
+        // O valor global pode ser zero quando a taxa está configurada por classe.
@@
-    const rematriculaService = ... valor_base
+    const destino = await resolveClasseDestinoPeloRaa(...)
+    const pricing = await resolveValorConfirmacao(supabase, {
+      escolaId,
+      anoLetivo: nextAno,
+      cursoId: destino.cursoId,
+      classeId: destino.classeId,
+      valorGlobal: rematriculaService?.valor_base,
+    })
+    // resposta: classe destino, valor canónico e origem do preço

diff --git a/supabase/migrations/20260823143000_align_portal_rematricula_class_pricing.sql b/supabase/migrations/20260823143000_align_portal_rematricula_class_pricing.sql
new file mode 100644
@@
+-- Redefine public.aluno_iniciar_rematricula(uuid, uuid[]) preservando guards.
+-- 1. Resolve RAA e classe/curso destino dentro da transação.
+-- 2. Resolve financeiro_tabelas.valor_confirmacao pela prioridade:
+--    curso+classe → classe → curso → geral → SERV_REMATRICULA.valor_base.
+-- 3. Usa o valor resolvido em v_items e v_total.
+-- 4. Persiste pricing_origin, classe_destino_id, curso_destino_id,
+--    ano_letivo e valor_confirmacao no contexto do pedido e meta da intent.
+-- 5. Rejeita divergência de preço e mantém idempotência do pedido existente.
+-- 6. Não altera pagamentos existentes, RLS, colunas ou dados reais.

diff --git a/apps/web/src/app/api/secretaria/recebimentos/rematricula-context/route.ts b/apps/web/src/app/api/secretaria/recebimentos/rematricula-context/route.ts
@@
-        .in("status", ["ativo", "ativa", "active"])
+        .in("status", ["ativo", "ativa", "active", "concluido", "concluida", "reprovado", "reprovada"])

diff --git a/apps/web/src/components/aluno/home/RematriculaBanner.tsx b/apps/web/src/components/aluno/home/RematriculaBanner.tsx
@@
+// Mostrar classe destino, taxa canónica, dívida, estado da validação e próximo passo.
+// Após validação, atualizar o estado sem obrigar navegação ou reinício do fluxo.

diff --git a/docs/CONTRATO_ESTADOS_MATRICULA_REMATRICULA.md b/docs/CONTRATO_ESTADOS_MATRICULA_REMATRICULA.md
@@
+Preço da rematrícula é resolvido pela classe destino e congelado na transação.

diff --git a/docs/SPRINT_TRANSICAO_ACADEMICA_REMATRICULA_2026.md b/docs/SPRINT_TRANSICAO_ACADEMICA_REMATRICULA_2026.md
@@
+Adicionar critérios de aceite para paridade de preço, continuidade aluno/secretaria e recuperação graciosa.
```

## Risco

Se a resolução da classe destino ou o snapshot financeiro estiverem errados, o
aluno pode receber uma cobrança diferente da esperada ou a secretaria pode não
conseguir reconciliar o pagamento com a turma. A migration será transacional,
sem alteração de dados existentes, e terá testes para promoção, retenção,
fallback global, preço por classe e idempotência.

## Como aprovar

Commit com mensagem: `APPROVE: 069EAA6F-EC1A-4F3A-92EF-8750B576A866`

## Como rejeitar

Commit com mensagem: `REJECT: 069EAA6F-EC1A-4F3A-92EF-8750B576A866 [motivo]`
