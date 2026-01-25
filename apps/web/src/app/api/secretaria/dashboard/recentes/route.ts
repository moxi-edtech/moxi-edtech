import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import type { Database } from "~types/supabase";
import { AlunoStatusSchema } from '@moxi/tenant-sdk/aluno';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function normalizeStatus(status: string): { label: string; context: 'success' | 'alert' | 'muted' | 'neutral' } {
  const parsedStatus = AlunoStatusSchema.safeParse(status);
  if (!parsedStatus.success) {
    return { label: status || 'Indefinido', context: "neutral" as const };
  }

  const value = parsedStatus.data;

  switch (value) {
    case 'ativo':
      return { label: "Ativo", context: "success" as const };
    case 'concluido':
      return { label: "Concluído", context: "muted" as const };
    case 'transferido':
      return { label: "Transferido", context: "alert" as const };
    case 'pendente':
      return { label: "Pendente", context: "alert" as const };
    case 'inativo':
    case 'suspenso':
    case 'trancado':
    case 'desistente':
      return { label: "Irregular", context: "alert" as const };
    default:
      return { label: status || 'Indefinido', context: "neutral" as const };
  }
}

export async function GET() {
  try {
    const supabase = await supabaseServerTyped<Database>();
    const { data: sessionRes } = await supabase.auth.getSession();
    const user = sessionRes?.session?.user ?? null;
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 });

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
        pendencias: 0,
        novas_matriculas: [],
        avisos_recentes: [],
      });
    }

    const { data: kpis, error: kpisError } = await supabase
      .from('vw_secretaria_dashboard_kpis')
      .select('pendencias_importacao, resumo_status, novas_matriculas, avisos_recentes')
      .eq('escola_id', escolaId)
      .maybeSingle();

    if (kpisError) {
      return NextResponse.json({ ok: false, error: kpisError.message }, { status: 500 });
    }

    const resumoStatus = Array.isArray(kpis?.resumo_status) ? kpis?.resumo_status : [];
    const pendenciasMatriculas = resumoStatus
      .filter((item: any) => normalizeStatus(item.status).context === 'alert')
      .reduce((acc: number, item: any) => acc + Number(item.total ?? 0), 0);
    const pendenciasImportacao = Number(kpis?.pendencias_importacao ?? 0);
    const pendencias = pendenciasMatriculas + pendenciasImportacao;

    return NextResponse.json({
      ok: true,
      pendencias,
      novas_matriculas: Array.isArray(kpis?.novas_matriculas) ? kpis?.novas_matriculas : [],
      avisos_recentes: Array.isArray(kpis?.avisos_recentes) ? kpis?.avisos_recentes : [],
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
