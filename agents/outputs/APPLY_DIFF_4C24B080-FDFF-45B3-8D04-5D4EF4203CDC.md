# Apply diff — recibo automático e valor total da dívida
run_id: 4C24B080-FDFF-45B3-8D04-5D4EF4203CDC
timestamp: 2026-08-31T23:36:52-03:00
P0_CHECKLIST: PASS

## Acção proposta

No modal de regularização do Balcão, preencher automaticamente o valor com o
saldo total em aberto, preservar a possibilidade de pagamento parcial, emitir
um único recibo consolidado para os itens liquidados e abrir esse recibo após o
pagamento.

## Diff proposto

```diff
diff --git a/apps/web/src/components/secretaria/PagamentoDividaModal.tsx b/apps/web/src/components/secretaria/PagamentoDividaModal.tsx
@@
-    setAmount("");
+    setAmount(total > 0 ? String(total) : "");
@@
-  }, [open, alunoId]);
+  }, [open, alunoId, total]);
@@
-      let paidNow = 0;
+      const fullyPaid = value >= total;
+      const allocations = ordered.reduce<...>(...);
+      let paidNow = 0;
@@
-      for (const item of ordered) {
+      for (const [index, allocation] of allocations.entries()) {
+        const { item, amount: allocated } = allocation;
+        const shouldEmitReceipt = index === allocations.length - 1;
@@
             meta: {
               origem: "pos_virada",
               matricula_origem_id: item.origem_matricula_id,
               origem_pagamento: "regularizacao_divida_balcao",
+              emitir_recibo: shouldEmitReceipt,
+              itens: allocations.map(...),
             },
@@
-        if (json.recibo?.ok && typeof json.recibo.print_url === "string") {
+        if (shouldEmitReceipt && json.recibo?.ok && typeof json.recibo.print_url === "string") {
           recibosEmitidos.push({ label: item.nome, url: json.recibo.print_url });
-        } else {
+        } else if (shouldEmitReceipt) {
           recibosPendentes.push(item.nome);
         }
@@
+      const reciboPrincipal = recibosEmitidos.at(-1);
+      if (reciboPrincipal) window.open(reciboPrincipal.url, "_blank", "noopener,noreferrer");
@@
-          : remaining > 0
+          : !fullyPaid
@@
-      if (remaining <= 0) onFullyPaid?.();
+      if (fullyPaid) onFullyPaid?.();
@@
-{submitting ? "A registar pagamento…" : "Registar pagamento parcial"}
+{submitting ? "A registar pagamento…" : Number(amount) >= total ? "Liquidar dívida e emitir recibo" : "Registar pagamento parcial e emitir recibo"}
```

## Risco e reversão

Risco baixo e limitado ao estado/UX do modal. O backend canónico e a ordem de
liquidação permanecem inalterados. Reversível com um único `git revert`.

## Diff final exacto

```diff
diff --git a/apps/web/src/components/secretaria/PagamentoDividaModal.tsx b/apps/web/src/components/secretaria/PagamentoDividaModal.tsx
index 15f3b5b05..d5652b8c2 100644
--- a/apps/web/src/components/secretaria/PagamentoDividaModal.tsx
+++ b/apps/web/src/components/secretaria/PagamentoDividaModal.tsx
@@ -46,7 +46,6 @@ export function PagamentoDividaModal({ open, onOpenChange, mensalidades, alunoId
   // O diálogo é reutilizado entre atendimentos; não deve transportar o estado
   // (em especial comprovativos) de um aluno para outro.
   useEffect(() => {
-    setAmount("");
     setReference("");
     setEvidenceUrl("");
     setMessage(null);
@@ -54,6 +53,10 @@ export function PagamentoDividaModal({ open, onOpenChange, mensalidades, alunoId
     setRecibos([]);
   }, [open, alunoId]);

+  useEffect(() => {
+    if (open) setAmount(total > 0 ? String(total) : "");
+  }, [open, alunoId, total]);
+
   const pay = async () => {
     const value = Number(amount);
     if (!Number.isFinite(value) || value <= 0 || value > total) {
@@ -71,14 +74,29 @@ export function PagamentoDividaModal({ open, onOpenChange, mensalidades, alunoId

     setSubmitting(true);
     setMessage(null);
-    let remaining = value;
+    const receiptWindow = window.open("about:blank", "_blank");
+    if (receiptWindow) {
+      receiptWindow.opener = null;
+      receiptWindow.document.title = "A preparar recibo…";
+      receiptWindow.document.body.textContent = "Pagamento em processamento. O recibo será apresentado aqui.";
+    }
     try {
+      const fullyPaid = value >= total;
+      let amountToAllocate = value;
+      const allocations: Array<{ item: Mensalidade; amount: number }> = [];
+      for (const item of ordered) {
+        if (amountToAllocate <= 0) break;
+        const allocated = Math.min(amountToAllocate, item.preco);
+        allocations.push({ item, amount: allocated });
+        amountToAllocate -= allocated;
+      }
+
       let paidNow = 0;
       const recibosEmitidos: Array<{ label: string; url: string }> = [];
       const recibosPendentes: string[] = [];
-      for (const item of ordered) {
-        if (remaining <= 0) break;
-        const allocated = Math.min(remaining, item.preco);
+      for (const [index, allocation] of allocations.entries()) {
+        const { item, amount: allocated } = allocation;
+        const shouldEmitReceipt = index === allocations.length - 1;
         const response = await fetch("/api/secretaria/balcao/pagamentos", {
           method: "POST",
           headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
@@ -94,33 +112,50 @@ export function PagamentoDividaModal({ open, onOpenChange, mensalidades, alunoId
               origem: "pos_virada",
               matricula_origem_id: item.origem_matricula_id,
               origem_pagamento: "regularizacao_divida_balcao",
+              emitir_recibo: shouldEmitReceipt,
+              itens: allocations.map(({ item: receiptItem, amount }) => ({
+                id: receiptItem.id,
+                tipo: "mensalidade",
+                nome: receiptItem.nome,
+                preco: amount,
+              })),
             },
           }),
         });
         const json = await response.json().catch(() => ({}));
         if (!response.ok || !json?.ok) throw new Error(json?.error || "Não foi possível registar o pagamento.");
-        if (json.recibo?.ok && typeof json.recibo.print_url === "string") {
-          recibosEmitidos.push({ label: item.nome, url: json.recibo.print_url });
-        } else {
+        if (shouldEmitReceipt && json.recibo?.ok && typeof json.recibo.print_url === "string") {
+          recibosEmitidos.push({
+            label: allocations.length > 1 ? `Recibo consolidado (${allocations.length} mensalidades)` : item.nome,
+            url: json.recibo.print_url,
+          });
+        } else if (shouldEmitReceipt) {
           recibosPendentes.push(item.nome);
         }
-        remaining -= allocated;
         paidNow += allocated;
       }
       setPaymentHistory((history) => [...history, { amount: paidNow, method: methods.find((item) => item.id === method)?.label ?? method }]);
       setRecibos((previous) => [...previous, ...recibosEmitidos]);
+      const reciboPrincipal = recibosEmitidos[recibosEmitidos.length - 1];
+      if (reciboPrincipal) {
+        if (receiptWindow) receiptWindow.location.replace(reciboPrincipal.url);
+        else window.open(reciboPrincipal.url, "_blank", "noopener,noreferrer");
+      } else {
+        receiptWindow?.close();
+      }
       setMessage({
         type: recibosPendentes.length > 0 ? "error" : "success",
         text: recibosPendentes.length > 0
           ? `Pagamento registado, mas o recibo de ${recibosPendentes.join(", ")} está pendente de emissão.`
-          : remaining > 0
+          : !fullyPaid
             ? "Pagamento registado parcialmente. O comprovativo está disponível abaixo."
             : "Pagamento registado com sucesso. O comprovativo está disponível abaixo.",
       });
       setAmount("");
       onSuccess();
-      if (remaining <= 0) onFullyPaid?.();
+      if (fullyPaid) onFullyPaid?.();
     } catch (error) {
+      receiptWindow?.close();
       setMessage({ type: "error", text: error instanceof Error ? error.message : "Pagamento não concluído." });
       onSuccess();
     } finally {
@@ -147,7 +182,7 @@ export function PagamentoDividaModal({ open, onOpenChange, mensalidades, alunoId
           {message && <p className={`flex items-center gap-2 rounded-xl p-3 text-sm ${message.type === "success" ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-700"}`}>{message.type === "success" && <CheckCircle2 className="h-4 w-4" />}{message.text}</p>}
           {paymentHistory.length > 0 && <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 text-xs text-emerald-900"><p className="mb-1 font-bold">Pagamentos nesta regularização</p>{paymentHistory.map((item, index) => <div key={`${item.method}-${index}`} className="flex justify-between"><span>{item.method}</span><strong>{money.format(item.amount)}</strong></div>)}</div>}
           {recibos.length > 0 && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-950"><p className="mb-2 font-bold">Comprovativos emitidos</p><div className="space-y-2">{recibos.map((recibo) => <button key={`${recibo.label}-${recibo.url}`} type="button" onClick={() => window.open(recibo.url, "_blank", "noopener,noreferrer")} className="flex w-full items-center justify-between rounded-lg bg-white px-3 py-2 text-left font-semibold text-emerald-800 hover:bg-emerald-100"><span className="truncate pr-2">{recibo.label}</span><span className="inline-flex shrink-0 items-center gap-1"><Printer className="h-3.5 w-3.5" /> Imprimir</span></button>)}</div></div>}
-          <button type="button" onClick={() => void pay()} disabled={submitting || ordered.length === 0} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#E3B23C] px-4 py-3 text-sm font-bold text-slate-950 disabled:opacity-60">{submitting && <Loader2 className="h-4 w-4 animate-spin" />} {submitting ? "A registar pagamento…" : "Registar pagamento parcial"}</button>
+          <button type="button" onClick={() => void pay()} disabled={submitting || ordered.length === 0} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#E3B23C] px-4 py-3 text-sm font-bold text-slate-950 disabled:opacity-60">{submitting && <Loader2 className="h-4 w-4 animate-spin" />} {submitting ? "A registar pagamento…" : Number(amount) >= total ? "Liquidar dívida e emitir recibo" : "Registar pagamento parcial e emitir recibo"}</button>
         </div>
       </DialogContent>
     </Dialog>
```
