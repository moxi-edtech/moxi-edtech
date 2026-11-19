import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRoleInSchool } from "@/lib/authz";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { BALCAO_HISTORIC_OPERATOR_ROLES } from "@/lib/academico/authorize-balcao-academic-write";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const Grade = z.object({
  disciplina_id: z.string().uuid(),
  trimestre: z.number().int().min(1).max(3),
  tipo_avaliacao: z.enum(["MAC", "NPP", "NPT"]),
  valor: z.number().finite().min(0).max(20),
});
const Body = z.object({
  matricula_id: z.string().uuid(),
  notas: z.array(Grade).min(1).max(100),
});

async function session() {
  const db = await supabaseServerTyped<any>();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { db, escolaId: null, failure: NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 }) };
  const escolaId = await resolveEscolaIdForUser(db, user.id, null);
  if (!escolaId) return { db, escolaId: null, failure: NextResponse.json({ ok: false, error: "Escola não identificada." }, { status: 403 }) };
  const permission = await requireRoleInSchool({ supabase: db, escolaId, roles: [...BALCAO_HISTORIC_OPERATOR_ROLES] });
  return { db, escolaId, failure: permission.error ?? null };
}

function dbFailure(message: string) {
  const code = message.split(":")[0].trim();
  const status = code === "AUTH" ? 403 : code === "DATA" ? 400 :
    /HISTORIC_|ACADEMIC_/.test(code) ? 409 : 500;
  return NextResponse.json({ ok: false, code, error: message }, { status });
}

export async function GET(request: Request) {
  try {
    const id = z.string().uuid().safeParse(new URL(request.url).searchParams.get("matricula_id"));
    if (!id.success) return NextResponse.json({ ok: false, error: "Matrícula inválida." }, { status: 400 });
    const { db, escolaId, failure } = await session();
    if (failure || !escolaId) return failure!;
    const { data, error } = await db.rpc("balcao_obter_notas_complementares" as any,
      { p_escola_id: escolaId, p_matricula_id: id.data } as any);
    if (error) return dbFailure(error.message);
    if (data?.ok !== true || data?.matricula_id !== id.data) {
      return NextResponse.json({ ok: false, error: "Não foi possível confirmar o histórico." }, { status: 409 });
    }
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    console.error("[balcao/grade-complement] GET", cause);
    return NextResponse.json({ ok: false, error: "Falha na consulta das notas do histórico." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const parsed = Body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ ok: false, error: "Reveja a disciplina, o trimestre e as notas." }, { status: 400 });
    const { db, escolaId, failure } = await session();
    if (failure || !escolaId) return failure!;
    const { data, error } = await db.rpc("balcao_complementar_notas_historicas" as any, {
      p_escola_id: escolaId,
      p_matricula_id: parsed.data.matricula_id,
      p_notas: parsed.data.notas,
    } as any);
    if (error) return dbFailure(error.message);
    if (data?.ok !== true) return NextResponse.json({ ok: false, error: "O registo das notas não foi confirmado." }, { status: 409 });
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    console.error("[balcao/grade-complement] POST", cause);
    return NextResponse.json({ ok: false, error: "Não foi possível guardar as notas." }, { status: 500 });
  }
}
