import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

function buildReturnTo(origin: string, redirectRaw: string) {
  const redirectValue = String(redirectRaw).trim();
  if (!redirectValue) return `${origin}/dashboard`;
  if (redirectValue.startsWith("http://") || redirectValue.startsWith("https://")) return redirectValue;
  if (redirectValue.startsWith("/")) return `${origin}${redirectValue}`;
  return `${origin}/${redirectValue}`;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; next?: string }>;
}) {
  const headerStore = await headers();
  const host = (headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? "").trim();
  const cleanHost = host.split(",")[0]?.trim().toLowerCase() ?? "";
  const params = await searchParams;
  const redirectValue =
    typeof params?.redirect === "string" ? params.redirect : (typeof params?.next === "string" ? params.next : "");

  const isLocalHost =
    cleanHost.startsWith("localhost") ||
    cleanHost.startsWith("127.0.0.1") ||
    cleanHost.endsWith(".localhost");

  const authLoginBase = isLocalHost
    ? (process.env.KLASSE_AUTH_LOCAL_URL?.trim() || "http://localhost:3002/login")
    : (process.env.KLASSE_AUTH_URL?.trim() || "https://auth.klasse.ao/login");

  const protocol = isLocalHost ? "http" : "https";
  const origin = host ? `${protocol}://${host}` : (isLocalHost ? "http://localhost:3001" : "https://formacao.klasse.ao");
  const redirectTarget = buildReturnTo(origin.replace(/\/$/, ""), redirectValue);

  if (!isLocalHost || process.env.KLASSE_USE_CENTRAL_AUTH === "1") {
    try {
      const url = new URL(authLoginBase);
      url.searchParams.set("redirect", redirectTarget);
      redirect(url.toString());
    } catch {
      redirect(`${authLoginBase}?redirect=${encodeURIComponent(redirectTarget)}`);
    }
  }

  const target = new URL(authLoginBase);
  target.searchParams.set("redirect", redirectTarget);
  if (target.host === cleanHost && target.pathname === "/login") {
    return (
      <main className="grid min-h-screen place-items-center p-6">
        <section className="w-full max-w-xl rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
          <h1 className="mb-2 text-3xl font-bold text-zinc-900">Login Formação (Local)</h1>
          <p className="mb-4 text-sm text-zinc-600">
            Configure o auth central local em outra porta para concluir o login unificado.
          </p>
          <a
            href={target.toString()}
            className="inline-flex rounded-lg border border-zinc-900 bg-zinc-900 px-4 py-2 text-sm font-medium text-white no-underline hover:bg-zinc-800"
          >
            Ir para login universal local
          </a>
        </section>
      </main>
    );
  }

  return (
    <main className="grid min-h-screen place-items-center p-6">
      <section className="w-full max-w-xl rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
        <h1 className="mb-2 text-3xl font-bold text-zinc-900">Login Formação (Local)</h1>
        <p className="mb-4 text-sm text-zinc-600">
          Em ambiente local, use o auth central e volte para o portal de formação.
        </p>
        <a
          href={target.toString()}
          className="inline-flex rounded-lg border border-zinc-900 bg-zinc-900 px-4 py-2 text-sm font-medium text-white no-underline hover:bg-zinc-800"
        >
          Ir para login universal local
        </a>
      </section>
    </main>
  );
}
