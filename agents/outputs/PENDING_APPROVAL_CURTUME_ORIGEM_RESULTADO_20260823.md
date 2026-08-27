# Aprovação necessária — alteração de contrato académico

run_id:    CURTUME-ORIGEM-RESULTADO-20260823
timestamp: 2026-08-23T00:00:00-03:00

## Acção proposta

Alinhar a virada de rematrícula com o modelo real de dados:

- `matriculas.status` da origem termina como `concluido`, nunca como
  `transferido` para representar a progressão anual;
- `historico_anos.resultado_final` recebe `aprovado`, `reprovado` ou `concluido`;
- decisões sem notas completas registam fonte, motivo, actor e data no registo
  de autorização existente (`promocoes_com_pendencias`/auditoria);
- `transferido` permanece reservado para transferência escolar ou reconciliação
  de destino já criado;
- finalização de balcão e rematrícula em massa preservam o resultado académico
  e não o substituem por um estado operacional de transição.

## Confronto de risco

O código atual usa `status = 'transferido'` em:

- `finalizar_rematricula_balcao`;
- guard de confirmação do Balcão;
- `rematricula_em_massa`.

Alterar isto afeta RPCs de matrícula, histórico académico, idempotência e
reconciliação. Não deve ser aplicado como update manual em dados reais.

## Diff proposto

```diff
diff --git a/supabase/migrations/20270823200000_preserve_rematricula_academic_result.sql b/supabase/migrations/20270823200000_preserve_rematricula_academic_result.sql
new file mode 100644
--- /dev/null
+++ b/supabase/migrations/20270823200000_preserve_rematricula_academic_result.sql
@@
+CREATE OR REPLACE FUNCTION public.finalize_rematricula_source_academic_result(
+  p_escola_id uuid,
+  p_matricula_id uuid,
+  p_resultado_final text,
+  p_fonte text,
+  p_motivo text
+) RETURNS jsonb
+LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';
+-- Valida tenant/actor, faz upsert de historico_anos, fecha a matrícula de
+-- origem como concluido/inativa e regista a decisão em audit_logs.
+
+-- Reaplicar as RPCs de finalização de balcão e lote para:
+-- 1) aceitar origem concluida como histórico válido;
+-- 2) exigir historico_anos.resultado_final antes da ativação;
+-- 3) deixar de escrever status = 'transferido' na progressão anual;
+-- 4) manter transferido apenas para transferência/reconciliação real.
+
+-- Atualizar a autorização de promoção com pendências para guardar fonte
+-- estruturada 'declaracao_administrativa_escola' e observação obrigatória.
```

## Risco

Aplicação incompleta pode deixar a matrícula destino ativa com origem em estado
ambíguo, quebrar reprocessamento idempotente ou alterar o histórico académico.
Será necessário compilar em transação, executar testes de rollback/idempotência
e fazer smoke test com um aluno Curtume antes de qualquer aplicação remota.

## Como aprovar

Commit com mensagem: `APPROVE: CURTUME-ORIGEM-RESULTADO-20260823`

## Como rejeitar

Commit com mensagem: `REJECT: CURTUME-ORIGEM-RESULTADO-20260823 [motivo]`
