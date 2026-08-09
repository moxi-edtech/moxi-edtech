import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRoleInSchool } from "@/lib/authz";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import type { Database } from "~types/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ActionSchema = z.object({
  action: z.enum(["archive", "enroll"]),
  reclassificacao_ids: z.array(z.string().uuid()).min(1).max(500),
  turma_destino_id: z.string().uuid().optional(),
  motivo: z.string().trim().max(500).optional().nullable(),
});

async function getContext() {
  const supabase = await supabaseServerTyped<Database>();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 }) };
  const escolaId = await resolveEscolaIdForUser(supabase, user.id);
  if (!escolaId) return { error: NextResponse.json({ ok: false, error: "Escola não identificada" }, { status: 403 }) };
  const authz = await requireRoleInSchool({
    supabase,
    escolaId,
    roles: ["secretaria", "secretaria_financeiro", "admin_financeiro", "admin_secretaria", "admin", "admin_escola", "staff_admin", "diretor"],
  });
  if (authz.error) return { error: authz.error };
  return { supabase, escolaId };
}

export async function GET(request: Request) {
  const context = await getContext();
  if ("error" in context) return context.error;
  const { supabase, escolaId } = context;
  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "aguardando_destino";
  const tipo = url.searchParams.get("tipo");
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 200), 1), 500);

  const db = supabase as any;
  let query = db
    .from("matricula_reclassificacoes")
    .select("id,matricula_id,aluno_id,origem_session_id,destino_session_id,origem_turma_id,destino_turma_id,tipo,status,motivo,created_at,updated_at")
    .eq("escola_id", escolaId)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (status !== "all") query = query.eq("status", status);
  if (tipo) query = query.eq("tipo", tipo);

  const { data: records, error } = await query;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const rows = (records ?? []) as Array<Record<string, any>>;
  const matriculaIds = rows.map((row) => row.matricula_id);
  const alunoIds = [...new Set(rows.map((row) => row.aluno_id))];
  const turmaIds = [...new Set(rows.flatMap((row) => [row.origem_turma_id, row.destino_turma_id]).filter(Boolean))];

  const [{ data: matriculas }, { data: alunos }, { data: turmas }] = await Promise.all([
    matriculaIds.length
      ? db.from("matriculas").select("id,status,ativo,numero_matricula,turma_id,session_id,ano_letivo").eq("escola_id", escolaId).in("id", matriculaIds)
      : { data: [] },
    alunoIds.length
      ? db.from("alunos").select("id,nome,nome_completo,bi_numero").eq("escola_id", escolaId).in("id", alunoIds)
      : { data: [] },
    turmaIds.length
      ? db.from("turmas").select("id,nome,turno,curso_id,classe_id,capacidade_maxima,session_id").eq("escola_id", escolaId).in("id", turmaIds)
      : { data: [] },
  ]);

  const matriculaById = new Map((matriculas ?? []).map((row: any) => [row.id, row]));
  const alunoById = new Map((alunos ?? []).map((row: any) => [row.id, row]));
  const turmaById = new Map((turmas ?? []).map((row: any) => [row.id, row]));

  return NextResponse.json({
    ok: true,
    records: rows.map((row) => ({
      ...row,
      matricula: matriculaById.get(row.matricula_id) ?? null,
      aluno: alunoById.get(row.aluno_id) ?? null,
      origem_turma: turmaById.get(row.origem_turma_id) ?? null,
      destino_turma: turmaById.get(row.destino_turma_id) ?? null,
    })),
    count: rows.length,
  });
}

export async function POST(request: Request) {
  const context = await getContext();
  if ("error" in context) return context.error;
  const { supabase, escolaId } = context;
  const parsed = ActionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Ação de reclassificação inválida" }, { status: 400 });

  const { action, reclassificacao_ids, turma_destino_id, motivo } = parsed.data;
  if (action === "enroll" && !turma_destino_id) {
    return NextResponse.json({ ok: false, error: "Turma destino é obrigatória" }, { status: 400 });
  }

  const { data: selectedRecords, error: selectedError } = await (supabase as any)
    .from("matricula_reclassificacoes")
    .select("id, matricula_id, aluno_id, origem_session_id, destino_session_id, tipo")
    .eq("escola_id", escolaId)
    .in("id", reclassificacao_ids)
    .eq("status", "aguardando_destino");
  if (selectedError) return NextResponse.json({ ok: false, error: selectedError.message }, { status: 409 });

  if (action === "enroll") {
    const turmaDestinoId = turma_destino_id;
    if (!turmaDestinoId) {
      return NextResponse.json({ ok: false, error: "Turma destino é obrigatória" }, { status: 400 });
    }
    const selected = (selectedRecords ?? []) as Array<Record<string, any>>;
    const alunos = [...new Set(selected.map((row) => row.aluno_id).filter(Boolean))];
    const destinoSessionIds = [...new Set(selected.map((row) => row.destino_session_id).filter(Boolean))];
    const matriculaIds = [...new Set(selected.map((row) => row.matricula_id).filter(Boolean))];
    const { data: matriculas } = matriculaIds.length
      ? await (supabase as any).from("matriculas").select("id, turma_id").eq("escola_id", escolaId).in("id", matriculaIds)
      : { data: [] };
    const origemTurmaIds = [...new Set((matriculas ?? []).map((row: any) => row.turma_id).filter(Boolean))];
    const turmaIds = [...new Set([...origemTurmaIds, turmaDestinoId].filter(Boolean))];
    const { data: turmas } = turmaIds.length
      ? await (supabase as any).from("turmas").select("id, classe_id").eq("escola_id", escolaId).in("id", turmaIds)
      : { data: [] };
    const classeIds = [...new Set((turmas ?? []).map((row: any) => row.classe_id).filter(Boolean))];
    const { data: classes } = classeIds.length
      ? await (supabase as any).from("classes").select("id, nome, numero").eq("escola_id", escolaId).in("id", classeIds)
      : { data: [] };
    const turmaById = new Map<string, any>(((turmas ?? []) as any[]).map((row: any) => [row.id, row]));
    const classeById = new Map<string, any>(((classes ?? []) as any[]).map((row: any) => [row.id, row]));
    const classNumber = (classe: any) => {
      const number = Number(classe?.numero);
      if (Number.isFinite(number) && number > 0) return number;
      const match = String(classe?.nome ?? "").match(/(\d{1,2})\s*(?:ª|a)?/i);
      return match ? Number(match[1]) : null;
    };
    const invalidProgression = (selected ?? []).some((record: any) => {
      const matricula = (matriculas ?? []).find((row: any) => row.id === record.matricula_id);
      const origemTurma = turmaById.get(matricula?.turma_id);
      const destinoTurma = turmaById.get(turmaDestinoId);
      const origemNumero = classNumber(classeById.get(origemTurma?.classe_id));
      const destinoNumero = classNumber(classeById.get(destinoTurma?.classe_id));
      return origemNumero !== null && destinoNumero !== origemNumero + 1;
    });
    if (invalidProgression) {
      return NextResponse.json({ ok: false, error: "O finalista deve ser encaminhado para a classe imediatamente seguinte.", code: "FINALISTA_PROGRESSION_INVALID" }, { status: 409 });
    }

    const { data: pedidos } = alunos.length && destinoSessionIds.length
      ? await (supabase as any)
          .from("servico_pedidos")
          .select("aluno_id, contexto")
          .eq("escola_id", escolaId)
          .eq("servico_codigo", "SERV_REMATRICULA")
          .eq("status", "granted")
          .in("aluno_id", alunos)
      : { data: [] };
    const pagos = new Set(
      (pedidos ?? [])
        .filter((pedido: any) => destinoSessionIds.includes(pedido.contexto?.ano_letivo_id))
        .map((pedido: any) => pedido.aluno_id),
    );
    const semTaxa = alunos.filter((alunoId) => !pagos.has(alunoId));
    if (semTaxa.length > 0) {
      return NextResponse.json({ ok: false, error: "A taxa de reconfirmação deve ser paga no Balcão antes de matricular finalistas no novo ciclo.", code: "FINALISTA_PAYMENT_REQUIRED", alunos_pendentes: semTaxa }, { status: 409 });
    }
  }

  const fn = action === "archive" ? "finalistas_concluir_arquivar" : "finalistas_matricular_novo_ciclo";
  const args = action === "archive"
    ? { p_escola_id: escolaId, p_reclassificacao_ids: reclassificacao_ids, p_motivo: motivo ?? null }
    : { p_escola_id: escolaId, p_reclassificacao_ids: reclassificacao_ids, p_turma_destino_id: turma_destino_id, p_motivo: motivo ?? null };
  const { data, error } = await (supabase as any).rpc(fn, args);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 409 });

  if (action === "archive") {
    const sessionIds = [...new Set((selectedRecords ?? []).map((row: any) => row.origem_session_id).filter(Boolean))];
    const { data: sessions } = sessionIds.length
      ? await (supabase as any).from("anos_letivos").select("id, ano").eq("escola_id", escolaId).in("id", sessionIds)
      : { data: [] };
    const yearBySession = new Map((sessions ?? []).map((row: any) => [row.id, Number(row.ano)]));
    const certificados = await Promise.all((selectedRecords ?? []).map(async (row: any) => {
      const ano = yearBySession.get(row.origem_session_id);
      if (!ano) return { aluno_id: row.aluno_id, status: "pendente", error: "Ano letivo de origem não encontrado" };
      const { data: historico } = await (supabase as any)
        .from("historico_anos")
        .select("id, turma_id, snapshot_status")
        .eq("escola_id", escolaId)
        .eq("aluno_id", row.aluno_id)
        .eq("ano_letivo", ano)
        .maybeSingle();
      const { count: disciplinasEsperadas } = historico?.turma_id
        ? await (supabase as any)
            .from("turma_disciplinas")
            .select("id", { count: "exact", head: true })
            .eq("escola_id", escolaId)
            .eq("turma_id", historico.turma_id)
        : { count: 0 };
      const { data: notas } = historico?.id
        ? await (supabase as any)
            .from("historico_disciplinas")
            .select("id, media_final")
            .eq("historico_ano_id", historico.id)
        : { data: [] };
      const notasConcluidas = (notas ?? []).filter((nota: any) => nota.media_final !== null && nota.media_final !== undefined).length;
      const notasCompletas = Number(disciplinasEsperadas ?? 0) > 0 && notasConcluidas >= Number(disciplinasEsperadas ?? 0);
      const modo = notasCompletas ? "com_notas" : "sem_notas";
      if (!historico?.id || historico.snapshot_status !== "fechado") {
        return {
          aluno_id: row.aluno_id,
          status: "pendente",
          modo,
          error: "Histórico ainda não está fechado; o certificado ficará disponível após o fechamento académico.",
        };
      }
      const { data: documento, error: documentoError } = await (supabase as any).rpc("emitir_documento_final", {
        p_escola_id: escolaId,
        p_aluno_id: row.aluno_id,
        p_ano_letivo: ano,
        p_tipo_documento: modo === "com_notas" ? "certificado" : "certificado_sem_notas",
      });
      if (documentoError || !documento?.ok) {
        return {
          aluno_id: row.aluno_id,
          status: "pendente",
          modo,
          error: documentoError?.message ?? documento?.error ?? "Histórico/notas ainda não disponível",
        };
      }
      return {
          aluno_id: row.aluno_id,
          status: "emitido",
        modo,
        doc_id: documento.docId ?? documento.id ?? null,
      };
    }));
    return NextResponse.json({ ...(data ?? { ok: true }), certificados });
  }
  return NextResponse.json(data ?? { ok: true });
}
