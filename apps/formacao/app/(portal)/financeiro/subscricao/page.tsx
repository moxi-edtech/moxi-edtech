import { redirect } from "next/navigation";
import { getFormacaoAuthContext } from "@/lib/auth-context";
import SubscricaoClient from "./SubscricaoClient";

export const dynamic = "force-dynamic";

export default async function SubscricaoPage() {
  const auth = await getFormacaoAuthContext();
  if (!auth) redirect("/login");

  if (!["formacao_admin", "formacao_financeiro", "super_admin", "global_admin"].includes(String(auth.role))) {
    redirect("/forbidden");
  }

  return (
    <div className="space-y-6 pb-12">
      <header className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="m-0 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">financeiro centro</p>
          <span className="rounded-full border border-klasse-gold/25 bg-klasse-gold/10 px-3 py-1 text-xs font-semibold text-klasse-gold">
            Subscrição SaaS
          </span>
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-klasse-green">Assinatura KLASSE Formação</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600">
          Acompanhe o plano do centro, o estado da assinatura e os comprovativos enviados para validação.
        </p>
      </header>

      <SubscricaoClient />
    </div>
  );
}
