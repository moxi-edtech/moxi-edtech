import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isRefreshTokenNotFoundError } from "@/lib/auth/isRefreshTokenNotFoundError";
import { supabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function resolveAuthLoginUrl(host: string, isLocalHost: boolean) {
  if (process.env.NODE_ENV !== "production") {
    if (host.startsWith("localhost") || host.startsWith("127.0.0.1")) {
      return (process.env.KLASSE_AUTH_LOCALHOST_URL ?? "http://localhost:3000/login").trim();
    }

    return (
      process.env.KLASSE_AUTH_LOCAL_URL ??
      "http://auth.lvh.me:3000/login"
    ).trim();
  }

  const configured = process.env.KLASSE_AUTH_URL?.trim();
  if (!configured) {
    throw new Error(
      `Missing KLASSE_AUTH_URL in production for host "${host || "unknown"}" (isLocalHost=${isLocalHost})`
    );
  }
  return configured;
}

export default async function Page() {
  // 🔑 1. Verifica se já existe uma sessão ativa no servidor
  const supabase = await supabaseServer();
  let user: Awaited<ReturnType<typeof supabase.auth.getUser>>["data"]["user"] = null;
  try {
    const userResult = await supabase.auth.getUser();
    user = userResult.data.user;
  } catch (error) {
    if (isRefreshTokenNotFoundError(error)) {
      return redirect("/redirect");
    }
    throw error;
  }

  if (user) {
    // Se o usuário já está logado, pula o login e vai para o roteador interno
    return redirect("/redirect");
  }

  const headerStore = await headers();
  const host = (headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? "")
    .split(",")[0]
    .trim()
    .toLowerCase();
  const isLocalHost =
    host.startsWith("localhost") ||
    host.startsWith("127.0.0.1") ||
    host.endsWith(".localhost") ||
    host.endsWith(".lvh.me");

  const authLoginUrl = resolveAuthLoginUrl(host, isLocalHost);

  const protocol = process.env.NODE_ENV === "development" ? "http" : "https";
  const origin = host
    ? `${protocol}://${host}`
    : (process.env.NEXT_PUBLIC_BASE_URL ?? "https://app.klasse.ao").replace(/\/$/, "");
  const returnTo = `${origin}/redirect`;

  try {
    const url = new URL(authLoginUrl);
    url.searchParams.set("redirect", returnTo);
    redirect(url.toString());
  } catch {
    redirect(`${authLoginUrl}?redirect=${encodeURIComponent(returnTo)}`);
  }
}
