import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { resolveSessionContext } from "@/lib/session-context";
import { logAuthEvent } from "@/lib/auth-log";

type SearchParams = Promise<{ redirect?: string }>;
type ProductContext = "k12" | "formacao";

function resolveProductBases(host: string) {
  const isLocalHost =
    host.startsWith("localhost") || host.startsWith("127.0.0.1") || host.endsWith(".localhost");

  if (isLocalHost) {
    return {
      k12: process.env.KLASSE_K12_LOCAL_ORIGIN?.trim() || "http://localhost:3000",
      formacao: process.env.KLASSE_FORMACAO_LOCAL_ORIGIN?.trim() || "http://localhost:3001",
    };
  }

  return {
    k12: process.env.NEXT_PUBLIC_KLASSE_K12_URL?.trim() || "https://app.klasse.ao",
    formacao: process.env.NEXT_PUBLIC_KLASSE_FORMACAO_URL?.trim() || "https://formacao.klasse.ao",
  };
}

function normalizeRedirectTarget(raw: string | undefined, expectedBase: string) {
  const value = String(raw ?? "").trim();
  if (!value) return null;

  if (value.startsWith("/")) {
    return `${expectedBase.replace(/\/$/, "")}${value}`;
  }

  try {
    const parsed = new URL(value);
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    const expectedHost = new URL(expectedBase).host;
    if (parsed.host !== expectedHost) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function getDefaultProductPath(product: ProductContext) {
  return product === "formacao" ? "/dashboard" : "/redirect";
}

export default async function RedirectPage({ searchParams }: { searchParams: SearchParams }) {
  const headerStore = await headers();
  const host = (
    headerStore.get("x-forwarded-host") ??
    headerStore.get("host") ??
    ""
  )
    .split(",")[0]
    .trim()
    .toLowerCase();

  const params = await searchParams;
  const hintedProduct = (() => {
    const hinted = String(params.redirect ?? "").toLowerCase();
    if (hinted.includes("formacao.klasse.ao") || hinted.includes("localhost:3001")) return "formacao";
    if (hinted.includes("app.klasse.ao") || hinted.includes("localhost:3000")) return "k12";
    return null;
  })() as ProductContext | null;

  const session = await resolveSessionContext(hintedProduct);

  if (!session) {
    const loginSuffix = params.redirect ? `?redirect=${encodeURIComponent(params.redirect)}` : "";
    logAuthEvent({
      action: "resolve_context_failed",
      route: "/redirect",
      details: { reason: "no_session_context" },
    });
    redirect(`/login${loginSuffix}`);
  }

  const product: ProductContext = session.product_context ?? "k12";
  const bases = resolveProductBases(host);
  const productBase = product === "formacao" ? bases.formacao : bases.k12;
  const preferred = normalizeRedirectTarget(params.redirect, productBase);
  const destination = preferred ?? `${productBase.replace(/\/$/, "")}${getDefaultProductPath(product)}`;
  logAuthEvent({
    action: "redirect",
    route: "/redirect",
    user_id: session.user_id,
    tenant_id: session.tenant_id,
    tenant_type: session.tenant_type,
    details: { destination },
  });

  redirect(destination);
}
