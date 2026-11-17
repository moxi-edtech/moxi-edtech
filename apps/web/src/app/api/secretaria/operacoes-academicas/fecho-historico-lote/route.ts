import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { supabaseServerTyped } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CURTUME = "3744879f-2e19-4671-8995-78604302d8c5";
const ROLES = new Set(["admin", "admin_escola", "diretor"]);
const Request = z.object({
  acao: z.literal("concluir_2025_2026"),
  confirmacao: z.literal("CONFIRMO_PAUTAS_2025"),
  lote_id: z.string().uuid(),
  cursor: z.string().uuid().nullable(),
}).strict();

async function context() {
  const db = await supabaseServerTyped<any>();
  const { data: { user }, error: authError } = await db.auth.getUser();
  if (authError || !user)
    return { db, allowed: false, response: NextResponse.json({ ok: false, error: "Sessão inválida." }, { status: 401 }) };
  const escola = await resolveEscolaIdForUser(db, user.id);
  if (escola !== CURTUME)
    return { db, allowed: false, response: NextResponse.json({ ok: false, error: "Esta operação está limitada à CURTUME." }, { status: 403 }) };
  // Exact membership — never infer privileged roles from expanded aliases.
  const { data: membership, error } = await db.from("escola_users")
    .select("papel").eq("escola_id", CURTUME).eq("user_id", user.id).maybeSingle();
  if (error || !ROLES.has(String(membership?.papel ?? "")))
    return { db, allowed: false, response: NextResponse.json({ ok: false, error: "A confirmação em lote exige acesso da Direção." }, { status: 403 }) };
  return { db, allowed: true, response: null };
}

/** Read-only count. The write RPC independently validates every pupil. */
export async function GET() {
  try {
    const ctx = await context();
    if (!ctx.allowed) return ctx.response!;
    const { count, error } = await ctx.db.from("historico_anos")
      .select("id", { count: "exact", head: true })
      .eq("escola_id", CURTUME).eq("ano_letivo", 2025)
      .eq("snapshot_status", "aberto");
    if (error) throw error;
    return NextResponse.json({ ok: true, ano_letivo: "2025/2026", abertos: count ?? 0 },
      { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[curtume-historic-batch] preview failed", error);
    return NextResponse.json({ ok: false, error: "Não foi possível consultar os históricos." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await context();
    if (!ctx.allowed) return ctx.response!;
    const parsed = Request.safeParse(await request.json().catch(() => null));
    if (!parsed.success)
      return NextResponse.json({ ok: false, error: "Confirmação do lote inválida." }, { status: 400 });

    // One confirmed click in the UI, paginated internally to avoid long-running
    // PostgREST calls. Atomicity and student-level audit live in PostgreSQL.
    const { data, error } = await ctx.db.rpc("curtume_fechar_pautas_2025_lote", {
      p_escola_id: CURTUME,
      p_lote_id: parsed.data.lote_id,
      p_depois: parsed.data.cursor,
      p_limite: 25,
    });
    if (error) {
      console.error("[curtume-historic-batch] RPC failed", { code: error.code, message: error.message });
      const status = error.code === "42501" ? 403 : error.code === "55P03" ? 409 : 500;
      return NextResponse.json({ ok: false,
        error: status === 409 ? "Outro fecho académico está em execução. Volte a tentar." :
               status === 403 ? "Não autorizado para este lote." : "Não foi possível executar o fecho académico." },
        { status });
    }
    if (data?.ok !== true || !Number.isSafeInteger(Number(data?.processados)))
      return NextResponse.json({ ok: false, error: "Resposta inesperada da operação académica." }, { status: 502 });
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[curtume-historic-batch] request failed", error);
    return NextResponse.json({ ok: false, error: "Falha no processamento do lote." }, { status: 500 });
  }
}
