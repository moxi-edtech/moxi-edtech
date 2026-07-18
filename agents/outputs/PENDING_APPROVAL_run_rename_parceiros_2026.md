# Aprovação necessária — Agent 3
run_id:    run_rename_parceiros_2026
timestamp: 2026-07-05T08:50:00Z

## Acção proposta
Renomear todas as rotas frontend e painéis visuais de `/influencers` para `/parceiros` e `/super-admin/influencers` para `/super-admin/parceiros`, neutralizando a URL exposta aos parceiros e no menu do Super Admin.

Os seguintes diretórios serão movidos:
- `apps/web/src/app/influencers` -> `apps/web/src/app/parceiros`
- `apps/web/src/app/super-admin/influencers` -> `apps/web/src/app/super-admin/parceiros`

## Diff
```diff
diff --git a/apps/web/src/lib/sidebarNav.ts b/apps/web/src/lib/sidebarNav.ts
index xxxxxxx..xxxxxxx 100644
--- a/apps/web/src/lib/sidebarNav.ts
+++ b/apps/web/src/lib/sidebarNav.ts
@@ -34,3 +34,3 @@ export const sidebarConfig: SidebarConfig = {
     { href: "/super-admin/onboarding", label: "Onboarding", icon: "UserPlus", badge: "Novo" },
-    { href: "/super-admin/influencers", label: "Influencers", icon: "UsersRound" },
+    { href: "/super-admin/parceiros", label: "Parceiros", icon: "UsersRound" },
     { href: "/super-admin/marketing", label: "Marketing", icon: "Megaphone" },

diff --git a/apps/web/src/components/super-admin/MarketingSection.tsx b/apps/web/src/components/super-admin/MarketingSection.tsx
index xxxxxxx..xxxxxxx 100644
--- a/apps/web/src/components/super-admin/MarketingSection.tsx
+++ b/apps/web/src/components/super-admin/MarketingSection.tsx
@@ -75,3 +75,3 @@ export function MarketingSection() {
-          <Link href="/super-admin/influencers" className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors">
+          <Link href="/super-admin/parceiros" className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors">

diff --git a/apps/web/src/app/api/super-admin/crm/overview/route.ts b/apps/web/src/app/api/super-admin/crm/overview/route.ts
index xxxxxxx..xxxxxxx 100644
--- a/apps/web/src/app/api/super-admin/crm/overview/route.ts
+++ b/apps/web/src/app/api/super-admin/crm/overview/route.ts
@@ -525,3 +525,3 @@ export async function GET() {
-        action_href: "/super-admin/influencers",
+        action_href: "/super-admin/parceiros",

diff --git a/apps/web/src/app/api/super-admin/influencers/route.ts b/apps/web/src/app/api/super-admin/influencers/route.ts
index xxxxxxx..xxxxxxx 100644
--- a/apps/web/src/app/api/super-admin/influencers/route.ts
+++ b/apps/web/src/app/api/super-admin/influencers/route.ts
@@ -84,3 +84,3 @@ export async function GET() {
-  const portalUrl = "https://app.klasse.ao/influencers";
+  const portalUrl = "https://app.klasse.ao/parceiros";

diff --git a/apps/web/src/app/api/cron/onboarding/sla-alerts/route.ts b/apps/web/src/app/api/cron/onboarding/sla-alerts/route.ts
index xxxxxxx..xxxxxxx 100644
--- a/apps/web/src/app/api/cron/onboarding/sla-alerts/route.ts
+++ b/apps/web/src/app/api/cron/onboarding/sla-alerts/route.ts
@@ -123,3 +123,3 @@ export async function GET() {
-      const partnerUrl = `${baseUrl}/influencers/${request.financeiro?.influencer_codigo || ""}`;
+      const partnerUrl = `${baseUrl}/parceiros/${request.financeiro?.influencer_codigo || ""}`;
```

## Risco
Renomear rotas do Next.js altera o endereço que os usuários usam para acessar o portal. Usuários com links antigos salvos precisarão ser informados, ou precisaremos de um redirecionamento (que será configurado nas rotas).

## Como aprovar
Commit com mensagem: `APPROVE: run_rename_parceiros_2026`

## Como rejeitar
Commit com mensagem: `REJECT: run_rename_parceiros_2026 [motivo]`
