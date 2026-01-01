import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { normalizeAnoLetivo } from "@/lib/financeiro/tabela-preco";

export const dynamic = "force-dynamic";

function isUUID(value?: string | null) {
  if (!value) return false;
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value);
}

async function resolverEscolaId(client: any, user: any, provided?: string | null) {
  if (provided && isUUID(provided)) return provided;

  try {
    const { data } = await client.rpc("current_tenant_escola_id");
    if (data && isUUID(data as string)) return data as string;
  } catch {}

  const claimEscola = (user?.app_metadata?.escola_id || user?.user_metadata?.escola_id) as
    | string
    | undefined;
  if (claimEscola && isUUID(claimEscola)) return claimEscola;

  try {
    const { data: prof } = await client
      .from("profiles")
      .select("current_escola_id, escola_id")
      .eq("user_id", user?.id)
      .order("created_at", { ascending: false })
      .limit(1);
    const perfil = prof?.[0] as any;
    if (perfil?.current_escola_id && isUUID(perfil.current_escola_id)) return perfil.current_escola_id;
    if (perfil?.escola_id && isUUID(perfil.escola_id)) return perfil.escola_id;
  } catch {}

  try {
    const { data: vinc } = await client
      .from("escola_users")
      .select("escola_id")
      .eq("user_id", user?.id)
      .limit(1);
    const escola = (vinc?.[0] as { escola_id?: string | null })?.escola_id;
    if (escola && isUUID(escola)) return escola;
  } catch {}

  return null;
}

async function usuarioTemAcessoEscola(client: any, userId: string, escolaId: string) {
  if (!escolaId) return false;

  try {
    const { data: prof } = await client
      .from("profiles")
      .select("current_escola_id, escola_id, role")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1);

    const perfil = prof?.[0] as any;
    const role = perfil?.role as string | undefined;
    if (role === "super_admin") return true;
    if (perfil?.current_escola_id === escolaId || perfil?.escola_id === escolaId) return true;
  } catch {}

  try {
    const { data: vinc } = await client
      .from("escola_users")
      .select("user_id")
      .eq("user_id", userId)
      .eq("escola_id", escolaId)
      .limit(1);
    if (vinc && (vinc as any[])?.length > 0) return true;
  } catch {}

  try {
    const { data: adminLink } = await client
      .from("escola_administradores")
      .select("user_id")
      .eq("escola_id", escolaId)
      .eq("user_id", userId)
      .limit(1);
    if (adminLink && (adminLink as any[])?.length > 0) return true;
  } catch {}

  return false;
}

export async function GET(req: Request) {
  try {
    const supabase = await supabaseServer();
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const url = new URL(req.url);
    const escolaParam = url.searchParams.get("escola_id") || url.searchParams.get("escolaId");
    const anoParam = url.searchParams.get("ano_letivo") || url.searchParams.get("ano");

    const escolaId = await resolverEscolaId(supabase as any, user, escolaParam);
    if (!escolaId) return NextResponse.json({ ok: true, items: [], escolaId: null });

    const autorizado = await usuarioTemAcessoEscola(supabase as any, user.id, escolaId);
    if (!autorizado)
      return NextResponse.json({ ok: false, error: "Sem permissão para consultar preços" }, { status: 403 });

    const anoLetivo = normalizeAnoLetivo(anoParam);

    const { data, error } = await (supabase as any).rpc("get_classes_sem_preco", {
      p_escola_id: escolaId,
      p_ano_letivo: anoLetivo,
    });

    if (error)
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    return NextResponse.json({
      ok: true,
      escolaId,
      anoLetivo,
      items: (data as any[]) || [],
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

