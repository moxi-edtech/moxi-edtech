# Diff proposto — KLASSE Fortress v1, lote 5
run_id: 6B7D0989-3E6A-4FD9-9A1A-BBFCB2B45A97
timestamp: 2026-07-18T20:40:18Z
commit_base: a78e495f

Ficheiro: `apps/web/src/app/api/secretaria/fechamento-academico/route.ts`

```diff
@@
-  try {
-    await supabase.rpc("refresh_mv_boletim_por_matricula");
-  } catch (err) {
-    console.warn("[fechamento-academico] refresh_mv_boletim_por_matricula falhou", err);
-  }
-
   const finalizeErrors: any[] = [];
```

A finalização em lote continua usando `finalizar_matricula_blindada`, cuja fonte
é o GradeEngine transacional. O cron backend do boletim permanece ativo.
