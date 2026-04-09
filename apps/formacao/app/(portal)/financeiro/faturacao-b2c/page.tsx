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
      <div className="grid gap-3.5">
        <h1 className="m-0 text-3xl font-bold text-zinc-900">Faturação B2C</h1>
        <section className="rounded-xl border border-zinc-200 p-3">
          {getFeatureDeniedMessage(planCtx.plan, "faturacao_b2c")}
        </section>
      </div>
    );
  }

  return <FaturacaoB2CClient role={String(auth.role)} userId={String(auth.userId)} />;
}
