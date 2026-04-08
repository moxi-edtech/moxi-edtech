import { redirect } from "next/navigation";
import { getFormacaoAuthContext } from "@/lib/auth-context";
import { getFeatureDeniedMessage, getFormacaoPlanContext, isFormacaoFeatureAllowed } from "@/lib/plan";
import FaturacaoB2CClient from "./FaturacaoB2CClient";

export const dynamic = "force-dynamic";

export default async function FaturacaoB2CPage() {
  const auth = await getFormacaoAuthContext();
  if (!auth) redirect("/login");

  if (!["formando", "formacao_financeiro", "formacao_admin", "super_admin", "global_admin"].includes(String(auth.role))) {
    redirect("/forbidden");
  }

  const planCtx = await getFormacaoPlanContext();
  const allowed = isFormacaoFeatureAllowed(planCtx.plan, "faturacao_b2c");
  if (!allowed) {
    return (
      <div style={{ display: "grid", gap: 14 }}>
        <h1 style={{ margin: 0 }}>Faturação B2C</h1>
        <section style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 12 }}>
          {getFeatureDeniedMessage(planCtx.plan, "faturacao_b2c")}
        </section>
      </div>
    );
  }

  return <FaturacaoB2CClient role={String(auth.role)} userId={String(auth.userId)} />;
}
