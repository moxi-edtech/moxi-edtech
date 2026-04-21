import { redirect } from "next/navigation";
import { getFormacaoAuthContext } from "@/lib/auth-context";
import { getFeatureDeniedMessage, getFormacaoPlanContext, isFormacaoFeatureAllowed } from "@/lib/plan";
import FaturacaoB2CClient from "./FaturacaoB2CClient";

export const dynamic = "force-dynamic";

export default async function FaturacaoB2CPage() {
  const auth = await getFormacaoAuthContext();
  if (!auth) redirect("/login");

  if (!["formacao_financeiro", "formacao_admin", "super_admin", "global_admin"].includes(String(auth.role))) {
    redirect("/forbidden");
  }

  const planCtx = await getFormacaoPlanContext();
  const allowed = isFormacaoFeatureAllowed(planCtx.plan, "faturacao_b2c");
  if (!allowed) {
    return (
      <div className="grid gap-5">
        <header className="rounded-2xl border border-[#E4EBE6] bg-white p-5">
          <p className="m-0 text-xs font-semibold uppercase tracking-[0.18em] text-[#4A6352]">financeiro · b2c</p>
          <h1 className="mt-1 text-4xl font-semibold leading-tight text-[#111811]">Faturação B2C</h1>
        </header>
        <section className="rounded-2xl border border-amber-200 bg-[#FDF6E3] p-4 text-amber-900">
          {getFeatureDeniedMessage(planCtx.plan, "faturacao_b2c")}
        </section>
      </div>
    );
  }

  return <FaturacaoB2CClient />;
}
