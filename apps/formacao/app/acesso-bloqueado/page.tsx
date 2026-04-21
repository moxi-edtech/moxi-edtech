import Link from "next/link";

export const dynamic = "force-dynamic";

export default function AcessoBloqueadoPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <section className="mx-auto max-w-xl rounded-2xl border border-rose-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-600">Acesso Bloqueado</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Portal temporariamente indisponível</h1>
        <p className="mt-2 text-sm text-slate-600">
          O seu acesso foi bloqueado por situação financeira ou estado académico.
          Contacte a secretaria para regularização.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href="/login"
            className="rounded-lg border border-klasse-gold bg-klasse-gold px-4 py-2 text-sm font-semibold text-white hover:brightness-95"
          >
            Ir para login
          </Link>
          <Link
            href="/"
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Tentar novamente
          </Link>
        </div>
      </section>
    </main>
  );
}
