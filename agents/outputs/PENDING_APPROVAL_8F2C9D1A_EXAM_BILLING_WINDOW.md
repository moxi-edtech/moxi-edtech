# Aprovação necessária — janela de cobrança de classes de exame

run_id: 8F2C9D1A-EXAM-BILLING-WINDOW
timestamp: 2026-08-15

## Acção proposta
Adicionar uma janela de cobrança específica por turma de exame, preservando o calendário letivo como limite padrão e permitindo que a escola configure uma data final posterior quando o período de exames assim exigir.

## Diff SQL proposto
```diff
diff --git a/supabase/migrations/NEW_exam_class_billing_windows.sql b/supabase/migrations/NEW_exam_class_billing_windows.sql
new file mode 100644
--- /dev/null
+++ b/supabase/migrations/NEW_exam_class_billing_windows.sql
@@
+CREATE TABLE public.turma_janelas_cobranca (
+  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
+  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
+  turma_id uuid NOT NULL REFERENCES public.turmas(id) ON DELETE CASCADE,
+  ano_letivo_id uuid NOT NULL REFERENCES public.anos_letivos(id) ON DELETE CASCADE,
+  data_inicio date NOT NULL,
+  data_fim date NOT NULL,
+  motivo text NOT NULL DEFAULT 'exame',
+  created_at timestamptz NOT NULL DEFAULT now(),
+  updated_at timestamptz NOT NULL DEFAULT now(),
+  CONSTRAINT turma_janela_cobranca_datas_ck CHECK (data_fim >= data_inicio),
+  CONSTRAINT turma_janela_cobranca_unq UNIQUE (escola_id, turma_id, ano_letivo_id)
+);
+
+CREATE INDEX ux_turma_janelas_cobranca_lookup
+  ON public.turma_janelas_cobranca (escola_id, turma_id, ano_letivo_id);
+
+ALTER TABLE public.turma_janelas_cobranca ENABLE ROW LEVEL SECURITY;
+
+COMMENT ON TABLE public.turma_janelas_cobranca IS
+  'Janela financeira explícita para turmas de exame; sem registro, usa-se o fim do ano letivo.';
```

## Alterações de código após aprovação
- Formulário da turma: permitir início/fim apenas quando a turma for de exame.
- Prévia: mostrar “fim do ano letivo” ou “fim customizado de exames”.
- Geração de mensalidades: usar a janela customizada, sem ultrapassar a data configurada.
- Rematrícula e nova matrícula: aplicar a mesma janela.
- Pagamento: rejeitar competências fora da janela com mensagem orientativa.
- Auditoria: registrar criação, alteração e remoção da janela.

## Risco
Médio/alto: altera o contrato de dados usado por geração, rematrícula e validação de pagamentos.

## Como aprovar
Criar um commit com a mensagem:
`APPROVE: 8F2C9D1A-EXAM-BILLING-WINDOW`

## Como rejeitar
Criar um commit com a mensagem:
`REJECT: 8F2C9D1A-EXAM-BILLING-WINDOW [motivo]`

## Aprovação recebida
`APPROVE: 8F2C9D1A-EXAM-BILLING-WINDOW`

## Estado
APPROVED. A implementação foi aplicada no workspace e a migration foi executada na base de produção.

## Implementação no workspace
- `supabase/migrations/20270815100000_exam_class_billing_windows.sql`
- `apps/web/src/components/secretaria/TurmaForm.tsx`
- `apps/web/src/features/turmas/actions.ts`
- geração de mensalidades, balcão de pagamentos e rematrícula.
