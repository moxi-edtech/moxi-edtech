import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { authorizeTurmasManage } from "@/lib/escola/disciplinas";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import {
  AcademicYearContextError,
  resolveAcademicYearContext,
} from "@/lib/academic-year/context";
import {
  listGradeTurmas,
  MAX_GRADE_TURMAS_OFFSET,
} from "@/lib/secretaria/grade-class-picker";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const supabase = await supabaseServerTyped();
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) {
      return NextResponse.json({ ok: false, error: "Sessão expirada. Volte a iniciar sessão." }, { status: 401 });
    }

    const url = new URL(request.url);
    const requestedId = url.searchParams.get("ano_letivo_id");
    const rawOffset = url.searchParams.get("offset") ?? "0";
    if (!/^(0|[1-9]\d*)$/.test(rawOffset)) {
      return NextResponse.json({ ok: false, error: "Página de turmas inválida." }, { status: 400 });
    }
    const offset = Number(rawOffset);
    if (!Number.isSafeInteger(offset) || offset > MAX_GRADE_TURMAS_OFFSET) {
      return NextResponse.json({ ok: false, error: "Página de turmas inválida." }, { status: 400 });
    }

    const escolaId = await resolveEscolaIdForUser(supabase, auth.user.id);
    if (!escolaId) {
      return NextResponse.json({ ok: false, error: "Escola não encontrada." }, { status: 403 });
    }
    const authorization = await authorizeTurmasManage(supabase, escolaId, auth.user.id);
    if (!authorization.allowed) {
      return NextResponse.json({ ok: false, error: authorization.reason || "Sem permissão." }, { status: 403 });
    }
    const context = await resolveAcademicYearContext(supabase, {
      userId: auth.user.id,
      requestedAcademicYearId: requestedId,
      operation: "READ",
    });
    if (context.escolaId !== escolaId) {
      return NextResponse.json({ ok: false, error: "Contexto da escola inválido." }, { status: 403 });
    }
    const result = await listGradeTurmas(
      supabase as unknown as Parameters<typeof listGradeTurmas>[0],
      escolaId,
      context.anoLetivoId,
      offset,
    );
    return NextResponse.json({ ok: true, ...result, ano_letivo_id: context.anoLetivoId });
  } catch (error) {
    if (error instanceof AcademicYearContextError) {
      return NextResponse.json(
        { ok: false, code: error.code, error: error.message },
        { status: error.status },
      );
    }
    return NextResponse.json({ ok: false, error: "Não foi possível carregar as turmas. Tente novamente." }, { status: 500 });
  }
}
