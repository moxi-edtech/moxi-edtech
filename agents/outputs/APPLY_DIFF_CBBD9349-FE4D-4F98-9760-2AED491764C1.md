# Diff proposto — KLASSE Fortress v1, lote 7
run_id: CBBD9349-FE4D-4F98-9760-2AED491764C1
timestamp: 2026-07-18T20:44:48Z
commit_base: 87fcd62b

Ficheiro: `apps/web/src/app/api/escolas/[id]/cursos/[cursoId]/route.ts`

```diff
@@
-    try {
-      await (supabase as any).rpc('refresh_mv_escola_cursos_stats');
-    } catch (refreshErr) {
-      console.warn('Falha ao atualizar mv_escola_cursos_stats:', refreshErr);
-    }
-
     return NextResponse.json({ ok: true, hard: hardDelete });
```

O refresh era best-effort após o `DELETE` e não influenciava a resposta. O cron
backend `refresh_mv_escola_cursos_stats` permanece ativo a cada 10 minutos.
