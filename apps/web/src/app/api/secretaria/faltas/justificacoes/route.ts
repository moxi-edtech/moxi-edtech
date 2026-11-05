import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { requireRoleInSchool } from "@/lib/authz";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { K12_SECRETARIA_OPERACIONAL_ROLE_GROUP } from "@/lib/roles";
import { recordAuditServer } from "@/lib/audit";
import { resolveRaaTrimestre, type RaaTrimestre } from "@/lib/rematricula/raa-balcao-temporal-context";

export const dynamic = "force-dynamic";
export const revalidate = 0;
const roles: Array<"diretor" | "admin_secretaria" | (typeof K12_SECRETARIA_OPERACIONAL_ROLE_GROUP)[number]> = ["diretor", "admin_secretaria", ...K12_SECRETARIA_OPERACIONAL_ROLE_GROUP];
const Decision = z.object({
  id: z.string().uuid(),
  decision: z.enum(["approved", "rejected"]),
  motivo: z.string().trim().max(1000).optional(),
}).superRefine((data, ctx) => {
  if (data.decision === "rejected" && (!data.motivo || data.motivo.length < 8)) {
    ctx.addIssue({ code: "custom", message: "Explica a rejeição com pelo menos 8 caracteres.", path: ["motivo"] });
  }
});

async function auth() {
  const supabase = await supabaseServerTyped<any>();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { supabase, error: NextResponse.json({ ok: false, error: "Inicia sessão." }, { status: 401 }) };
  const escolaId = await resolveEscolaIdForUser(supabase, data.user.id);
  if (!escolaId) return { supabase, error: NextResponse.json({ ok: false, error: "Escola não identificada." }, { status: 403 }) };
  const access = await requireRoleInSchool({ supabase, escolaId, roles });
  if (access.error) return { supabase, error: access.error };
  return { supabase, escolaId, userId: data.user.id };
}

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const matriculaId = params.get("matricula_id");
    if (matriculaId && !z.string().uuid().safeParse(matriculaId).success) {
      return NextResponse.json({ ok: false, error: "Matrícula inválida." }, { status: 400 });
    }
    const result = await auth();
    if (result.error || !result.escolaId) return result.error;
    const { supabase, escolaId } = result;
    // A scoped Balcão case shows the real historical decisions as well as
    // pending requests; the school-wide secretary queue remains pending-only.
    let builder = supabase.from("aluno_falta_justificacoes")
      .select("id,aluno_id,matricula_id,frequencia_id,data_falta,motivo,status,created_at")
      .eq("escola_id", escolaId);
    if (matriculaId) builder = builder.eq("matricula_id", matriculaId);
    else builder = builder.eq("status", "pending");
    const { data, error } = await builder.order("created_at", { ascending: true }).limit(100);
    if (error) throw error;
    const ids: string[] = [...new Set((data ?? []).map((item: {aluno_id: string}) => item.aluno_id))];
    const { data: alunos, error: alunosError } = ids.length
      ? await supabase.from("alunos").select("id,nome,nome_completo,numero_processo")
        .eq("escola_id", escolaId).in("id", ids)
      : { data: [], error: null };
    if (alunosError) throw alunosError;
    const trimesterByPetition = new Map<string, RaaTrimestre>();
    if (matriculaId && (data ?? []).length > 0) {
      // Resolve the academic period by the attendance row's official period ID.
      // Never infer a trimester from data_falta: offering calendars may differ.
      const { data: source, error: sourceError } = await supabase.from("matriculas")
        .select("id,session_id").eq("id", matriculaId).eq("escola_id", escolaId).maybeSingle();
      if (sourceError) throw sourceError;
      if (!source?.session_id) {
        return NextResponse.json({
          ok: false, error: "Não foi possível confirmar o ano letivo da matrícula de origem.",
        }, { status: 409 });
      }
      const idsFrequencia = [...new Set((data ?? [])
        .map((item: { frequencia_id?: string | null }) => item.frequencia_id)
        .filter((id: string | null | undefined): id is string => Boolean(id)))];
      if (idsFrequencia.length > 0) {
        const { data: frequencias, error: frequenciasError } = await supabase.from("frequencias")
          .select("id,periodo_letivo_id").eq("escola_id", escolaId)
          .eq("matricula_id", matriculaId).in("id", idsFrequencia).limit(100);
        if (frequenciasError) throw frequenciasError;
        const periodIds = [...new Set((frequencias ?? [])
          .map((item: { periodo_letivo_id?: string | null }) => item.periodo_letivo_id)
          .filter((id: string | null | undefined): id is string => Boolean(id)))];
        const { data: periods, error: periodsError } = periodIds.length > 0
          ? await supabase.from("periodos_letivos")
            .select("id,numero,tipo,ano_letivo_id").eq("escola_id", escolaId)
            .eq("ano_letivo_id", source.session_id).in("id", periodIds).limit(100)
          : { data: [], error: null };
        if (periodsError) throw periodsError;
        const periodsById = new Map((periods ?? []).map((item: {
          id: string; numero: number; tipo: string; ano_letivo_id: string;
        }) => [item.id, item] as const));
        const frequenciesById = new Map((frequencias ?? []).map((item: {
          id: string; periodo_letivo_id: string | null;
        }) => [item.id, item] as const));
        for (const item of data ?? []) {
          const attendance = frequenciesById.get(String(item.frequencia_id));
          const trimestre = resolveRaaTrimestre(
            attendance ?? null, periodsById, source.session_id,
          );
          if (trimestre !== null) trimesterByPetition.set(String(item.id), trimestre);
        }
      }
    }
    const byId = new Map((alunos ?? []).map((item: {id: string}) => [item.id, item] as const));
    return NextResponse.json({
      ok: true,
      items: (data ?? []).map((item: { id: string; aluno_id: string }) => ({
        ...item, aluno: byId.get(item.aluno_id) ?? null,
        ...(matriculaId ? { trimestre: trimesterByPetition.get(item.id) ?? null } : {}),
      })),
    });
  } catch (error) {
    console.error("[secretaria/faltas] list failed:", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ ok: false, error: "Não foi possível carregar as justificações." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const result = await auth();
    if (result.error || !result.escolaId || !result.userId) return result.error;
    const parsed = Decision.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Decisão inválida." }, { status: 400 });
    const { supabase, escolaId, userId } = result;
    const { data: petition, error: getError } = await supabase.from("aluno_falta_justificacoes")
      .select("id,aluno_id,matricula_id,frequencia_id,data_falta,status")
      .eq("id", parsed.data.id).eq("escola_id", escolaId).eq("status", "pending").maybeSingle();
    if (getError) throw getError;
    if (!petition) return NextResponse.json({ ok: false, error: "Esta solicitação já foi tratada ou não existe." }, { status: 409 });
    const { data: freq, error: freqError } = await supabase.from("frequencias")
      .select("id").eq("id", petition.frequencia_id)
      .eq("matricula_id", petition.matricula_id).eq("escola_id", escolaId)
      .eq("data", petition.data_falta).eq("status", "falta").limit(1).maybeSingle();
    if (freqError) throw freqError;
    // Uma falta alterada não pode ser aprovada retroativamente. A secretaria
    // pode, porém, rejeitar o pedido com motivo e encerrar a pendência órfã.
    if (!freq && parsed.data.decision === "approved") return NextResponse.json({
      ok: false, error: "A falta original foi alterada. Reveja a frequência antes de aprovar.",
    }, { status: 409 });

    const { data: decided, error: updateError } = await supabase.from("aluno_falta_justificacoes")
      .update({
        status: parsed.data.decision,
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
        decision_reason: parsed.data.motivo || null,
      })
      .eq("id", petition.id).eq("escola_id", escolaId).eq("status", "pending")
      .select("id,status").maybeSingle();
    if (updateError) throw updateError;
    if (!decided) return NextResponse.json({ ok: false, error: "Outra pessoa já concluiu esta solicitação." }, { status: 409 });
    await recordAuditServer({
      escolaId, portal: "secretaria",
      acao: parsed.data.decision === "approved" ? "FALTA_JUSTIFICACAO_APROVADA" : "FALTA_JUSTIFICACAO_REJEITADA",
      entity: "aluno_falta_justificacoes", entityId: decided.id,
      details: { aluno_id: petition.aluno_id, frequencia_id: petition.frequencia_id, decisao: parsed.data.decision },
    });
    return NextResponse.json({
      ok: true, item: decided,
      message: parsed.data.decision === "approved"
        ? "Justificação aprovada. O aluno já pode consultar a decisão."
        : "Justificação não aceite. O motivo ficou disponível para o aluno.",
    });
  } catch (error) {
    console.error("[secretaria/faltas] decision failed:", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ ok: false, error: "Não foi possível concluir a decisão. Tenta novamente." }, { status: 503 });
  }
}
