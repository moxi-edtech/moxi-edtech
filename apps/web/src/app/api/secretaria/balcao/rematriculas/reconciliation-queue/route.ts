import { NextResponse } from "next/server";
import { requireRoleInSchool } from "@/lib/authz";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveAcademicYearContext } from "@/lib/academic-year/context";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const MAX_PAGE_SIZE = 50;
const RECONCILIATION_CODES = [
  "REMATRICULA_RECONCILIATION_REQUIRED",
  "REMATRICULA_LEGACY_REVIEW_REQUIRED",
];

export async function GET(request: Request) {
  try {
    const supabase = await supabaseServerTyped<any>();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const requestedEscolaId = searchParams.get("escolaId") || searchParams.get("escola_id") || undefined;
    const escolaId = await resolveEscolaIdForUser(supabase, user.id, requestedEscolaId);
    if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não identificada" }, { status: 403 });

    const authz = await requireRoleInSchool({
      supabase,
      escolaId,
      roles: ["secretaria", "secretaria_financeiro", "financeiro", "admin_financeiro", "admin", "admin_escola", "staff_admin"],
    });
    if (authz.error) return authz.error;

    const requestedYearId = searchParams.get("ano_letivo_id");
    const academicContext = requestedYearId
      ? await resolveAcademicYearContext(supabase, {
          userId: user.id,
          requestedAcademicYearId: requestedYearId,
          operation: "READ",
        })
      : null;
    const query = searchParams.get("q")?.trim() || "";
    const limit = Math.min(Math.max(Number(searchParams.get("limit") || 25), 1), MAX_PAGE_SIZE);
    const offset = Math.max(Number(searchParams.get("offset") || 0), 0);

    let alunoIds: string[] | null = null;
    if (query) {
      const [{ data: byName, error: nameError }, { data: byProcess, error: processError }] = await Promise.all([
        supabase.from("alunos").select("id").eq("escola_id", escolaId).ilike("nome", `%${query}%`).limit(200),
        supabase.from("alunos").select("id").eq("escola_id", escolaId).ilike("numero_processo", `%${query}%`).limit(200),
      ]);
      if (nameError) throw nameError;
      if (processError) throw processError;
      alunoIds = Array.from(new Set([...(byName ?? []), ...(byProcess ?? [])].map((row: any) => String(row.id))));
      if (alunoIds.length === 0) {
        return NextResponse.json({ ok: true, total: 0, limit, offset, items: [], filters: { query, ano_letivo_id: academicContext?.anoLetivoId ?? null } });
      }
    }

    let pedidosQuery = supabase
      .from("servico_pedidos")
      .select("id, aluno_id, matricula_id, status, reason_code, reason_detail, valor_cobrado, contexto, created_at", { count: "exact" })
      .eq("escola_id", escolaId)
      .eq("servico_codigo", "SERV_REMATRICULA")
      .eq("status", "pending_payment")
      .in("reason_code", RECONCILIATION_CODES)
      .order("created_at", { ascending: true })
      .range(offset, offset + limit - 1);

    if (alunoIds) pedidosQuery = pedidosQuery.in("aluno_id", alunoIds);
    if (academicContext?.anoLetivoId) {
      pedidosQuery = pedidosQuery.filter("contexto->>ano_letivo_id", "eq", academicContext.anoLetivoId);
    }

    const { data: pedidos, count, error: pedidosError } = await pedidosQuery;
    if (pedidosError) throw pedidosError;

    const rows = pedidos ?? [];
    const ids = rows.map((row: any) => String(row.aluno_id)).filter(Boolean);
    const turmaIds = rows
      .map((row: any) => row.contexto?.destino_turma_id)
      .filter(Boolean)
      .map(String);

    const [{ data: alunos }, { data: turmas }, { data: pagamentos }] = await Promise.all([
      ids.length
        ? supabase.from("alunos").select("id, nome, numero_processo").eq("escola_id", escolaId).in("id", ids)
        : Promise.resolve({ data: [] }),
      turmaIds.length
        ? supabase.from("turmas").select("id, nome, turma_codigo, turno").eq("escola_id", escolaId).in("id", turmaIds)
        : Promise.resolve({ data: [] }),
      ids.length
        ? supabase.from("pagamentos").select("id, aluno_id, valor_pago, status, meta, created_at").eq("escola_id", escolaId).in("aluno_id", ids).in("status", ["settled", "confirmed", "paid", "succeeded"])
        : Promise.resolve({ data: [] }),
    ]);

    const { data: availableYears } = await supabase
      .from("anos_letivos")
      .select("id, ano, ativo")
      .eq("escola_id", escolaId)
      .order("ano", { ascending: false });

    const alunoMap = new Map((alunos ?? []).map((row: any) => [String(row.id), row]));
    const turmaMap = new Map((turmas ?? []).map((row: any) => [String(row.id), row]));
    const pagamentoMap = new Map<string, any>();
    for (const pagamento of pagamentos ?? []) {
      const pedidoId = pagamento.meta?.pedido_id;
      if (pedidoId) pagamentoMap.set(String(pedidoId), pagamento);
    }

    return NextResponse.json({
      ok: true,
      total: count ?? 0,
      limit,
      offset,
      filters: { query, ano_letivo_id: academicContext?.anoLetivoId ?? null },
      available_years: availableYears ?? [],
      items: rows.map((pedido: any) => {
        const aluno = alunoMap.get(String(pedido.aluno_id));
        const destinoTurmaId = pedido.contexto?.destino_turma_id ? String(pedido.contexto.destino_turma_id) : null;
        const turma = destinoTurmaId ? turmaMap.get(destinoTurmaId) : null;
        const pagamento = pagamentoMap.get(String(pedido.id));
        return {
          id: pedido.id,
          aluno_id: pedido.aluno_id,
          aluno_nome: aluno?.nome ?? "Aluno sem nome",
          numero_processo: aluno?.numero_processo ?? null,
          status: pedido.status,
          reason_code: pedido.reason_code,
          reason_detail: pedido.reason_detail,
          valor_cobrado: Number(pedido.valor_cobrado ?? 0),
          created_at: pedido.created_at,
          ano_letivo_id: pedido.contexto?.ano_letivo_id ?? null,
          destino_turma_id: destinoTurmaId,
          turma_nome: turma?.nome ?? turma?.turma_codigo ?? null,
          turno: turma?.turno ?? null,
          pagamento: pagamento
            ? { id: pagamento.id, valor: Number(pagamento.valor_pago ?? 0), status: pagamento.status, created_at: pagamento.created_at }
            : null,
        };
      }),
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Erro ao carregar pendências" }, { status: 500 });
  }
}
