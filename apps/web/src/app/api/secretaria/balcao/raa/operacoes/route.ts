import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { requireCommandCenterSchoolWideAccess } from "@/lib/command-center/school-wide-scope";
import { resolveRegimeAcademico } from "@/lib/academico/regime-academico";
import { readVerifiedAcademicTrimesters } from "@/lib/academico/read-verified-academic-trimesters";
import { resolveAcademicYearContext, assertAcademicYearEntity } from "@/lib/academic-year/context";
import { balcaoAcademicOperation, canManageBalcaoAcademic } from "@/lib/rematricula/balcao-academic-operation";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";
const json = (value: unknown, status = 200) => NextResponse.json(value, { status, headers: { "Cache-Control": "private, no-store" } });

async function context(req: NextRequest, matriculaId: string) {
  const db = await supabaseServerTyped<any>();
  const { data: auth, error: authError } = await db.auth.getUser();
  if (authError || !auth.user) return { response: json({ ok: false, error: "Não autenticado." }, 401) };
  const escolaId = await resolveEscolaIdForUser(db, auth.user.id);
  if (!escolaId) return { response: json({ ok: false, error: "Escola indisponível." }, 403) };
  const denied = await requireCommandCenterSchoolWideAccess(db, auth.user.id, escolaId, req);
  if (denied) return { response: denied };
  const [{ data: member, error: membershipError }, { data: source, error: sourceError }] = await Promise.all([
    db.from("escola_users").select("papel").eq("escola_id", escolaId).eq("user_id", auth.user.id).maybeSingle(),
    db.from("matriculas").select("id,aluno_id,turma_id,session_id,status,ativo")
      .eq("escola_id", escolaId).eq("id", matriculaId).maybeSingle(),
  ]);
  if (membershipError || sourceError) return { response: json({ ok: false, error: "Não foi possível confirmar o contexto." }, 503) };
  if (!source?.turma_id || !source.session_id) return { response: json({ ok: false, error: "Matrícula de origem indisponível." }, 404) };
  return { db, escolaId, source, canManage: canManageBalcaoAcademic(member?.papel) };
}
function failed(error: unknown) {
  const e = error as { code?: string; status?: number; message?: string };
  console.error("[balcao/raa/operacoes]", { code: e.code ?? "UNEXPECTED" });
  return json({ ok: false, code: e.code ?? "ACADEMIC_OPERATION_UNAVAILABLE",
    error: e.status && e.status < 500 ? e.message : "Não foi possível concluir a operação académica. O atendimento foi preservado." }, e.status ?? 503);
}

export async function GET(req: NextRequest) {
  try {
    const parsed = z.string().uuid().safeParse(req.nextUrl.searchParams.get("matricula_id"));
    if (!parsed.success) return json({ ok: false, error: "Matrícula inválida." }, 400);
    const ctx = await context(req, parsed.data);
    if (ctx.response) return ctx.response;
    const { db, escolaId, source, canManage } = ctx;
    const year = await resolveAcademicYearContext(db, {
      userId: (await db.auth.getUser()).data.user!.id, requestedAcademicYearId: source.session_id, operation: "READ",
    });
    await assertAcademicYearEntity(db, { table: "turmas", entityId: source.turma_id, escolaId, anoLetivoId: source.session_id });
    const [regime, periods, links, results, evidence] = await Promise.all([
      resolveRegimeAcademico(db, source.turma_id),
      readVerifiedAcademicTrimesters(db, { escolaId, anoLetivoId: source.session_id, yearBase: Number(year.anoLetivoLabel.split("/")[0]) }),
      db.from("turma_disciplinas").select("id,avaliacao_disciplina_id,periodos_ativos")
        .eq("escola_id", escolaId).eq("turma_id", source.turma_id).order("id").limit(50),
      db.from("exame_resultados").select("id,nota,estado,exame_sessao_id,turma_disciplina_id")
        .eq("escola_id", escolaId).eq("matricula_id", source.id).eq("estado", "submetido").order("id").limit(50),
      canManage ? db.from("vw_raa_eja_avaliacoes_atuais").select("id,disciplina_id,suficiente,registado_em")
        .eq("escola_id", escolaId).eq("matricula_id", source.id).order("registado_em", { ascending: false }).order("id", { ascending: false }).limit(50)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (links.error || results.error || evidence.error) throw links.error || results.error || evidence.error;
    const ids = [...new Set((links.data ?? []).map((d: any) => d.avaliacao_disciplina_id).filter(Boolean))];
    const names = ids.length ? await db.from("disciplinas_catalogo").select("id,nome").eq("escola_id", escolaId).in("id", ids).limit(50) : { data: [], error: null };
    if (names.error) throw names.error;
    return json({ ok: true, can_manage: canManage, source, regime, ano_ativo: year.status === "ACTIVE",
      periodos: periods, disciplinas: names.data ?? [], resultados: results.data ?? [], evidencias: evidence.data ?? [] });
  } catch (error) { return failed(error); }
}

export async function POST(req: NextRequest) {
  try {
    const key = z.string().uuid().safeParse(req.headers.get("idempotency-key"));
    const parsed = balcaoAcademicOperation.safeParse(await req.json().catch(() => null));
    if (!key.success || !parsed.success) return json({ ok: false, error: !parsed.success ? parsed.error.issues[0]?.message : "Identificador da operação inválido." }, 400);
    const body = parsed.data;
    const ctx = await context(req, body.matricula_id);
    if (ctx.response) return ctx.response;
    const { db, escolaId, source, canManage } = ctx;
    if (!canManage) return json({ ok: false, code: "ACADEMIC_FORBIDDEN", error: "Esta operação exige direção ou administração académica." }, 403);
    if (body.acao === "publicar_pauta") {
      const { publishBalcaoPauta } = await import("@/lib/pedagogico/balcao-pauta-publication");
      return json(await publishBalcaoPauta({ db, escolaId, source, body, key: key.data }));
    }

    const { acao, matricula_id: _, ...payload } = body;
    const { data, error } = await db.rpc("balcao_resolver_academico", {
      p_escola_id: escolaId, p_matricula_id: source.id, p_acao: acao, p_payload: payload, p_chave: key.data,
    });
    if (error) {
      const code = error.message?.match(/\b(?:ACADEMIC_[A-Z_]+|EJA_[A-Z_]+|EXAM_[A-Z_]+|RAA_LEGAL_LOCK|IDEMPOTENCY_CONFLICT|TURMA_NOT_EXAM_REGIME)\b/)?.[0];
      return json({ ok: false, code: code ?? "ACADEMIC_OPERATION_FAILED",
        error: code === "EJA_VERSION_CONFLICT" ? "A avaliação mudou noutro atendimento. Atualize antes de retificar."
          : code === "RAA_LEGAL_LOCK" ? "Esta matrícula possui fecho legal. A exceção de período não altera esse fecho."
          : "Não foi possível autorizar esta operação no contexto atual. Atualize a situação e confira os dados." }, error.code === "42501" ? 403 : 409);
    }
    return json(data);
  } catch (error) { return failed(error); }
}
