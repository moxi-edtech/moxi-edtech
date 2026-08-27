import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { requireRoleInSchool } from "@/lib/authz";
import { AcademicYearContextError, resolveAcademicYearContext } from "@/lib/academic-year/context";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const periodSchema = z.object({
  id: z.string().uuid().optional(),
  ano_letivo_id: z.string().uuid(),
  tipo: z.enum(["TRIMESTRE", "SEMESTRE", "BIMESTRE"]),
  numero: z.number().int().min(1).max(4),
  data_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  data_fim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  trava_notas_em: z.string().datetime().optional().nullable(),
  peso: z.number().int().min(0).max(100).optional().nullable(),
});

const bodySchema = z.object({
  ano_letivo_id: z.string().uuid(),
  data_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  data_fim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodos: z.array(periodSchema).max(20),
  motivo: z.string().trim().min(5).max(1000).optional(),
});

function isValidDateRange(start: string, end: string) {
  return start <= end;
}

function hasOverlap(periodos: Array<{ data_inicio: string; data_fim: string }>) {
  const sorted = [...periodos].sort((a, b) => a.data_inicio.localeCompare(b.data_inicio));
  return sorted.some((periodo, index) => index > 0 && periodo.data_inicio <= sorted[index - 1].data_fim);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await supabaseServerTyped<any>();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const { id: requestedEscolaId } = await params;
    const escolaId = await resolveEscolaIdForUser(supabase, auth.user.id, requestedEscolaId);
    if (!escolaId) return NextResponse.json({ ok: false, error: "Sem permissão para esta escola." }, { status: 403 });
    const authz = await requireRoleInSchool({
      supabase,
      escolaId,
      roles: ["admin", "admin_escola", "staff_admin", "admin_secretaria", "admin_financeiro", "diretor", "secretaria"],
    });
    if (authz.error) return authz.error;

    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
    const body = parsed.data;

    if (!isValidDateRange(body.data_inicio, body.data_fim)) {
      return NextResponse.json({ ok: false, error: "A data de início do ano letivo deve ser anterior à data de fim." }, { status: 400 });
    }
    if (body.periodos.some((periodo) => periodo.ano_letivo_id !== body.ano_letivo_id)) {
      return NextResponse.json({ ok: false, error: "Todos os períodos devem pertencer ao ano letivo selecionado." }, { status: 400 });
    }
    if (body.periodos.some((periodo) => !isValidDateRange(periodo.data_inicio, periodo.data_fim))) {
      return NextResponse.json({ ok: false, error: "Existe um período com datas inválidas." }, { status: 400 });
    }
    if (hasOverlap(body.periodos)) {
      return NextResponse.json({ ok: false, error: "Os períodos letivos não podem sobrepor-se." }, { status: 400 });
    }
    if (body.periodos.some((periodo) => periodo.data_inicio < body.data_inicio || periodo.data_fim > body.data_fim)) {
      return NextResponse.json({ ok: false, error: "Os períodos devem estar dentro do intervalo do ano letivo." }, { status: 400 });
    }

    const context = await resolveAcademicYearContext(supabase, {
      userId: auth.user.id,
      requestedAcademicYearId: body.ano_letivo_id,
      operation: "READ",
    });
    if (context.status === "CLOSED") {
      return NextResponse.json({ ok: false, error: "O ano letivo encerrado não pode ser alterado.", code: "ACADEMIC_YEAR_CLOSED" }, { status: 409 });
    }

    const { data: year, error: yearError } = await supabase
      .from("anos_letivos")
      .update({ data_inicio: body.data_inicio, data_fim: body.data_fim })
      .eq("id", body.ano_letivo_id)
      .eq("escola_id", escolaId)
      .select("id, data_inicio, data_fim")
      .maybeSingle();
    if (yearError) throw yearError;
    if (!year) return NextResponse.json({ ok: false, error: "Ano letivo não encontrado nesta escola." }, { status: 404 });

    const { error: periodsError } = await supabase.rpc("upsert_bulk_periodos_letivos", {
      p_escola_id: escolaId,
      p_periodos_data: body.periodos,
    });
    if (periodsError) throw periodsError;

    const { error: auditError } = await supabase.from("audit_logs").insert({
      escola_id: escolaId,
      actor_id: auth.user.id,
      action: "CALENDARIO_EXCECAO_MANUAL_ATUALIZADA",
      entity: "anos_letivos",
      entity_id: body.ano_letivo_id,
      portal: "admin",
      details: {
        motivo: body.motivo ?? "Ajuste manual do calendário escolar",
        fonte_normativa: "calendario_oficial_med",
        quantidade_periodos: body.periodos.length,
        data_inicio: body.data_inicio,
        data_fim: body.data_fim,
      },
    });
    if (auditError) throw auditError;

    return NextResponse.json({ ok: true, context, year, periods: body.periodos });
  } catch (cause) {
    if (cause instanceof AcademicYearContextError) {
      return NextResponse.json({ ok: false, error: cause.message, code: cause.code }, { status: cause.status });
    }
    return NextResponse.json({ ok: false, error: cause instanceof Error ? cause.message : "Não foi possível guardar o calendário." }, { status: 500 });
  }
}
