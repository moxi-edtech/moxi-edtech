import { redirect } from "next/navigation";
import { getFormacaoAuthContext } from "@/lib/auth-context";
import { getFeatureDeniedMessage, getFormacaoPlanContext, isFormacaoFeatureAllowed } from "@/lib/plan";
import FaturacaoB2BClient from "./FaturacaoB2BClient";

export const dynamic = "force-dynamic";

export default async function FaturacaoB2BPage() {
  const auth = await getFormacaoAuthContext();
  if (!auth) redirect("/login");

  if (!["formacao_financeiro", "formacao_admin", "super_admin", "global_admin"].includes(String(auth.role))) {
    redirect("/forbidden");
  }

  const planCtx = await getFormacaoPlanContext();
  const allowed = isFormacaoFeatureAllowed(planCtx.plan, "faturacao_b2b");
  if (!allowed) {
    return (
      <div style={{ display: "grid", gap: 14 }}>
        <h1 style={{ margin: 0 }}>Faturação B2B</h1>
        <section style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 12 }}>
          {getFeatureDeniedMessage(planCtx.plan, "faturacao_b2b")}
        </section>
      </div>
    );
  }

  return <FaturacaoB2BClient />;
}
