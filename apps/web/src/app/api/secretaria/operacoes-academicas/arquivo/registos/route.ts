import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { authorizeAcademicArchiveRead } from "@/lib/academico/archive-read-authorization";
import { AcademicYearContextError, resolveAcademicYearScope } from "@/lib/academic-year/context";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const Query = z.object({
  ano_letivo_id: z.string().uuid(),
  turma_id: z.string().uuid(),
  tipo: z.enum(["pautas", "horarios", "frequencia", "curriculo"]),
  versao_id: z.string().uuid().optional(),
});

function response(data: Record<string, unknown>, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
function failed(message: string, code: number = 500) {
  return response({ ok: false, error: message }, code);
}

/**
 * Arquivo documental de uma turma encerrada. Apenas SELECT.
 * Nenhum fallback para matrícula, ano ou versão corrente.
 * Os IDs da turma, sessão, período e versão são sempre verificados no servidor.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const parsed = Query.safeParse({
      ano_letivo_id: url.searchParams.get("ano_letivo_id"),
      turma_id: url.searchParams.get("turma_id"),
      tipo: url.searchParams.get("tipo"),
      versao_id: url.searchParams.get("versao_id") || undefined,
    });
    if (!parsed.success) return failed("Ano, turma ou consulta inválidos.", 400);
    const { ano_letivo_id, turma_id, tipo, versao_id } = parsed.data;
    if (tipo !== "horarios" && versao_id) return failed("Versão não aplicável a esta consulta.", 400);

    const supabase = await supabaseServerTyped<any>();
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth?.user) return failed("Não autenticado.", 401);
    const escolaId = await resolveEscolaIdForUser(supabase, auth.user.id, url.searchParams.get("escola_id"));
    if (!escolaId) return failed("Sem acesso à escola.", 403);
    const permission = await authorizeAcademicArchiveRead(supabase, escolaId);
    if (permission.error) return permission.error;

    const year = await resolveAcademicYearScope(supabase, {
      escolaId, requestedAcademicYearId: ano_letivo_id, operation: "READ",
    });
    if (year.status !== "CLOSED") return failed("Consulte o ano ativo no módulo operacional.", 409);

    const { data: turma, error: turmaError } = await supabase
      .from("turmas")
      .select("id, nome, classe_id, curso_id")
      .eq("id", turma_id).eq("escola_id", escolaId).eq("session_id", year.id)
      .maybeSingle();
    if (turmaError) throw turmaError;
    if (!turma) return failed("Turma não encontrada neste ano e escola.", 404);

    const { data: periodRows, error: periodError } = await supabase
      .from("periodos_letivos")
      .select("id, numero, tipo")
      .eq("escola_id", escolaId)
      .eq("ano_letivo_id", year.id)
      .order("numero", { ascending: true })
      .limit(25);
    if (periodError) throw periodError;
    if ((periodRows ?? []).length >= 25) return failed("Demasiados períodos. Solicite revisão do ano letivo.", 409);
    const periodos = periodRows ?? [];
    const periodIds = periodos.map((p: { id: string }) => p.id);
    const context = { ano_letivo_id: year.id, turma_id: turma.id, ano: year.ano, tipo, periodos };

    if (tipo === "pautas") {
      if (!periodIds.length) return response({ ok: true, context, items: [] });
      const { data, error } = await supabase
        .from("pautas_oficiais")
        .select("id, periodo_letivo_id, tipo, status, hash, generated_at, created_at, pdf_path")
        .eq("escola_id", escolaId).eq("turma_id", turma.id)
        .in("periodo_letivo_id", periodIds)
        .order("created_at", { ascending: false })
        .limit(101);
      if (error) throw error;
      if ((data ?? []).length > 100) return failed("Mais de 100 pautas: refine a consulta documental.", 409);
      return response({ ok: true, context, items: (data ?? []).map((p: any) => ({
        id: p.id, periodo_letivo_id: p.periodo_letivo_id,
        tipo: p.tipo, status: p.status, generated_at: p.generated_at ?? p.created_at,
        tem_pdf: p.status === "SUCCESS" && Boolean(p.pdf_path),
        tem_hash: Boolean(p.hash),
      })) });
    }

    if (tipo === "horarios") {
      const { data: versions, error: versionsError } = await supabase
        .from("horario_versoes")
        .select("id, status, publicado_em, created_at")
        .eq("escola_id", escolaId).eq("turma_id", turma.id)
        .in("status", ["publicada", "arquivada"])
        .order("created_at", { ascending: false })
        .limit(51);
      if (versionsError) throw versionsError;
      if ((versions ?? []).length > 50) return failed("Arquivo de horários demasiado grande para esta consulta.", 409);
      const selected = versao_id
        ? (versions ?? []).find((v: any) => v.id === versao_id)
        : (versions ?? [])[0];
      if (versao_id && !selected) return failed("Versão não publicada ou de outra turma.", 404);
      if (!selected) return response({ ok: true, context, versoes: [], itens: [] });

      const { data: aulas, error: aulasError } = await supabase
        .from("quadro_horarios")
        .select("id, slot_id, disciplina_id")
        .eq("escola_id", escolaId).eq("turma_id", turma.id).eq("versao_id", selected.id)
        .order("slot_id", { ascending: true })
        .limit(201);
      if (aulasError) throw aulasError;
      if ((aulas ?? []).length > 200) return failed("Horário demasiado grande; não apresentar versão incompleta.", 409);
      const slotIds = Array.from(new Set((aulas ?? []).map((x: any) => String(x.slot_id)).filter(Boolean))) as string[];
      const disciplinaIds = Array.from(new Set((aulas ?? []).map((x: any) => String(x.disciplina_id)).filter(Boolean))) as string[];
      const [slotsRes, subjectsRes] = await Promise.all([
        slotIds.length ? supabase.from("horario_slots")
          .select("id, dia_semana, ordem, inicio, fim, is_intervalo")
          .eq("escola_id", escolaId).in("id", slotIds) : Promise.resolve({ data: [], error: null }),
        disciplinaIds.length ? supabase.from("disciplinas_catalogo")
          .select("id, nome").in("id", disciplinaIds) : Promise.resolve({ data: [], error: null }),
      ]);
      if (slotsRes.error || subjectsRes.error) throw slotsRes.error ?? subjectsRes.error;
      const slots = new Map<string, any>((slotsRes.data ?? []).map((v: any): [string, any] => [String(v.id), v]));
      const subjects = new Map<string, string>((subjectsRes.data ?? []).map((v: any): [string, string] => [String(v.id), String(v.nome)]));
      const itens = (aulas ?? []).map((v: any) => ({
        id: v.id,
        disciplina: subjects.get(v.disciplina_id) ?? "Disciplina",
        slot: slots.get(v.slot_id) ?? null,
      }));
      return response({ ok: true, context, versoes: versions, versao_id: selected.id, itens });
    }

    if (tipo === "frequencia") {
      if (!periodIds.length) return response({ ok: true, context, items: [] });
      const aggregates = new Map<string, { periodo_letivo_id: string; registos: number; faltas: number; presencas: number; aulas_previstas: number; abaixo_minimo: number }>();
      for (const p of periodos) aggregates.set(p.id, {
        periodo_letivo_id: p.id, registos: 0, faltas: 0, presencas: 0, aulas_previstas: 0, abaixo_minimo: 0,
      });
      // Páginas limitadas: nunca truncar um período em silêncio.
      const SIZE = 500;
      let complete = false;
      for (let page = 0; page < 20; page++) {
        const { data, error } = await supabase
          .from("frequencia_status_periodo")
          .select("id, periodo_letivo_id, faltas, presencas, aulas_previstas, abaixo_minimo")
          .eq("escola_id", escolaId).eq("turma_id", turma.id)
          .in("periodo_letivo_id", periodIds)
          .order("id", { ascending: true })
          .range(page * SIZE, (page + 1) * SIZE - 1);
        if (error) throw error;
        const rows = data ?? [];
        for (const row of rows) {
          const a = aggregates.get(row.periodo_letivo_id);
          if (!a) continue;
          a.registos++;
          a.faltas += Number(row.faltas ?? 0);
          a.presencas += Number(row.presencas ?? 0);
          a.aulas_previstas += Number(row.aulas_previstas ?? 0);
          if (row.abaixo_minimo === true) a.abaixo_minimo++;
        }
        if (rows.length < SIZE) { complete = true; break; }
      }
      if (!complete) return failed("Mapa de frequência excede o limite de segurança; não devolver total parcial.", 409);
      return response({ ok: true, context, items: Array.from(aggregates.values()) });
    }

    if (!turma.classe_id) return response({ ok: true, context, versoes: [] });
    let curricula = supabase.from("curso_curriculos")
      .select("id, version, status, created_at")
      .eq("escola_id", escolaId).eq("ano_letivo_id", year.id).eq("classe_id", turma.classe_id);
    if (turma.curso_id) curricula = curricula.eq("curso_id", turma.curso_id);
    const { data: versions, error: curriculumError } = await curricula
      .order("version", { ascending: false }).limit(21);
    if (curriculumError) throw curriculumError;
    if ((versions ?? []).length > 20) return failed("Mais de 20 versões curriculares. Consulta incompleta bloqueada.", 409);
    const ids = (versions ?? []).map((v: any) => String(v.id));
    if (!ids.length) return response({ ok: true, context, versoes: [] });
    const { data: matrix, error: matrixError } = await supabase
      .from("curso_matriz")
      .select("id, curso_curriculo_id, disciplina_id, carga_horaria_semanal, ordem, ativo")
      .eq("escola_id", escolaId).in("curso_curriculo_id", ids)
      .order("ordem", { ascending: true })
      .limit(251);
    if (matrixError) throw matrixError;
    if ((matrix ?? []).length > 250) return failed("Matriz curricular demasiado grande: não apresentar disciplinas incompletas.", 409);
    const subjectIds = Array.from(new Set((matrix ?? []).map((x: any) => String(x.disciplina_id)).filter(Boolean))) as string[];
    const { data: names, error: namesError } = subjectIds.length
      ? await supabase.from("disciplinas_catalogo").select("id, nome").in("id", subjectIds)
      : { data: [], error: null };
    if (namesError) throw namesError;
    const subjectNames = new Map<string, string>((names ?? []).map((x: any): [string, string] => [String(x.id), String(x.nome)]));
    return response({
      ok: true, context, versoes: (versions ?? []).map((version: any) => ({
        ...version,
        disciplinas: (matrix ?? []).filter((m: any) => m.curso_curriculo_id === version.id)
          .map((m: any) => ({
            id: m.id, nome: subjectNames.get(m.disciplina_id) ?? "Disciplina",
            ordem: m.ordem, carga_horaria_semanal: m.carga_horaria_semanal, ativo: m.ativo,
          })),
      })),
    });
  } catch (err) {
    if (err instanceof AcademicYearContextError) return response({ ok: false, code: err.code, error: err.message }, err.status);
    console.error("[ArquivoRegistos] Falha na consulta documental", err);
    return failed("Não foi possível consultar os registos históricos.", 500);
  }
}
