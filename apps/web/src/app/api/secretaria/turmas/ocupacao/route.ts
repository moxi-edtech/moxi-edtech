import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { authorizeTurmasManage } from "@/lib/escola/disciplinas";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { applyKf2ListInvariants } from "@/lib/kf2";
import { requireFeature } from "@/lib/plan/requireFeature";
import { HttpError } from "@/lib/errors";
import { groupOccupancyPage, type OcupacaoRow } from "@/lib/operacoes/occupancy-page";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const pageSchema = z.coerce.number().int().min(1).max(10000);
const sizeSchema = z.coerce.number().int().min(1).max(50);
const statusSchema = z.enum(["ideal", "disponivel", "cheia", "superlotada"]);

function readQuery(searchParams: URLSearchParams) {
  const page = pageSchema.safeParse(searchParams.get("page") ?? "1");
  const pageSize = sizeSchema.safeParse(searchParams.get("page_size") ?? "25");
  const escolaId = searchParams.get("escola_id");
  const schoolValid = escolaId === null || z.string().uuid().safeParse(escolaId).success;
  const classe = searchParams.get("classe")?.trim() ?? "";
  const turno = searchParams.get("turno")?.trim() ?? "";
  const rawStatus = searchParams.get("status")?.trim() ?? "";
  const status = rawStatus ? statusSchema.safeParse(rawStatus) : null;
  const parsePercent = (key: string) => {
    const raw = searchParams.get(key);
    if (raw === null || raw === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 && n <= 10000 ? n : "invalid" as const;
  };
  const minPercent = parsePercent("minPercent");
  const maxPercent = parsePercent("maxPercent");
  const valid = page.success && pageSize.success && schoolValid &&
    classe.length <= 100 && turno.length <= 30 &&
    (!status || status.success) &&
    minPercent !== "invalid" && maxPercent !== "invalid" &&
    !(typeof minPercent === "number" && typeof maxPercent === "number" && minPercent > maxPercent);
  return {
    valid,
    page: page.success ? page.data : 1,
    pageSize: pageSize.success ? pageSize.data : 25,
    escolaId,
    classe,
    turno,
    status: status?.success ? status.data : "",
    minPercent,
    maxPercent,
  };
}

export async function GET(req: Request) {
  try {
    const queryInput = readQuery(new URL(req.url).searchParams);
    if (!queryInput.valid) {
      return NextResponse.json({ ok: false, error: "Filtros ou paginação inválidos." }, { status: 400 });
    }

    const supabase = await supabaseServerTyped<any>();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });

    const escolaId = await resolveEscolaIdForUser(supabase as any, auth.user.id, queryInput.escolaId);
    if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não autorizada." }, { status: 403 });

    const access = await authorizeTurmasManage(supabase as any, escolaId, auth.user.id);
    if (!access.allowed) return NextResponse.json({ ok: false, error: access.reason || "Sem permissão." }, { status: 403 });

    try {
      await requireFeature("doc_qr_code");
    } catch (error) {
      if (error instanceof HttpError) {
        return NextResponse.json({ ok: false, error: error.message, code: error.code }, { status: error.status });
      }
      throw error;
    }

    // The view is a security_invoker wrapper around an already aggregated
    // materialized view. Exact count here is per school and filters, not an
    // unscoped COUNT(*) against raw enrollment joins.
    let query = supabase
      .from("vw_ocupacao_turmas")
      .select(
        "id,escola_id,nome,classe,turno,sala,capacidade_maxima,total_matriculas_ativas,ocupacao_percentual,status_ocupacao",
        { count: "exact" },
      )
      .eq("escola_id", escolaId);

    if (queryInput.classe) query = query.eq("classe", queryInput.classe);
    if (queryInput.turno) query = query.eq("turno", queryInput.turno);
    if (queryInput.status) query = query.eq("status_ocupacao", queryInput.status);
    if (typeof queryInput.minPercent === "number") query = query.gte("ocupacao_percentual", queryInput.minPercent);
    if (typeof queryInput.maxPercent === "number") query = query.lte("ocupacao_percentual", queryInput.maxPercent);

    query = applyKf2ListInvariants(query, {
      limit: queryInput.pageSize,
      offset: (queryInput.page - 1) * queryInput.pageSize,
      maxLimit: 50,
      order: [
        { column: "classe", ascending: true },
        { column: "turno", ascending: true },
        { column: "nome", ascending: true },
        { column: "id", ascending: true },
      ],
    });

    const { data, error, count } = await query;
    if (error) throw error;
    if (typeof count !== "number" || !Number.isFinite(count)) {
      return NextResponse.json({ ok: false, error: "Não foi possível confirmar a contagem de turmas." }, { status: 503 });
    }

    // Class options are read independently of the filtered page. A change in
    // page/status must not remove valid class options from the filter.
    const { data: availableClasses, error: classesError } = await supabase
      .from("classes")
      .select("nome")
      .eq("escola_id", escolaId)
      .order("nome", { ascending: true })
      .limit(200);
    if (classesError) throw classesError;
    const classes = [...new Set((availableClasses ?? [])
      .map((row: { nome?: string | null }) => row.nome?.trim())
      .filter((name: string | undefined): name is string => Boolean(name)))];

    const rows = (data ?? []) as OcupacaoRow[];
    const pages = Math.max(1, Math.ceil(count / queryInput.pageSize));

    return NextResponse.json({
      ok: true,
      total_turmas: count,
      resultados_na_pagina: rows.length,
      pagina: queryInput.page,
      tamanho_pagina: queryInput.pageSize,
      total_paginas: pages,
      tem_mais: queryInput.page < pages,
      grupos_escopo: "pagina",
      grupos: groupOccupancyPage(rows),
      classes_disponiveis: classes,
    }, {
      headers: {
        "Cache-Control": "private, no-store",
        "Deprecation": "true",
        "Link": `</api/escolas/${escolaId}/turmas>; rel="successor-version"`,
      },
    });
  } catch (error) {
    console.error("[SECRETARIA_TURMAS_OCUPACAO_GET]", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ ok: false, error: "Não foi possível carregar a ocupação das turmas." }, { status: 500 });
  }
}
