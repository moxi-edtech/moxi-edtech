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
      <div className="grid gap-3.5">
        <h1 className="m-0 text-3xl font-bold text-zinc-900">Faturação B2B</h1>
        <section className="rounded-xl border border-zinc-200 p-3">
          {getFeatureDeniedMessage(planCtx.plan, "faturacao_b2b")}
        </section>
      </div>
    );
  }

  return <FaturacaoB2BClient />;
}
