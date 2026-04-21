import Link from "next/link";
import { getDefaultFormacaoPath, getFormacaoAuthContext } from "@/lib/auth-context";

export default async function ForbiddenPage() {
  const auth = await getFormacaoAuthContext();
  const defaultPath = getDefaultFormacaoPath(auth?.role);

  return (
    <main className="grid min-h-screen place-items-center p-6">
      <section className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h1 className="mt-0 text-2xl font-bold text-zinc-900">Acesso negado</h1>
        <p className="text-zinc-600">Este papel não tem permissão para aceder a esta área.</p>
        <Link href={defaultPath} className="text-sm font-medium text-zinc-800 underline underline-offset-2">
          Voltar ao dashboard
        </Link>
      </section>
    </main>
  );
}
