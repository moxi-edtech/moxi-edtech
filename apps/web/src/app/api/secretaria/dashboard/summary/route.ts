import { NextResponse } from "next/server";
import { performance } from "node:perf_hooks";
import { createRouteClient } from "@/lib/supabase/route-client";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { parsePlanTier } from "@/config/plans";
import { AlunoStatusSchema } from "@moxi/tenant-sdk/aluno";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ResumoStatusItem = {
  status?: string | null;
  total?: number | string | null;
};

function isResumoStatusItem(value: unknown): value is ResumoStatusItem {
  return typeof value === "object" && value !== null;
}

function normalizeStatus(status: string) {
  const parsedStatus = AlunoStatusSchema.safeParse(status);
  if (!parsedStatus.success) {
    return { label: status || "Indefinido", context: "neutral" as const };
  }

  switch (parsedStatus.data) {
    case "ativo":
      return { label: "Ativo", context: "success" as const };
    case "concluido":
      return { label: "Concluído", context: "muted" as const };
    case "transferido":
    case "pendente":
      return { label: "Pendente", context: "alert" as const };
    case "inativo":
    case "suspenso":
    case "trancado":
    case "desistente":
      return { label: "Irregular", context: "alert" as const };
    default:
      return { label: status || "Indefinido", context: "neutral" as const };
  }
}

export async function GET() {
  try {
    const shouldLog = process.env.NODE_ENV !== "production";
    const logId = shouldLog
      ? `secretaria.summary.${Date.now()}.${Math.random().toString(36).slice(2, 8)}`
      : "";
    const totalStart = shouldLog ? performance.now() : 0;
    const log = (label: string, durationMs: number) => {
      if (shouldLog) {
        console.log(`${logId}.${label}: ${durationMs.toFixed(1)}ms`);
      }
    };

    const clientStart = shouldLog ? performance.now() : 0;
    const supabase = await createRouteClient();
    if (shouldLog) log("client", performance.now() - clientStart);

    const authStart = shouldLog ? performance.now() : 0;
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user ?? null;
    if (shouldLog) log("auth", performance.now() - authStart);
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const metaEscolaId = (user.app_metadata as { escola_id?: string | null } | null)?.escola_id ?? undefined;
    const resolveStart = shouldLog ? performance.now() : 0;
    const escolaId = await resolveEscolaIdForUser(
      supabase,
      user.id,
      null,
      metaEscolaId ? String(metaEscolaId) : null
    );
    if (shouldLog) log("resolve", performance.now() - resolveStart);

    if (!escolaId) {
      if (shouldLog) log("total", performance.now() - totalStart);
      return NextResponse.json({
        ok: true,
        counts: { alunos: 0, matriculas: 0, turmas: 0, pendencias: 0 },
        recentes: { pendencias: 0, novas_matriculas: [], avisos_recentes: [], fecho_trimestre: null },
        escola: { nome: null, plano: null, status: null },
      });
    }

    const nowIso = new Date().toISOString();
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const queryStart = shouldLog ? performance.now() : 0;
    const [countsRes, recentesRes, escolaRes, anoLetivoRes, matriculasHojeRes, slugRes] = await Promise.all([
      supabase
        .from("vw_secretaria_dashboard_counts")
        .select("alunos_ativos, matriculas_total, turmas_total")
        .eq("escola_id", escolaId)
        .maybeSingle(),
      supabase
        .from("vw_secretaria_dashboard_kpis")
        .select("pendencias_importacao, resumo_status, novas_matriculas, avisos_recentes")
        .eq("escola_id", escolaId)
        .maybeSingle(),
      supabase
        .from("vw_escola_info")
        .select("nome, plano_atual, status")
        .eq("escola_id", escolaId)
        .maybeSingle(),
      supabase
        .from("anos_letivos")
        .select("id")
        .eq("escola_id", escolaId)
        .eq("ativo", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("matriculas")
        .select("id", { count: "exact", head: true })
        .eq("escola_id", escolaId)
        .gte("created_at", startOfDay.toISOString())
        .lt("created_at", endOfDay.toISOString()),
      supabase
        .from("escolas")
        .select("slug")
        .eq("id", escolaId)
        .maybeSingle(),
    ]);
    if (shouldLog) log("queries.parallel", performance.now() - queryStart);

    if (countsRes.error) {
      return NextResponse.json({ ok: false, error: countsRes.error.message }, { status: 500 });
    }
    if (recentesRes.error) {
      return NextResponse.json({ ok: false, error: recentesRes.error.message }, { status: 500 });
    }
    if (escolaRes.error) {
      return NextResponse.json({ ok: false, error: escolaRes.error.message }, { status: 500 });
    }
    if (anoLetivoRes.error) {
      return NextResponse.json({ ok: false, error: anoLetivoRes.error.message }, { status: 500 });
    }
    if (matriculasHojeRes.error) {
      return NextResponse.json({ ok: false, error: matriculasHojeRes.error.message }, { status: 500 });
    }
    if (slugRes.error) {
      return NextResponse.json({ ok: false, error: slugRes.error.message }, { status: 500 });
    }

    const resumoStatus = Array.isArray(recentesRes.data?.resumo_status)
      ? recentesRes.data?.resumo_status.filter(isResumoStatusItem)
      : [];
    const pendenciasMatriculas = resumoStatus
      .filter((item) => normalizeStatus(String(item.status ?? "")).context === "alert")
      .reduce((acc, item) => acc + Number(item.total ?? 0), 0);
    const pendenciasImportacao = Number(recentesRes.data?.pendencias_importacao ?? 0);
    const pendencias = pendenciasMatriculas + pendenciasImportacao;
    const anoLetivoId = anoLetivoRes.data?.id ?? null;
    const periodoStart = shouldLog ? performance.now() : 0;
    const { data: periodoFecho, error: periodoError } = anoLetivoId
      ? await supabase
          .from("periodos_letivos")
          .select("numero, trava_notas_em")
          .eq("escola_id", escolaId)
          .eq("ano_letivo_id", anoLetivoId)
          .gte("trava_notas_em", nowIso)
          .order("trava_notas_em", { ascending: true })
          .limit(1)
          .maybeSingle()
      : { data: null, error: null };
    if (shouldLog) log("periodo", performance.now() - periodoStart);

    if (periodoError) {
      return NextResponse.json({ ok: false, error: periodoError.message }, { status: 500 });
    }

    const response = NextResponse.json({
      ok: true,
      counts: {
        alunos: countsRes.data?.alunos_ativos ?? 0,
        matriculas: matriculasHojeRes.count ?? 0,
        turmas: countsRes.data?.turmas_total ?? 0,
        pendencias,
      },
      recentes: {
        pendencias,
        novas_matriculas: Array.isArray(recentesRes.data?.novas_matriculas)
          ? recentesRes.data?.novas_matriculas
          : [],
        avisos_recentes: Array.isArray(recentesRes.data?.avisos_recentes)
          ? recentesRes.data?.avisos_recentes
          : [],
        fecho_trimestre: periodoFecho?.trava_notas_em
          ? {
              numero: Number(periodoFecho.numero ?? 0),
              trava_notas_em: String(periodoFecho.trava_notas_em),
            }
          : null,
      },
      escola: {
        nome: escolaRes.data?.nome ?? null,
        slug: slugRes.data?.slug ?? null,
        plano: escolaRes.data?.plano_atual ? parsePlanTier(escolaRes.data.plano_atual) : null,
        status: escolaRes.data?.status ?? null,
      },
    });
    if (shouldLog) log("total", performance.now() - totalStart);
    return response;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
