import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { authorizeBalcaoPendingAcademicWrite } from "@/lib/academico/authorize-balcao-academic-write";
import { AcademicYearContextError, assertAcademicYearEntity, resolveAcademicYearContext } from "@/lib/academic-year/context";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const Body = z.object({
  turma_id: z.string().uuid(), ano_letivo_id: z.string().uuid(), matricula_id: z.string().uuid(),
  motivo: z.string().trim().min(12).max(500),
  notas: z.array(z.object({
    turma_disciplina_id: z.string().uuid(), trimestre: z.number().int().min(1).max(3),
    tipo_avaliacao: z.enum(["MAC", "NPP", "NPT"]), valor: z.number().finite().min(0).max(20),
  }).strict()).min(1).max(300),
}).strict();

/** One pupil/year transaction. All writes delegate to the audited historical RPC. */
export async function POST(req: Request) {
  try {
    const db = await supabaseServerTyped<any>();
    const { data: { user } } = await db.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    if (!req.headers.get("idempotency-key")) return NextResponse.json({ ok: false, error: "Idempotency-Key obrigatório" }, { status: 400 });
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ ok: false, error: "Notas inválidas. Reveja os valores." }, { status: 400 });
    const body = parsed.data;
    const escolaId = await resolveEscolaIdForUser(db, user.id);
    if (!escolaId || !await authorizeBalcaoPendingAcademicWrite(db, escolaId, user.id))
      return NextResponse.json({ ok: false, error: "Sem permissão para regularizar estas notas." }, { status: 403 });
    const context = await resolveAcademicYearContext(db, { userId: user.id, requestedAcademicYearId: body.ano_letivo_id, operation: "READ" });
    await assertAcademicYearEntity(db, { table: "turmas", entityId: body.turma_id, escolaId, anoLetivoId: context.anoLetivoId });
    const { data: source, error: sourceError } = await db.from("matriculas").select("id")
      .eq("escola_id", escolaId).eq("id", body.matricula_id).eq("turma_id", body.turma_id).eq("session_id", context.anoLetivoId).maybeSingle();
    if (sourceError) throw sourceError;
    if (!source) return NextResponse.json({ ok: false, error: "Matrícula histórica não encontrada neste ano e turma." }, { status: 404 });
    const { data, error } = await db.rpc("lancar_notas_historicas_individuais", {
      p_escola_id: escolaId, p_matricula_id: source.id, p_notas: body.notas, p_motivo: body.motivo,
    });
    if (error || data?.ok !== true) return NextResponse.json({ ok: false,
      error: error?.message || "Não foi possível guardar. As alterações foram preservadas.", code: error?.code,
    }, { status: error?.code === "42501" ? 403 : 409 });
    return NextResponse.json({ ok: true, data }, { headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    if (cause instanceof AcademicYearContextError) return NextResponse.json({ ok: false, error: cause.message, code: cause.code }, { status: cause.status });
    return NextResponse.json({ ok: false, error: cause instanceof Error ? cause.message : "Não foi possível guardar." }, { status: 500 });
  }
}
