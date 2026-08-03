import { NextResponse } from "next/server";

import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 50;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FINANCIAL_STATUSES = new Set(["sem_lancamentos", "regular", "pendente", "atrasado"]);
const RISK_STATUSES = new Set(["sem_risco", "recente", "atencao", "critico"]);

const parseBoundedInteger = (
  value: string | null,
  fallback: number,
  minimum: number,
  maximum: number
) => {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
};

const validUuid = (value: string | null) =>
  value && UUID_PATTERN.test(value) ? value : null;

export async function GET(request: Request) {
  try {
    const supabase = await supabaseServerTyped();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Não autenticado" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    const { searchParams } = new URL(request.url);
    const metadataEscolaId =
      (user.app_metadata as { escola_id?: string | null } | null)?.escola_id ?? null;
    const requestedEscolaId =
      searchParams.get("escola_id") || searchParams.get("escolaId") || null;
    const escolaId = await resolveEscolaIdForUser(
      supabase as never,
      user.id,
      requestedEscolaId,
      metadataEscolaId ? String(metadataEscolaId) : null
    );

    if (!escolaId) {
      return NextResponse.json(
        { ok: false, error: "Perfil sem escola vinculada" },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      );
    }

    const page = parseBoundedInteger(searchParams.get("page"), 1, 1, 100_000);
    const limit = parseBoundedInteger(searchParams.get("limit"), DEFAULT_LIMIT, 1, MAX_LIMIT);
    const offset = (page - 1) * limit;
    const status = searchParams.get("status");
    const risco = searchParams.get("risco");
    const turmaId = validUuid(searchParams.get("turma_id"));
    const classeId = validUuid(searchParams.get("classe_id"));
    const cursoId = validUuid(searchParams.get("curso_id"));
    const alunoId = validUuid(searchParams.get("aluno_id"));
    const anoLetivo = parseBoundedInteger(
      searchParams.get("ano_letivo"),
      0,
      0,
      9999
    );
    const busca = (searchParams.get("q") ?? "").trim().slice(0, 80);

    let query = supabase
      .from("vw_financeiro_carteira_alunos" as never)
      .select("*", { count: "exact" })
      .eq("escola_id", escolaId);

    if (status && FINANCIAL_STATUSES.has(status)) {
      query = query.eq("status_financeiro", status);
    }
    if (risco && RISK_STATUSES.has(risco)) {
      query = query.eq("status_risco", risco);
    }
    if (turmaId) query = query.eq("turma_id", turmaId);
    if (classeId) query = query.eq("classe_id", classeId);
    if (cursoId) query = query.eq("curso_id", cursoId);
    if (alunoId) query = query.eq("aluno_id", alunoId);
    if (anoLetivo > 0) query = query.eq("ano_letivo", anoLetivo);
    if (busca) query = query.ilike("nome_aluno", `%${busca}%`);

    const { data, error, count } = await query
      .order("status_financeiro", { ascending: true })
      .order("dias_maximo_atraso", { ascending: false })
      .order("nome_aluno", { ascending: true })
      .order("aluno_id", { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Erro ao consultar carteira financeira:", error.message);
      return NextResponse.json(
        { ok: false, error: "Não foi possível carregar a carteira financeira" },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    const total = count ?? 0;
    return NextResponse.json(
      {
        ok: true,
        items: data ?? [],
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Erro inesperado na carteira financeira:", error);
    return NextResponse.json(
      { ok: false, error: "Erro interno" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
