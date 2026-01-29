// @kf2 allow-scan
import { kf2Range } from "@/lib/db/kf2";
import { createRouteClient } from "@/lib/supabase/route-client";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

// Lista alunos (portal secretaria)
// Agora trazendo numero_login via relacionamento alunos -> profiles
export async function GET(req: Request) {
  try {
    const supabase = await createRouteClient();
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes.user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }
    const user = userRes.user;

    const escolaId = await resolveEscolaIdForUser(supabase, user.id);
    if (!escolaId) {
      return NextResponse.json({ ok: false, error: "Usuário não vinculado a nenhuma escola" }, { status: 403 });
    }

    const url = new URL(req.url);
    const q = (url.searchParams.get("q") || url.searchParams.get("search"))?.trim() || null;
    const status = (url.searchParams.get("status") || "ativo").toLowerCase();
    const anoParamRaw = url.searchParams.get("ano") || url.searchParams.get("ano_letivo");
    const anoParam = anoParamRaw ? Number(anoParamRaw) : null;
    const targetAno = Number.isFinite(anoParam) ? (anoParam as number) : null;

    const limitParam = url.searchParams.get("limit") ?? url.searchParams.get("pageSize");
    const pageParam = url.searchParams.get("page");
    const offsetParam = url.searchParams.get("offset");
    const cursorCreatedAt = url.searchParams.get("cursor_created_at");
    const cursorId = url.searchParams.get("cursor_id");
    const hasCursor = Boolean(cursorCreatedAt && cursorId);
    const derivedOffset = pageParam && limitParam ? (Number(pageParam) - 1) * Number(limitParam) : undefined;
    const { limit, from } = kf2Range(
      limitParam ? Number(limitParam) : undefined,
      hasCursor ? 0 : offsetParam ? Number(offsetParam) : derivedOffset
    );

    const { data, error } = await supabase.rpc("secretaria_list_alunos_kf2", {
      p_escola_id: escolaId,
      p_status: status,
      p_q: q ?? undefined,
      p_ano_letivo: targetAno ?? undefined,
      p_limit: limit,
      p_offset: from,
      p_cursor_created_at: cursorCreatedAt ?? undefined,
      p_cursor_id: cursorId ?? undefined,
    });

    if (error) throw error;

    let items = (data ?? []).map((row: any) => ({
      ...row,
      bilhete: row?.bi_numero ?? null,
    }));

    const includeResumo = url.searchParams.get("includeResumo") === "1";
    if (includeResumo && q && items.length > 0 && items.length <= 10) {
      const alunoIds = items.map((row: any) => row.aluno_id ?? row.id).filter(Boolean);

      const [{ data: matriculasRows }, { data: mensalidadesRows }] = await Promise.all([
        supabase
          .from("matriculas")
          .select("aluno_id, status, created_at, turma:turmas(nome)")
          .in("aluno_id", alunoIds)
          .in("status", ["ativa", "ativo", "active"])
          .order("created_at", { ascending: false }),
        supabase
          .from("mensalidades")
          .select("aluno_id, status, valor_previsto, valor_pago_total")
          .in("aluno_id", alunoIds)
          .in("status", ["pendente", "pago_parcial"]),
      ]);

      const turmaByAluno = new Map<string, string | null>();
      (matriculasRows || []).forEach((row: any) => {
        if (!row?.aluno_id || turmaByAluno.has(row.aluno_id)) return;
        const turma = Array.isArray(row.turma) ? row.turma[0] : row.turma;
        turmaByAluno.set(row.aluno_id, turma?.nome ?? null);
      });

      const atrasoByAluno = new Map<string, number>();
      (mensalidadesRows || []).forEach((row: any) => {
        if (!row?.aluno_id) return;
        const valorPrevisto = Number(row.valor_previsto ?? 0);
        const valorPago = Number(row.valor_pago_total ?? 0);
        const emAtraso = Math.max(0, valorPrevisto - valorPago);
        atrasoByAluno.set(row.aluno_id, (atrasoByAluno.get(row.aluno_id) || 0) + emAtraso);
      });

      items = items.map((row: any) => {
        const alunoId = row.aluno_id ?? row.id;
        return {
          ...row,
          turma_atual: turmaByAluno.get(alunoId) ?? null,
          total_em_atraso: atrasoByAluno.get(alunoId) ?? 0,
        };
      });
    }

    const hasMore = items.length === limit;
    const lastItem = hasMore ? items[items.length - 1] : null;
    const nextCursor = lastItem
      ? { created_at: lastItem.created_at, id: lastItem.id }
      : null;
    const nextOffset = hasMore ? from + items.length : null;

    return NextResponse.json({
      ok: true,
      data: items,
      items,
      total: items.length,
      page: {
        limit,
        offset: from,
        nextOffset,
        hasMore,
        total: items.length,
        nextCursor,
      },
    });
  } catch (e: any) {
    console.error("[alunos list error]", e);
    return NextResponse.json({ ok: false, error: e.message || "Erro desconhecido" }, { status: 500 });
  }
}
