import Link from "next/link";

export const dynamic = "force-dynamic";

export default function MentorAlunosPage() {
  return (
    <main className="space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-5">
        <p className="m-0 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">solo creator</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900">Meus Alunos</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600">
          Ponto único de gestão de alunos do produto Solo Creator.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/mentor/mentorias"
          className="rounded-2xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
        >
          Ver mentorias e inscritos
        </Link>
        <Link
          href="/mentor/vendas"
          className="rounded-2xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
        >
          Ver situação de vendas
        </Link>
      </section>
    </main>
  );
}
