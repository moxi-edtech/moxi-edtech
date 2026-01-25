import { NextRequest, NextResponse } from "next/server";
import { performance } from "node:perf_hooks";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import type { Database } from "~types/supabase";
import { parsePlanTier } from "@/config/plans";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET /api/escolas/[id]/nome
// Returns the escola display name using service role after authorization.
export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: escolaId } = await context.params;

  try {
    const shouldLog = process.env.NODE_ENV !== 'production';
    const logId = shouldLog ? `escolas.nome.${Date.now()}.${Math.random().toString(36).slice(2, 8)}` : '';
    const log = (label: string, durationMs: number) => {
      if (shouldLog) {
        console.log(`${logId}.${label}: ${durationMs.toFixed(1)}ms`);
      }
    };
    const totalStart = shouldLog ? performance.now() : 0;
    const supabase = await supabaseServerTyped<Database>();
    const authStart = shouldLog ? performance.now() : 0;
    const { data: sessionRes } = await supabase.auth.getSession();
    const user = sessionRes?.session?.user ?? null;
    if (shouldLog) log('auth', performance.now() - authStart);
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const metaEscolaId = (user.app_metadata as { escola_id?: string | null } | null)?.escola_id ?? undefined;
    const resolveStart = shouldLog ? performance.now() : 0;
    const resolvedEscolaId = await resolveEscolaIdForUser(
      supabase as any,
      user.id,
      escolaId,
      metaEscolaId ? String(metaEscolaId) : null
    );
    if (shouldLog) log('resolve', performance.now() - resolveStart);
    if (!resolvedEscolaId || resolvedEscolaId !== escolaId) {
      const onboardingStart = shouldLog ? performance.now() : 0;
      const { data: draft } = await supabase
        .from("onboarding_drafts")
        .select("id")
        .eq("escola_id", escolaId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (shouldLog) log('onboarding', performance.now() - onboardingStart);
      if (!draft) {
        return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 });
      }
    }

    const queryStart = shouldLog ? performance.now() : 0;
    const { data, error } = await supabase
      .from("escolas")
      .select("nome, plano_atual, status")
      .eq("id", resolvedEscolaId || escolaId)
      .maybeSingle();
    if (shouldLog) log('query', performance.now() - queryStart);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    const row = data as any;
    const response = NextResponse.json({
      ok: true,
      nome: row?.nome ?? null,
      plano: row?.plano_atual ? parsePlanTier(row.plano_atual) : null,
      status: row?.status ?? null,
    });
    if (shouldLog) log('total', performance.now() - totalStart);
    return response;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro inesperado";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
