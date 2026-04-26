import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getDefaultFormacaoPath, getFormacaoAuthContext } from "@/lib/auth-context";

export const dynamic = "force-dynamic";

export default async function FormacaoHomePage() {
  const auth = await getFormacaoAuthContext();
  if (auth?.userId) {
    redirect(getDefaultFormacaoPath(auth.role, auth.tenantType));
  }

  return (
    <main className="grid min-h-screen place-items-center p-6">
      <section className="w-full max-w-3xl rounded-3xl border border-zinc-200 bg-white p-7 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-klasse-gold/15 ring-1 ring-klasse-gold/30 flex items-center justify-center">
            <Image src="/logo-klasse-ui.png" alt="KLASSE" width={20} height={20} className="h-5 w-5 object-contain" />
          </div>
          <span className="text-sm font-semibold text-zinc-900">KLASSE</span>
        </div>
        <p className="m-0 text-xs uppercase tracking-[0.14em] text-zinc-500">
          KLASSE Multi-Product
        </p>
        <h1 className="mb-2 mt-2.5 text-4xl font-bold text-zinc-900">Formação</h1>
        <p className="m-0 text-zinc-600">
          Entrypoint dedicado para operações de formação, com autenticação e backend partilhados.
        </p>
        <div className="mt-6 flex gap-3">
          <Link
            href="/login"
            className="rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50"
          >
            Entrar
          </Link>
          <Link
            href="/dashboard"
            className="rounded-xl border border-zinc-900 bg-zinc-900 px-3.5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
          >
            Abrir dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
