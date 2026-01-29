import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import type { Database } from "~types/supabase";
import { parsePlanTier } from "@/config/plans";
import { AlunoStatusSchema } from "@moxi/tenant-sdk/aluno";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
    const supabase = await createClient();
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user ?? null;
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const metaEscolaId = (user.app_metadata as { escola_id?: string | null } | null)?.escola_id ?? undefined;
    const escolaId = await resolveEscolaIdForUser(
      supabase,
      user.id,
      null,
      metaEscolaId ? String(metaEscolaId) : null
    );

    if (!escolaId) {
      return NextResponse.json({
        ok: true,
        counts: { alunos: 0, matriculas: 0, turmas: 0, pendencias: 0 },
        recentes: { pendencias: 0, novas_matriculas: [], avisos_recentes: [] },
        escola: { nome: null, plano: null, status: null },
      });
    }

    const [countsRes, recentesRes, escolaRes] = await Promise.all([
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
        .from("escolas")
        .select("nome, plano_atual, status")
        .eq("id", escolaId)
        .maybeSingle(),
    ]);

    if (countsRes.error) {
      return NextResponse.json({ ok: false, error: countsRes.error.message }, { status: 500 });
    }
    if (recentesRes.error) {
      return NextResponse.json({ ok: false, error: recentesRes.error.message }, { status: 500 });
    }
    if (escolaRes.error) {
      return NextResponse.json({ ok: false, error: escolaRes.error.message }, { status: 500 });
    }

    const resumoStatus = Array.isArray(recentesRes.data?.resumo_status)
      ? recentesRes.data?.resumo_status
      : [];
    const pendenciasMatriculas = resumoStatus
      .filter((item: any) => normalizeStatus(item.status).context === "alert")
      .reduce((acc: number, item: any) => acc + Number(item.total ?? 0), 0);
    const pendenciasImportacao = Number(recentesRes.data?.pendencias_importacao ?? 0);
    const pendencias = pendenciasMatriculas + pendenciasImportacao;

    return NextResponse.json({
      ok: true,
      counts: {
        alunos: countsRes.data?.alunos_ativos ?? 0,
        matriculas: countsRes.data?.matriculas_total ?? 0,
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
      },
      escola: {
        nome: escolaRes.data?.nome ?? null,
        plano: escolaRes.data?.plano_atual ? parsePlanTier(escolaRes.data.plano_atual) : null,
        status: escolaRes.data?.status ?? null,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
