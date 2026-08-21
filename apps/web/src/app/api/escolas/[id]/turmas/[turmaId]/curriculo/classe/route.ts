import { NextResponse } from "next/server";
import { z } from "zod";
import { createRouteClient } from "@/lib/supabase/route-client";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { authorizeDisciplinaManage } from "@/lib/escola/disciplinas";
import { ensureEditableCurriculoForClass } from "@/lib/curriculo/ensureEditableCurriculoForClass";
import { POST as publishCurriculum } from "@/app/api/escola/[id]/admin/curriculo/publish/route";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Ctx = { params: Promise<{ id: string; turmaId: string }> };

async function auth(req: Request, ctx: Ctx) {
  const supabase = await createRouteClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { error: NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 }) };
  const { id, turmaId } = await ctx.params;
  const escolaId = await resolveEscolaIdForUser(supabase as any, data.user.id, id);
  if (!escolaId || escolaId !== id) return { error: NextResponse.json({ ok: false, error: "Escola não encontrada" }, { status: 404 }) };
  const authz = await authorizeDisciplinaManage(supabase as any, escolaId, data.user.id);
  if (!authz.allowed) return { error: NextResponse.json({ ok: false, error: authz.reason || "Sem permissão" }, { status: 403 }) };
  return { supabase, escolaId, turmaId };
}

async function getScope(supabase: any, escolaId: string, turmaId: string) {
  const { data: turma, error } = await supabase.from("turmas")
    .select("id, nome, curso_id, classe_id, ano_letivo_id, ano_letivo")
    .eq("escola_id", escolaId).eq("id", turmaId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!turma?.curso_id || !turma?.classe_id) throw new Error("A turma não tem curso e classe definidos.");
  let anoLetivoId = turma.ano_letivo_id;
  if (!anoLetivoId && turma.ano_letivo) {
    const { data } = await supabase.from("anos_letivos").select("id").eq("escola_id", escolaId).eq("ano", turma.ano_letivo).maybeSingle();
    anoLetivoId = data?.id ?? null;
  }
  if (!anoLetivoId) throw new Error("A turma não tem ano letivo definido.");
  return { turma, anoLetivoId: String(anoLetivoId) };
}

async function getCurriculum(supabase: any, escolaId: string, scope: { turma: any; anoLetivoId: string }) {
  const { data: curriculos, error } = await supabase.from("curso_curriculos")
    .select("id, version, status").eq("escola_id", escolaId).eq("curso_id", scope.turma.curso_id)
    .eq("classe_id", scope.turma.classe_id).eq("ano_letivo_id", scope.anoLetivoId)
    .in("status", ["draft", "published"]).order("version", { ascending: false });
  if (error) throw new Error(error.message);
  const current = curriculos?.find((row: any) => row.status === "draft") ?? curriculos?.find((row: any) => row.status === "published");
  if (!current) return { current: null, rows: [], available: [], catalogCount: 0, availableCount: 0 };
  const { data: rows, error: rowsError } = await supabase.from("curso_matriz")
    .select("id, disciplina_id, carga_horaria, carga_horaria_semanal, obrigatoria, classificacao, periodos_ativos, entra_no_horario, avaliacao_mode, avaliacao_modelo_id, avaliacao_disciplina_id, modelo_excecao_id, conta_para_media_med, ordem")
    .eq("escola_id", escolaId).eq("curso_curriculo_id", current.id).eq("classe_id", scope.turma.classe_id).eq("ativo", true).order("ordem", { ascending: true });
  if (rowsError) throw new Error(rowsError.message);
  const ids = (rows ?? []).map((row: any) => row.disciplina_id).filter(Boolean);
  const { data: catalog, error: catalogError } = await supabase.from("disciplinas_catalogo").select("id, nome, sigla").eq("escola_id", escolaId).order("nome", { ascending: true });
  if (catalogError) throw new Error(catalogError.message);
  const catalogById = new Map<string, any>((catalog ?? []).map((row: any) => [String(row.id), row]));
  const currentItems = (rows ?? []).map((row: any) => ({ ...row, nome: catalogById.get(row.disciplina_id)?.nome ?? "Disciplina sem nome", sigla: catalogById.get(row.disciplina_id)?.sigla ?? null }));
  const currentIds = new Set(ids);
  const available = (catalog ?? []).filter((row: any) => !currentIds.has(row.id)).map((row: any) => ({ id: row.id, disciplina_id: row.id, nome: row.nome, sigla: row.sigla ?? null }));
  return { current, rows: currentItems, available, catalogCount: catalog?.length ?? 0, availableCount: available.length };
}

export async function GET(req: Request, ctx: Ctx) {
  try {
    const c = await auth(req, ctx); if (c.error) return c.error;
    const scope = await getScope(c.supabase, c.escolaId, c.turmaId);
    const curriculum = await getCurriculum(c.supabase, c.escolaId, scope);
    return NextResponse.json({ ok: true, turma: scope.turma, classe_id: scope.turma.classe_id, ano_letivo_id: scope.anoLetivoId, curriculum: curriculum.current, items: curriculum.rows, available: curriculum.available, catalog_count: curriculum.catalogCount, available_count: curriculum.availableCount, is_draft: curriculum.current?.status === "draft" });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Falha ao carregar currículo da classe" }, { status: 500 });
  }
}

const addSchema = z.object({ action: z.literal("add"), disciplina_id: z.string().uuid() });
const removeSchema = z.object({ action: z.literal("remove"), curso_matriz_id: z.string().uuid() });
const applySchema = z.object({ action: z.literal("apply") });

export async function POST(req: Request, ctx: Ctx) {
  try {
    const c = await auth(req, ctx); if (c.error) return c.error;
    const scope = await getScope(c.supabase, c.escolaId, c.turmaId);
    const body = await req.json().catch(() => null);
    if (applySchema.safeParse(body).success) {
      const { data: draft } = await c.supabase.from("curso_curriculos").select("id, version").eq("escola_id", c.escolaId).eq("curso_id", scope.turma.curso_id).eq("classe_id", scope.turma.classe_id).eq("ano_letivo_id", scope.anoLetivoId).eq("status", "draft").order("version", { ascending: false }).limit(1).maybeSingle();
      if (!draft) return NextResponse.json({ ok: false, error: "Não há alterações de currículo para aplicar." }, { status: 409 });
      const publishHeaders = new Headers(req.headers);
      publishHeaders.delete("content-length");
      publishHeaders.set("content-type", "application/json");
      const publishRequest = new Request(req.url, {
        method: "POST",
        headers: publishHeaders,
        body: JSON.stringify({
          cursoId: scope.turma.curso_id,
          anoLetivoId: scope.anoLetivoId,
          version: draft.version,
          classeId: scope.turma.classe_id,
          rebuildTurmas: false,
          confirmNoRebuildWithExistingTurmas: true,
          syncMode: "reconcile",
          confirmReconcileSync: true,
          autoGenerateTurmas: false,
        }),
      });
      const publishResponse = await publishCurriculum(publishRequest, { params: Promise.resolve({ id: c.escolaId }) });
      const publishJson = await publishResponse.json().catch(() => null);
      if (!publishResponse.ok || !publishJson?.ok) {
        return NextResponse.json({ ok: false, error: publishJson?.error || "O currículo não passou na validação.", details: publishJson?.details, code: publishJson?.code }, { status: publishResponse.status || 409 });
      }
      return NextResponse.json({ ok: true, applied: true, message: "Currículo aplicado a todas as turmas da classe.", sync: publishJson.sync_existing_turmas ?? null });
    }
    const parsed = addSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ ok: false, error: "Disciplina inválida" }, { status: 400 });
    const editable = await ensureEditableCurriculoForClass({ supabase: c.supabase, escolaId: c.escolaId, cursoId: scope.turma.curso_id, classeId: scope.turma.classe_id, anoLetivoId: scope.anoLetivoId });
    const { data: discipline } = await c.supabase.from("disciplinas_catalogo").select("id").eq("escola_id", c.escolaId).eq("id", parsed.data.disciplina_id).maybeSingle();
    if (!discipline) return NextResponse.json({ ok: false, error: "Disciplina não encontrada nesta escola." }, { status: 404 });
    const { data: exists } = await c.supabase.from("curso_matriz").select("id").eq("escola_id", c.escolaId).eq("curso_curriculo_id", editable.draftCurriculoId).eq("classe_id", scope.turma.classe_id).eq("disciplina_id", discipline.id).maybeSingle();
    if (exists) return NextResponse.json({ ok: false, error: "A disciplina já faz parte do currículo da classe." }, { status: 409 });
    const { error } = await c.supabase.from("curso_matriz").insert({ escola_id: c.escolaId, curso_id: scope.turma.curso_id, classe_id: scope.turma.classe_id, curso_curriculo_id: editable.draftCurriculoId, disciplina_id: discipline.id, obrigatoria: true, classificacao: "core", ativo: true, periodos_ativos: [1, 2, 3], entra_no_horario: true, carga_horaria: 0, carga_horaria_semanal: 0, avaliacao_mode: "inherit_school", status_completude: "incompleto" });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, draft: true });
  } catch (error) { return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Falha ao alterar currículo" }, { status: 500 }); }
}

export async function DELETE(req: Request, ctx: Ctx) {
  try {
    const c = await auth(req, ctx); if (c.error) return c.error;
    const scope = await getScope(c.supabase, c.escolaId, c.turmaId);
    const parsed = removeSchema.safeParse({ ...(await req.json().catch(() => ({}))), action: "remove" });
    if (!parsed.success) return NextResponse.json({ ok: false, error: "Disciplina inválida" }, { status: 400 });
    const editable = await ensureEditableCurriculoForClass({ supabase: c.supabase, escolaId: c.escolaId, cursoId: scope.turma.curso_id, classeId: scope.turma.classe_id, anoLetivoId: scope.anoLetivoId });
    const { data: target } = await c.supabase.from("curso_matriz").select("id, disciplina_id").eq("escola_id", c.escolaId).eq("id", parsed.data.curso_matriz_id).eq("curso_curriculo_id", editable.draftCurriculoId).maybeSingle();
    if (!target) return NextResponse.json({ ok: false, error: "Disciplina não encontrada no rascunho da classe." }, { status: 404 });
    const { data: turmas } = await c.supabase.from("turmas").select("id").eq("escola_id", c.escolaId).eq("curso_id", scope.turma.curso_id).eq("classe_id", scope.turma.classe_id).eq("ano_letivo_id", scope.anoLetivoId);
    const turmaIds = (turmas ?? []).map((row: any) => row.id);
    if (turmaIds.length) {
      const { data: tdRows } = await c.supabase.from("turma_disciplinas").select("id, curso_matriz_id").eq("escola_id", c.escolaId).in("turma_id", turmaIds);
      const materializedMatrixIds = (tdRows ?? []).map((row: any) => row.curso_matriz_id).filter(Boolean);
      const { data: materializedMatrices } = materializedMatrixIds.length
        ? await c.supabase.from("curso_matriz").select("id, disciplina_id").eq("escola_id", c.escolaId).in("id", materializedMatrixIds)
        : { data: [] as any[] };
      const matchingMatrixIds = new Set((materializedMatrices ?? []).filter((row: any) => row.disciplina_id === target.disciplina_id).map((row: any) => row.id));
      const tdIds = (tdRows ?? []).filter((row: any) => matchingMatrixIds.has(row.curso_matriz_id)).map((row: any) => row.id);
      if (tdIds.length) {
        const { count } = await c.supabase.from("avaliacoes").select("id", { count: "exact", head: true }).eq("escola_id", c.escolaId).in("turma_disciplina_id", tdIds);
        if ((count ?? 0) > 0) return NextResponse.json({ ok: false, error: "Não é possível remover: existem avaliações em turmas desta classe." }, { status: 409 });
      }
    }
    const { error } = await c.supabase.from("curso_matriz").delete().eq("escola_id", c.escolaId).eq("id", target.id).eq("curso_curriculo_id", editable.draftCurriculoId);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 409 });
    return NextResponse.json({ ok: true, draft: true });
  } catch (error) { return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Falha ao remover disciplina" }, { status: 500 }); }
}
