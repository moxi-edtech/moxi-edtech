# Diff: notificar admin sobre pendências financeiras

```diff
*** Update File: apps/web/src/app/api/migracao/alunos/importar/route.ts
@@
     await notificarRascunhosESucesso({
       supabase,
       escolaId,
       importId,
       result,
       activeMatriculas: financeResult.activeMatriculas,
+      pendenciasFinanceiras: pendenciasTotal,
     });
@@
 async function notificarRascunhosESucesso(params: {
   supabase: SupabaseAdmin;
   escolaId: string;
   importId: string;
   result: ImportResult;
   activeMatriculas: number;
+  pendenciasFinanceiras: number;
 }) {
-  const { supabase, escolaId, importId, result, activeMatriculas } = params;
+  const { supabase, escolaId, importId, result, activeMatriculas, pendenciasFinanceiras } = params;
@@
   // Notificação para Financeiro apenas se houve alunos importados em turmas ativas (aplicada em contexto financeiro)
   if (activeMatriculas > 0) {
     await supabase.from("notifications").insert({
       escola_id: escolaId,
       target_role: "financeiro",
       tipo: "importacao_turmas_ativas",
       titulo: `Importação concluída: ${activeMatriculas} alunos em turmas ativas`,
       mensagem: "Clique para auditar cobranças e isenções.",
       link_acao: "/financeiro",
     });
   }
+
+  if (pendenciasFinanceiras > 0) {
+    await supabase.from("notifications").insert({
+      escola_id: escolaId,
+      target_role: "admin",
+      tipo: "importacao_pendencias_financeiras",
+      titulo: `Importação com ${pendenciasFinanceiras} pendências financeiras`,
+      mensagem: "Há alunos sem contexto financeiro. Revise preços e turmas ativas.",
+      link_acao: "/financeiro/configuracoes/precos",
+    });
+  }
 }
```
