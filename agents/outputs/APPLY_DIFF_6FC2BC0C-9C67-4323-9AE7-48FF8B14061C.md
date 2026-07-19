# Diff proposto — Agent 3
run_id: 6FC2BC0C-9C67-4323-9AE7-48FF8B14061C
timestamp: 2026-07-18T22:45:00Z

## P0
`P0_CHECKLIST.md` verificado: nenhum item em FAIL ou por concluir.

## Acção
Remover `PUBLIC/anon` de 17 funções administrativas de admissões/matrículas, preservando `authenticated` e `service_role`.

## Ficheiro proposto
`supabase/migrations/20270718155000_revoke_anon_admissions_function_execute.sql`

```diff
--- /dev/null
+++ b/supabase/migrations/20270718155000_revoke_anon_admissions_function_execute.sql
@@
+BEGIN;
+DO $migration$
+DECLARE signature regprocedure;
+BEGIN
+  FOREACH signature IN ARRAY ARRAY[
+    'public.admissao_approve(uuid,uuid,text)'::regprocedure,
+    'public.admissao_archive(uuid,uuid,text)'::regprocedure,
+    'public.admissao_auto_expire_reservations()'::regprocedure,
+    'public.admissao_convert_to_matricula(uuid,uuid,jsonb)'::regprocedure,
+    'public.admissao_convert(uuid,uuid,text,text,numeric,text)'::regprocedure,
+    'public.admissao_finalizar_matricula(uuid,uuid,uuid,jsonb,text,text,boolean,text)'::regprocedure,
+    'public.admissao_reabrir(uuid,uuid,text)'::regprocedure,
+    'public.admissao_reject(uuid,uuid,text,jsonb)'::regprocedure,
+    'public.admissao_unsubmit(uuid,uuid,text)'::regprocedure,
+    'public.confirmar_matricula_core(uuid,integer,uuid,uuid)'::regprocedure,
+    'public.confirmar_matricula(uuid)'::regprocedure,
+    'public.create_or_confirm_matricula(uuid,uuid,integer,uuid)'::regprocedure,
+    'public.finalizar_matricula_anual(uuid,uuid,text,text)'::regprocedure,
+    'public.finalizar_matricula_blindada(uuid,uuid,text,boolean,text)'::regprocedure,
+    'public.matricular_lista_alunos(uuid,uuid,integer,uuid[])'::regprocedure,
+    'public.transferir_aluno_turma(uuid,uuid,text)'::regprocedure,
+    'public.transferir_matricula(uuid,uuid,uuid)'::regprocedure
+  ] LOOP
+    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', signature);
+    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', signature);
+  END LOOP;
+END
+$migration$;
+COMMIT;
```

## Verificação pós-apply prevista
17/17 assinaturas com `anon = false`, `authenticated = true`, `service_role = true`.
