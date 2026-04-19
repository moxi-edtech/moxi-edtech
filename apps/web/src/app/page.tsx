import { headers } from "next/headers";
import { redirect } from "next/navigation";

function resolveAuthLoginUrl(host: string, isLocalHost: boolean) {
  if (process.env.NODE_ENV !== "production") {
    return (process.env.KLASSE_AUTH_LOCAL_URL ?? "http://auth.lvh.me:3000/login").trim();
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
