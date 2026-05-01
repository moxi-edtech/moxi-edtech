import { redirect } from "next/navigation";
import { AlertTriangle, MessageCircle } from "lucide-react";
import { getFormacaoAuthContext } from "@/lib/auth-context";

export const dynamic = "force-dynamic";

export default async function SubscriptionExpiredPage() {
  const auth = await getFormacaoAuthContext();
  if (!auth) redirect("/login");

  const supportHref =
    process.env.KLASSE_FORMACAO_SUPPORT_WHATSAPP_URL?.trim() ||
    process.env.NEXT_PUBLIC_KLASSE_FORMACAO_SUPPORT_WHATSAPP_URL?.trim() ||
    "https://wa.me/244933349106";

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-3xl items-center justify-center">
      <section className="w-full rounded-2xl border border-amber-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-700">
          <AlertTriangle size={28} />
        </div>
        <p className="mt-6 text-xs font-black uppercase tracking-[0.2em] text-amber-700">Subscrição necessária</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950">O período de teste terminou</h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-600">
          O acesso operacional ao centro {auth.tenantName ? `“${auth.tenantName}”` : ""} está temporariamente pausado.
          Os seus dados continuam preservados. Para reativar o portal, fale com a equipa comercial e escolha o plano adequado.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a
            href={supportHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-klasse-green px-5 py-3 text-sm font-bold text-white hover:bg-klasse-green/90"
          >
            <MessageCircle size={17} />
            Falar no WhatsApp
          </a>
          <a
            href="/logout"
            className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            Sair
          </a>
        </div>
      </section>
    </div>
  );
}
