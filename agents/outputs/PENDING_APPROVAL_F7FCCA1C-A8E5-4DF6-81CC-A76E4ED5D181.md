# Aprovação necessária — Agent 3
run_id:    F7FCCA1C-A8E5-4DF6-81CC-A76E4ED5D181
timestamp: 2026-08-23T00:00:00-03:00

## Acção proposta

Aplicar a migração que preenche apenas cargas horárias semanais ausentes na matriz curricular, usando primeiro a carga já existente e, só depois, a personalização da escola, o preset curricular e o catálogo.

## Diff

```diff
++ supabase/migrations/20270823231000_backfill_curriculum_weekly_hours_from_presets.sql
@@
+UPDATE public.curso_matriz cm
+SET
+  preset_subject_id = COALESCE(cm.preset_subject_id, resolved_defaults.resolved_preset_subject_id),
+  carga_horaria_semanal = resolved_defaults.resolved_weekly_hours,
+  carga_horaria = COALESCE(NULLIF(cm.carga_horaria, 0), resolved_defaults.resolved_weekly_hours)
+FROM resolved_defaults
+WHERE cm.id = resolved_defaults.id
+  AND resolved_defaults.resolved_weekly_hours > 0;
```

## Risco

A execução actualiza dados curriculares publicados que estejam sem carga; embora preserve valores positivos já definidos, a alteração deve ser verificada em produção antes de ser promovida.

## Como aprovar

Commit com mensagem: `APPROVE: F7FCCA1C-A8E5-4DF6-81CC-A76E4ED5D181`

## Como rejeitar

Commit com mensagem: `REJECT: F7FCCA1C-A8E5-4DF6-81CC-A76E4ED5D181 [motivo]`
