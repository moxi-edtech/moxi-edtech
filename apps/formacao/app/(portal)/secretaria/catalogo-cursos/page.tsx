import { redirect } from "next/navigation";
import { getFormacaoAuthContext } from "@/lib/auth-context";
import { supabaseServer } from "@/lib/supabaseServer";
import CatalogoCursosClient from "./CatalogoCursosClient";

export const dynamic = "force-dynamic";

export default async function SecretariaCatalogoCursosPage() {
  const auth = await getFormacaoAuthContext();
  if (!auth) redirect("/login");

  if (!["formacao_secretaria", "formacao_admin", "super_admin", "global_admin"].includes(String(auth.role))) {
    redirect("/forbidden");
  }

  let centroSlug = String(auth.tenantSlug ?? "").trim();
  const s = await supabaseServer();

  // Fallback explícito ao DB: se o slug não veio na sessão, resolve por tenantId.
  if (!centroSlug && auth.tenantId) {
    const { data: escola } = await s.from("escolas").select("slug").eq("id", auth.tenantId).maybeSingle();
    centroSlug = String(escola?.slug ?? "").trim();
  }

  // Fallback adicional: resolve por membership do utilizador (independente do tenantId da sessão).
  if (!centroSlug) {
    const { data: membership, error: membershipError } = await s
      .from("escola_users")
      .select("escola_id,tenant_type")
      .eq("user_id", auth.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const tenantType = String(membership?.tenant_type ?? "").trim().toLowerCase();
    if (tenantType === "formacao" || tenantType === "solo_creator") {
      const { data: escola, error: escolaError } = await s
        .from("escolas")
        .select("slug")
        .eq("id", membership?.escola_id ?? "")
        .maybeSingle();
      if (!escolaError) {
        centroSlug = String(escola?.slug ?? "").trim();
      }
    }

    if (!centroSlug) {
      console.warn(
        JSON.stringify({
          event: "public_slug_resolution_failed",
          user_id: auth.userId,
          tenant_id: auth.tenantId,
          tenant_slug_from_auth: auth.tenantSlug,
          membership_error: membershipError?.message ?? null,
          timestamp: new Date().toISOString(),
        })
      );
    }
  }

  // Fallback final seguro: RPC SECURITY DEFINER mínima para ler apenas o slug autorizado.
  if (!centroSlug) {
    const callGetPublicSlug = s.rpc as unknown as (
      fn: string,
      args: { p_escola_id: string | null }
    ) => Promise<{ data: string | null }>;
    const { data: slugByRpc } = await callGetPublicSlug("get_public_slug_for_current_tenant", {
      p_escola_id: auth.tenantId,
    });
    centroSlug = String(slugByRpc ?? "").trim();
  }

  return <CatalogoCursosClient centroSlug={centroSlug} />;
}
