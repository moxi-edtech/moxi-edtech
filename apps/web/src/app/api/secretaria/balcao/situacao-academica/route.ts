import { NextRequest, NextResponse } from "next/server";
import { requireRoleInSchool } from "@/lib/authz";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { AcademicYearContextError, resolveAcademicYearContext } from "@/lib/academic-year/context";
import { authorizeBalcaoAcademicWrite, authorizeBalcaoPendingAcademicWrite } from "@/lib/academico/authorize-balcao-academic-write";
import { authorizeTurmasManage } from "@/lib/escola/disciplinas";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * A situação escolar NÃO é o estado da rematrícula.
 * Lê apenas a projeção SSOT, que separa vínculo, resultado e ação contextual.
 * Nunca completa notas, altera matrículas ou deduz aprovação a partir de propinas.
 */
export async function GET(req: NextRequest) {
  try {
    const alunoId = req.nextUrl.searchParams.get("aluno_id");
    const requestedYearId = req.nextUrl.searchParams.get("ano_letivo_id");
    if (!alunoId || !UUID.test(alunoId) ||
        (requestedYearId && !UUID.test(requestedYearId))) {
      return json({ ok: false, error: "Aluno ou ano letivo inválido." }, 400);
    }

    const db = await supabaseServerTyped<any>();
    const { data: { user }, error: authError } = await db.auth.getUser();
    if (authError || !user) return json({ ok: false, error: "Não autenticado." }, 401);
    const escolaId = await resolveEscolaIdForUser(db, user.id);
    if (!escolaId) return json({ ok: false, error: "Escola não autorizada." }, 403);

    const authz = await requireRoleInSchool({
      supabase: db, escolaId,
      roles: ["secretaria", "admin_secretaria", "admin_secretario", "secretaria_financeiro", "admin_financeiro", "diretor", "admin", "admin_escola", "staff_admin"],
    });
    if (authz.error) return authz.error;

    const yearContext = await resolveAcademicYearContext(db, {
      userId: user.id, requestedAcademicYearId: requestedYearId, operation: "READ",
    });
    const [{ data: aluno, error: alunoError }, { data: ano, error: anoError }] = await Promise.all([
      db.from("alunos").select("id").eq("escola_id", escolaId).eq("id", alunoId)
        .is("deleted_at", null).maybeSingle(),
      db.from("anos_letivos").select("id, ano, ativo, arquivado_com_pendencias")
        .eq("escola_id", escolaId).eq("id", yearContext.anoLetivoId).maybeSingle(),
    ]);
    if (alunoError || anoError) throw alunoError ?? anoError;
    if (!aluno) return json({ ok: false, error: "Aluno não encontrado nesta escola." }, 404);
    if (!ano || !Number.isInteger(ano.ano)) {
      return json({ ok: false, error: "Ano letivo indisponível nesta escola." }, 409);
    }

    // A view é security_invoker. Nunca consultar outra escola ou substituir
    // erro por "sem matrícula", que seria uma conclusão falsa.
    const { data, error } = await db.from("v_student_lifecycle_status_v2")
      .select("matricula_id, escola_id, aluno_id, ano_letivo, ano_letivo_id, turma_id, status_persistido, situacao_contextual, situacao_resultado, acao_contextual, resultado_oficial")
      .eq("escola_id", escolaId).eq("aluno_id", alunoId)
      .lte("ano_letivo", ano.ano)
      .order("ano_letivo", { ascending: false })
      .limit(50);
    if (error) throw error;
    if ((data ?? []).length === 50) {
      return json({ ok: false, error: "Histórico extenso. É necessária consulta paginada." }, 409);
    }
    const records = data ?? [];
    if (records.some((row: any) => row.escola_id !== escolaId || row.aluno_id !== alunoId)) {
      return json({ ok: false, error: "Inconsistência de isolamento escolar." }, 409);
    }
    const atuais = records.filter((row: any) => Number(row.ano_letivo) === ano.ano);
    if (atuais.length > 1) {
      return json({ ok: false, code: "DUPLICATE_YEAR_ENROLLMENT",
        error: "Há mais de uma matrícula no ano selecionado. Requer revisão de integridade." }, 409);
    }

    const current = atuais[0] ?? null;
    const previous = records.find((row: any) => Number(row.ano_letivo) < ano.ano) ?? null;

    // Só oferecer o modal de nota histórica quando a RPC existente o pode
    // aceitar: ano imediatamente anterior ao ativo, matrícula pendente e
    // papel académico exato. O writer verifica novamente todas as condições.
    const [activeYearResult, canWritePending, canWriteAcademic, canManageTurmas] =
      await Promise.all([
        db.from("anos_letivos").select("ano").eq("escola_id", escolaId)
          .eq("ativo", true).limit(2),
        authorizeBalcaoPendingAcademicWrite(db, escolaId, user.id),
        authorizeBalcaoAcademicWrite(db, escolaId, user.id),
        authorizeTurmasManage(db, escolaId, user.id),
      ]);
    if (activeYearResult.error) throw activeYearResult.error;
    const activeYears = activeYearResult.data ?? [];
    const activeYear = activeYears.length === 1 ? Number(activeYears[0]?.ano) : null;
    const historicalCandidate = canWritePending && activeYear !== null
      ? [current, previous].find((row: any) =>
          row && Number(row.ano_letivo) === activeYear - 1 &&
          row.status_persistido === "pendente" &&
          row.situacao_resultado === "sem_resultado_oficial" &&
          row.turma_id && row.ano_letivo_id
        ) ?? null
      : null;
    // The existing writer only accepts the two official quantitative scales.
    // Never offer a numerical grade for a qualitative preschool class.
    const historicalRegime = historicalCandidate
      ? await db.rpc("resolve_regime_academico", {
          p_turma_id: historicalCandidate.turma_id,
        })
      : null;
    if (historicalRegime?.error) throw historicalRegime.error;
    const historicalGradeScale = String(historicalRegime?.data?.escala ?? "");
    const editableHistoricalMatriculaId =
      ["quantitativa_primario", "quantitativa_secundario"].includes(historicalGradeScale)
        ? historicalCandidate?.matricula_id ?? null : null;

    // Acesso de consulta não equivale a permissão de lançamento.
    // A API de notas continua a validar calendário, turma, regime e RLS.
    const canWriteCurrentGrades = Boolean(
      ano.ativo === true && current?.situacao_contextual === "matriculado" &&
      current?.turma_id && current?.ano_letivo_id &&
      (canWriteAcademic || canManageTurmas.allowed)
    );

    return json({
      ok: true, aluno_id: alunoId,
      ano: { id: ano.id, ano: ano.ano, label: yearContext.anoLetivoLabel,
        ativo: ano.ativo === true, arquivado_com_pendencias: ano.arquivado_com_pendencias === true },
      current, previous, can_write_current_grades: canWriteCurrentGrades,
      editable_historical_matricula_id: editableHistoricalMatriculaId,
      historical_evaluation_scale: historicalCandidate ? historicalGradeScale : null,
    });
  } catch (cause) {
    if (cause instanceof AcademicYearContextError) {
      return json({ ok: false, code: cause.code, error: cause.message }, cause.status);
    }
    console.error("[balcao/situacao-academica] Consulta falhou", cause);
    return json({ ok: false, error: "Não foi possível verificar o vínculo escolar. Tente novamente." }, 500);
  }
}
