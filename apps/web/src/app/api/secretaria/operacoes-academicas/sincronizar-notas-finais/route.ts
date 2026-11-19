import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CURTUME = "3744879f-2e19-4671-8995-78604302d8c5";
// Exact school roles, never broadened through inferred finance aliases.
const ROLES = new Set([
  "admin", "admin_escola", "diretor", "admin_secretaria",
  "admin_secretario", "admin_financeiro",
]);
const Input = z.object({
  acao: z.literal("sincronizar_finais_2025"),
  limite: z.number().int().min(1).max(100).default(80),
}).strict();

async function context() {
  const db = await supabaseServerTyped<any>();
  const { data: { user }, error } = await db.auth.getUser();
  if (error || !user) return { db, allowed: false, response: NextResponse.json({ ok: false, error: "Sessão inválida." }, { status: 401 }) };
  const escolaId = await resolveEscolaIdForUser(db, user.id);
  if (escolaId !== CURTUME) return { db, allowed: false, response: NextResponse.json({ ok: false, error: "Operação disponível apenas para o Curtume." }, { status: 403 }) };
  const { data: membership, error: membershipError } = await db.from("escola_users")
    .select("papel").eq("escola_id", CURTUME).eq("user_id", user.id).maybeSingle();
  if (membershipError || !ROLES.has(String(membership?.papel ?? ""))) {
    return { db, allowed: false, response: NextResponse.json({ ok: false, error: "Sem permissão académica nesta escola." }, { status: 403 }) };
  }
  return { db, allowed: true, response: null };
}

function failure(message: string) {
  const status = /^AUTH:/i.test(message) ? 403 : /^DATA:/i.test(message) ? 400 : 409;
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function GET() {
  try {
    const ctx = await context();
    if (!ctx.allowed) return ctx.response!;
    const { data, error } = await ctx.db.rpc("curtume_2025_prever_espelhamento_notas", {
      p_escola_id: CURTUME,
    });
    if (error) return failure(error.message);
    if (data?.ok !== true) return failure("Não foi possível verificar os registos da escola.");
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    console.error("[curtume/mfd-sync] GET", cause);
    return NextResponse.json({ ok: false, error: "Falha na verificação da sincronização." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const parsed = Input.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ ok: false, error: "Pedido inválido." }, { status: 400 });
    const ctx = await context();
    if (!ctx.allowed) return ctx.response!;
    const { data, error } = await ctx.db.rpc("curtume_2025_espelhar_notas_finais", {
      p_escola_id: CURTUME, p_limite: parsed.data.limite,
    });
    if (error) return failure(error.message);
    if (data?.ok !== true || !Number.isInteger(Number(data.criadas)) || !Number.isInteger(Number(data.restantes))) {
      return failure("Lote não confirmado. Reconsulte a contagem antes de tentar novamente.");
    }
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    console.error("[curtume/mfd-sync] POST", cause);
    return NextResponse.json({ ok: false, error: "Falha na sincronização. Os lotes anteriores permanecem guardados." }, { status: 500 });
  }
}
