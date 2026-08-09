# Aprovação necessária — Agent 3
run_id:    1E55913B-0D0B-4AAF-82E8-2203535A27CE
timestamp: 2026-08-03T00:00:00-03:00

## Acção proposta

Criar migrations idempotentes para concluir o wizard K12:

1. alinhar `cutover_ano_letivo_v3` aos perfis já autorizados pela aplicação (`admin`, `admin_escola`, `staff_admin`, `admin_financeiro`, `diretor`, `super_admin`);
2. criar `aplicar_virada_importacao(uuid)` para aplicar, numa única transacção, somente linhas aprovadas, tenant-scoped e ainda não aplicadas;
3. inserir os templates oficiais MED 2026/2027 de Pré-escolar, Técnico-profissional e Secundário Pedagógico sem alterar o template Regular/Adultos existente.

## Diff

```diff
+++ supabase/migrations/20270803130000_complete_k12_rollover.sql
+ CREATE OR REPLACE FUNCTION public.cutover_ano_letivo_v3(...)
+ -- mantém o corpo actual e substitui apenas a lista autorizada por:
+ ARRAY['admin','admin_escola','staff_admin','admin_financeiro','diretor','super_admin']::text[]
+
+ CREATE OR REPLACE FUNCTION public.aplicar_virada_importacao(p_importacao_id uuid)
+ RETURNS jsonb
+ LANGUAGE plpgsql
+ SECURITY DEFINER
+ SET search_path = public, pg_temp;
+ -- bloqueia o lote FOR UPDATE, valida tenant/perfil/status,
+ -- rejeita linhas sem matrícula e usa ON CONFLICT para idempotência;
+ -- marca linhas como APLICADA e o lote como APLICADO na mesma transacção.
+
+ REVOKE ALL ON FUNCTION public.aplicar_virada_importacao(uuid) FROM PUBLIC, anon;
+ GRANT EXECUTE ON FUNCTION public.aplicar_virada_importacao(uuid) TO authenticated;
+++ supabase/migrations/20270803131000_seed_calendarios_k12_2026_2027.sql
+ INSERT INTO public.calendario_templates (...) VALUES
+   (..., 'MED 2026/2027 — Pré-escolar', 2026, 'PRE_ESCOLAR', ...),
+   (..., 'MED 2026/2027 — Técnico-profissional', 2026, 'TECNICO_PROFISSIONAL', ...),
+   (..., 'MED 2026/2027 — Secundário pedagógico', 2026, 'SECUNDARIO_PEDAGOGICO', ...)
+ ON CONFLICT (...) DO UPDATE ...;
+ INSERT INTO public.calendario_template_items (...)
+ -- períodos e eventos próprios de cada grelha oficial, com upsert idempotente.
```

## Risco

Uma autorização SQL incorrecta pode permitir uma virada indevida; uma resolução ambígua de avaliação pode lançar notas na avaliação errada; datas de subsistemas não devem ser inferidas do calendário Regular.

## Proteções obrigatórias no diff final

- Nenhuma nota numérica será aplicada por nome ambíguo: exigirá `avaliacao_id` validado contra escola, matrícula, turma e ano.
- `resultado_final = PENDENTE` será bloqueante.
- O lote inteiro fará rollback se uma linha falhar.
- Templates serão seleccionados explicitamente pela escola e criados inactivos.
- O SQL será validado numa transacção antes de qualquer aplicação remota.

## Como aprovar

Commit com mensagem: `APPROVE: 1E55913B-0D0B-4AAF-82E8-2203535A27CE`

## Como rejeitar

Commit com mensagem: `REJECT: 1E55913B-0D0B-4AAF-82E8-2203535A27CE [motivo]`
