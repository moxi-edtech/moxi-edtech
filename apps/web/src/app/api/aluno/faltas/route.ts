import { NextResponse } from "next/server";
import { z } from "zod";
import { getAlunoContext } from "@/lib/alunoContext";
import { resolveSelectedStudentId } from "@/lib/portalAlunoAuth";
import { resolveBoletimMatricula } from "@/lib/aluno/resolveBoletimMatricula";
import { AcademicYearContextError } from "@/lib/academic-year/context";
import { recordAuditServer } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const RequestSchema = z.object({
  frequencia_id: z.string().uuid(),
  motivo: z.string().trim().min(15, "Descreve o motivo com pelo menos 15 caracteres.").max(2000),
});
type Scope = { escolaId: string; alunoId: string; userId: string; matriculaId: string };
type Petition = {
  id: string; frequencia_id: string; motivo: string; status: "pending" | "approved" | "rejected";
  decision_reason: string | null; created_at: string;
};

function getStudentId(searchParams: URLSearchParams, authorizedIds: string[], fallbackId: string | null) {
  const requestedId = searchParams.get("studentId");
  if (requestedId && !authorizedIds.includes(requestedId)) return null;
  return resolveSelectedStudentId({ selectedId: requestedId, authorizedIds, fallbackId });
}

/** A formal justification may be submitted by a linked guardian or an adult student. */
async function canRequestJustification(supabase: Awaited<ReturnType<typeof getAlunoContext>>["supabase"], scope: Scope) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user || auth.user.id !== scope.userId) return false;
  const [{ data: aluno }, { data: guardians }] = await Promise.all([
    supabase.from("alunos").select("profile_id,data_nascimento")
      .eq("escola_id", scope.escolaId).eq("id", scope.alunoId).maybeSingle(),
    auth.user.email
      ? supabase.from("encarregados").select("id")
        .eq("escola_id", scope.escolaId).eq("email", auth.user.email.trim()).limit(10)
      : Promise.resolve({ data: [] as Array<{ id: string }> }),
  ]);
  const cutoff = new Date();
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 18);
  const isAdultStudent = aluno?.profile_id === scope.userId &&
    typeof aluno.data_nascimento === "string" && aluno.data_nascimento <= cutoff.toISOString().slice(0, 10);
  if (isAdultStudent) return true;
  const guardianIds = (guardians ?? []).map((guardian) => guardian.id);
  if (!guardianIds.length) return false;
  const { data: link, error } = await supabase.from("aluno_encarregados").select("id")
    .eq("escola_id", scope.escolaId).eq("aluno_id", scope.alunoId)
    .in("encarregado_id", guardianIds).limit(1).maybeSingle();
  return !error && !!link;
}

async function resolveScope(request: Request, operation: "READ" | "WRITE") {
  const { supabase, ctx } = await getAlunoContext();
  if (!ctx?.escolaId || !ctx.userId) return { supabase, error: NextResponse.json({ ok: false, error: "Inicia sessão para consultar as faltas." }, { status: 401 }) };
  const params = new URL(request.url).searchParams;
  const alunoId = getStudentId(params, ctx.alunoIds, ctx.alunoId);
  if (!alunoId) return { supabase, error: NextResponse.json({ ok: false, error: "Aluno não autorizado." }, { status: 403 }) };
  const resolved = await resolveBoletimMatricula(supabase, {
    escolaId: ctx.escolaId, alunoId, userId: ctx.userId,
    anoLetivoId: params.get("ano_letivo_id"), operation,
  });
  if (!resolved.matricula?.id) return {
    supabase, error: NextResponse.json({ ok: false, error: "Não foi encontrada matrícula neste ano letivo." }, { status: 404 }),
  };
  return {
    supabase, scope: { escolaId: ctx.escolaId, alunoId, userId: ctx.userId, matriculaId: resolved.matricula.id },
    context: { anoLetivoLabel: resolved.context.anoLetivoLabel, mode: resolved.context.mode },
  };
}

export async function GET(request: Request) {
  try {
    const resolved = await resolveScope(request, "READ");
    if (resolved.error || !resolved.scope) return resolved.error;
    const { supabase, scope } = resolved;
    const base = () => supabase.from("frequencias")
      .select("id", { count: "exact", head: true })
      .eq("escola_id", scope.escolaId).eq("matricula_id", scope.matriculaId);
    const [missing, present, delayed, attendance, petitions, canSubmit] = await Promise.all([
      base().eq("status", "falta"),
      base().eq("status", "presente"),
      base().eq("status", "atraso"),
      supabase.from("frequencias").select("id,data,status,observacao,periodo_letivo_id")
        .eq("escola_id", scope.escolaId).eq("matricula_id", scope.matriculaId)
        .eq("status", "falta").order("data", { ascending: false }).limit(100),
      // Types will be regenerated when the migration is applied.
      (supabase as any).from("aluno_falta_justificacoes")
        .select("id,frequencia_id,motivo,status,decision_reason,created_at")
        .eq("escola_id", scope.escolaId).eq("aluno_id", scope.alunoId)
        .eq("matricula_id", scope.matriculaId).order("created_at", { ascending: false }).limit(250),
      canRequestJustification(supabase, scope),
    ]);
    const failure = missing.error ?? present.error ?? delayed.error ?? attendance.error ?? petitions.error;
    if (failure) throw failure;
    const byFrequency = new Map<string, Petition>();
    for (const item of (petitions.data ?? []) as Petition[]) {
      if (!byFrequency.has(item.frequencia_id)) byFrequency.set(item.frequencia_id, item);
    }
    const items = (attendance.data ?? []).map((item) => ({
      id: item.id, data: item.data, observacao: item.observacao,
      periodo_letivo_id: item.periodo_letivo_id,
      justificacao: byFrequency.get(item.id) ?? null,
    }));
    return NextResponse.json({
      ok: true, context: resolved.context, can_submit: canSubmit && resolved.context?.mode === "CURRENT",
      resumo: { faltas: missing.count ?? 0, presencas: present.count ?? 0, atrasos: delayed.count ?? 0 },
      items, limit: 100, has_more: (missing.count ?? 0) > items.length,
      // No automatic fine, payment or mutation of the original presence record.
      taxa: null,
    });
  } catch (error) {
    if (error instanceof AcademicYearContextError) {
      return NextResponse.json({ ok: false, error: error.message, code: error.code }, { status: error.status });
    }
    console.error("[aluno/faltas] failed to load:", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ ok: false, error: "Não foi possível consultar as faltas. Tenta novamente." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const resolved = await resolveScope(request, "WRITE");
    if (resolved.error || !resolved.scope) return resolved.error;
    const { supabase, scope } = resolved;
    if (!await canRequestJustification(supabase, scope)) {
      return NextResponse.json({ ok: false, error: "A justificação deve ser enviada pelo encarregado de educação ou pelo aluno maior de idade." }, { status: 403 });
    }
    const parsed = RequestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Pedido inválido." }, { status: 400 });

    const { data: falta, error: faltaError } = await supabase.from("frequencias")
      .select("id,data").eq("id", parsed.data.frequencia_id)
      .eq("escola_id", scope.escolaId).eq("matricula_id", scope.matriculaId)
      .eq("status", "falta").limit(1).maybeSingle();
    if (faltaError) throw faltaError;
    if (!falta) return NextResponse.json({ ok: false, error: "Esta falta já não está disponível para justificação." }, { status: 409 });

    const { data: existing, error: existingError } = await (supabase as any).from("aluno_falta_justificacoes")
      .select("id,status").eq("escola_id", scope.escolaId).eq("matricula_id", scope.matriculaId)
      .eq("frequencia_id", falta.id).in("status", ["pending", "approved"])
      .limit(1).maybeSingle();
    if (existingError) throw existingError;
    if (existing) return NextResponse.json({
      ok: true, idempotent: true, status: existing.status,
      message: existing.status === "approved" ? "Esta falta já foi justificada." : "Solicitação já recebida. Aguardando análise da secretaria.",
    });

    const { data, error } = await (supabase as any).from("aluno_falta_justificacoes").insert({
      escola_id: scope.escolaId, aluno_id: scope.alunoId, matricula_id: scope.matriculaId,
      frequencia_id: falta.id, data_falta: falta.data,
      motivo: parsed.data.motivo, submitted_by: scope.userId,
    }).select("id,status").single();
    if (error?.code === "23505") {
      return NextResponse.json({ ok: true, idempotent: true, status: "pending", message: "Solicitação já recebida. Aguardando análise." });
    }
    if (error || !data) throw error ?? Error("Pedido não persistido");
    await recordAuditServer({
      escolaId: scope.escolaId, portal: "aluno", acao: "FALTA_JUSTIFICACAO_SOLICITADA",
      entity: "aluno_falta_justificacoes", entityId: data.id,
      details: { aluno_id: scope.alunoId, matricula_id: scope.matriculaId, frequencia_id: falta.id },
    });
    return NextResponse.json({
      ok: true, status: "pending",
      message: "Solicitação realizada. Aguardando análise da secretaria.",
    }, { status: 201 });
  } catch (error) {
    if (error instanceof AcademicYearContextError) {
      return NextResponse.json({ ok: false, error: error.message, code: error.code }, { status: error.status });
    }
    console.error("[aluno/faltas] failed to submit:", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ ok: false, error: "Não foi possível enviar a justificação. O pedido não foi confirmado; tenta novamente." }, { status: 503 });
  }
}
