import { NextResponse } from "next/server";
import { performance } from "node:perf_hooks";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import type { Database } from "~types/supabase";

export async function GET() {
  try {
    const shouldLog = process.env.NODE_ENV !== 'production';
    const logId = shouldLog ? `secretaria.dashboard.${Date.now()}.${Math.random().toString(36).slice(2, 8)}` : '';
    const log = (label: string, durationMs: number) => {
      if (shouldLog) {
        console.log(`${logId}.${label}: ${durationMs.toFixed(1)}ms`);
      }
    };
    const totalStart = shouldLog ? performance.now() : 0;
    const clientStart = shouldLog ? performance.now() : 0;
    const supabase = await supabaseServerTyped<Database>();
    if (shouldLog) log('client', performance.now() - clientStart);
    const authStart = shouldLog ? performance.now() : 0;
    const { data: sessionRes } = await supabase.auth.getSession();
    const user = sessionRes?.session?.user ?? null;
    if (shouldLog) log('auth', performance.now() - authStart);
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 });

    const metaEscolaId = (user.app_metadata as { escola_id?: string | null } | null)?.escola_id ?? undefined;
    const resolveStart = shouldLog ? performance.now() : 0;
    const escolaId = await resolveEscolaIdForUser(
      supabase,
      user.id,
      null,
      metaEscolaId ? String(metaEscolaId) : null
    );
    if (shouldLog) log('resolve', performance.now() - resolveStart);
    if (!escolaId) {
      if (shouldLog) log('total', performance.now() - totalStart);
      return NextResponse.json({
        ok: true,
        counts: { alunos: 0, matriculas: 0, turmas: 0, pendencias: 0 },
        resumo_status: [],
        turmas_destaque: [],
        novas_matriculas: [],
        avisos_recentes: [],
      });
    }

    const kpisStart = shouldLog ? performance.now() : 0;
    const countsQuery = supabase
      .from('vw_secretaria_dashboard_counts')
      .select('alunos_ativos, matriculas_total, turmas_total')
      .eq('escola_id', escolaId)
      .maybeSingle();
    const queryStart = shouldLog ? performance.now() : 0;
    const { data: countsRow, error: countsError } = await countsQuery;
    if (shouldLog) {
      log('kpis.query', performance.now() - queryStart);
      log('kpis', performance.now() - kpisStart);
    }
    if (countsError) {
      return NextResponse.json({ ok: false, error: countsError.message }, { status: 500 });
    }

    const response = NextResponse.json({
      ok: true,
      counts: {
        alunos: countsRow?.alunos_ativos ?? 0,
        matriculas: countsRow?.matriculas_total ?? 0,
        turmas: countsRow?.turmas_total ?? 0,
        pendencias: 0,
      },
    });
    if (shouldLog) log('total', performance.now() - totalStart);
    return response;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
