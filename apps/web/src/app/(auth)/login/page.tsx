import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import BrandPanel from "./BrandPanel";
import LoginForm from "./LoginForm";

export const metadata: Metadata = {
  title: "Login • Klasse",
  description: "Acesse sua conta Klasse.",
  robots: {
    index: false,
    follow: false,
  },
};

function normalizeRedirect(redirectRaw: string | undefined, origin: string) {
  const value = String(redirectRaw ?? "").trim();
  if (!value) return `${origin}/redirect`;
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  if (value.startsWith("/")) return `${origin}${value}`;
  return `${origin}/${value}`;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; next?: string }>;
}) {
  const shouldUseCentralAuth =
    process.env.KLASSE_USE_CENTRAL_AUTH === "1" || process.env.NODE_ENV === "production";

  if (shouldUseCentralAuth) {
    const authLoginUrl = (process.env.KLASSE_AUTH_URL ?? "https://auth.klasse.ao/login").trim();
    const params = await searchParams;
    const headerStore = await headers();
    const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
    const protocol = process.env.NODE_ENV === "development" ? "http" : "https";
    const origin = host
      ? `${protocol}://${host}`
      : (process.env.NEXT_PUBLIC_BASE_URL ?? "https://app.klasse.ao").replace(/\/$/, "");
    const redirectTarget = normalizeRedirect(
      typeof params.redirect === "string" ? params.redirect : params.next,
      origin
    );

    try {
      const url = new URL(authLoginUrl);
      url.searchParams.set("redirect", redirectTarget);
      redirect(url.toString());
    } catch {
      redirect(`${authLoginUrl}?redirect=${encodeURIComponent(redirectTarget)}`);
    }
  }

  return (
    <div className="min-h-screen w-full grid grid-cols-1 md:grid-cols-2">
      <BrandPanel />
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-[420px]">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
