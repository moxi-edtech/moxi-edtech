# Diff proposto — KLASSE Fortress v1, lote 4
run_id: 3B9113CB-6E1D-43EC-8D39-0E00C9FD91DF
timestamp: 2026-07-18T20:37:11Z
commit_base: 90c85e7a

Ficheiro: `apps/web/src/app/api/secretaria/matriculas/[matriculaId]/finalizar/route.ts`

```diff
@@
-    try {
-      await supabase.rpc("refresh_mv_boletim_por_matricula");
-    } catch (err) {
-      console.warn("[matriculas/finalizar] refresh_mv_boletim_por_matricula falhou", err);
-    }
-
     const { data: result, error: rpcError } = await supabase.rpc("finalizar_matricula_blindada", {
```

`finalizar_matricula_blindada` usa `gradeengine_calcular_situacao` diretamente e
não depende da MV. O cron backend de `mv_boletim_por_matricula` permanece ativo.
