import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import type { Database } from "~types/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CURTUME_ID = "3744879f-2e19-4671-8995-78604302d8c5";
const ALLOWED_ROLES = new Set([
  "admin", "admin_escola", "diretor", "admin_secretaria",
  "admin_secretario", "admin_financeiro",
]);
const NO_STORE = { "Cache-Control": "private, no-store, max-age=0" };

type MirrorPreview = {
  ok?: boolean; ano?: number; total?: number; elegiveis?: number;
  sincronizadas?: number; documento_ano_divergente?: number;
  historico_aberto?: number; inconsistencias?: number;
};

export async function GET(request: Request) {
  const requestedSchool = new URL(request.url).searchParams.get("escola")?.trim();
  if (!requestedSchool || requestedSchool.length > 150) {
    return NextResponse.json({ ok: false, error: "Escola inválida." }, { status: 400, headers: NO_STORE });
  }
  try {
    const supabase = await supabaseServerTyped<Database>();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ ok: false, error: "Sessão inválida." }, { status: 401, headers: NO_STORE });
    }
    // The requested school is bound to this user. Never infer the tenant from
    // a default school when the page targets an explicit school/slug.
    const escolaId = await resolveEscolaIdForUser(supabase, user.id, requestedSchool);
    if (escolaId !== CURTUME_ID) {
      return NextResponse.json({ ok: false, error: "Sem acesso a esta operação." }, { status: 403, headers: NO_STORE });
    }
    const { data: membership, error: roleError } = await supabase.from("escola_users")
      .select("papel").eq("escola_id", escolaId).eq("user_id", user.id).maybeSingle();
    if (roleError || !ALLOWED_ROLES.has(String(membership?.papel ?? ""))) {
      return NextResponse.json({ ok: false, error: "Sem permissão académica nesta escola." }, { status: 403, headers: NO_STORE });
    }
    // Preview is the installed, tenant-scoped canonical RPC. No local count,
    // no service_role, no mutation and no replay of 20271119 migration SQL.
    const client = supabase as unknown as {
      rpc: (name: "curtume_2025_prever_espelhamento_notas", args: {
        p_escola_id: string;
      }) => Promise<{ data: MirrorPreview | null; error: { message: string } | null }>;
    };
    const { data, error } = await client.rpc("curtume_2025_prever_espelhamento_notas", {
      p_escola_id: escolaId,
    });
    const counts = [
      data?.total, data?.elegiveis, data?.sincronizadas,
      data?.documento_ano_divergente, data?.historico_aberto, data?.inconsistencias,
    ];
    if (error || data?.ok !== true || data.ano !== 2025 ||
        !counts.every((value) => typeof value === "number" &&
          Number.isSafeInteger(value) && value >= 0) ||
        data.total !== counts.slice(1).reduce((sum, count) => sum + Number(count), 0)) {
      return NextResponse.json({ ok: false, error: "Não foi possível validar o estado das notas finais." },
        { status: 503, headers: NO_STORE });
    }
    return NextResponse.json({
      ok: true, ano: 2025, total: data.total,
      elegiveis: data.elegiveis, sincronizadas: data.sincronizadas,
      documento_ano_divergente: data.documento_ano_divergente,
      historico_aberto: data.historico_aberto, inconsistencias: data.inconsistencias,
    }, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ ok: false, error: "Falha ao consultar os históricos." },
      { status: 503, headers: NO_STORE });
  }
}
