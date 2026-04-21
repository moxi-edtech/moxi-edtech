import { NextRequest, NextResponse } from "next/server";
import { performance } from "node:perf_hooks";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import type { Database } from "~types/supabase";
import { parsePlanTier } from "@/config/plans";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type NomePayload = {
  ok: boolean;
  nome?: string | null;
  plano?: string | null;
  status?: string | null;
  error?: string;
};

const inFlightByKey = new Map<string, Promise<NomePayload>>();

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
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user ?? null;
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
    if (!resolvedEscolaId) {
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

    const targetEscolaId = resolvedEscolaId || escolaId;
    const key = `${user.id}:${targetEscolaId}`;

    const existing = inFlightByKey.get(key);
    const queryPromise =
      existing ??
      (async () => {
        const queryStart = shouldLog ? performance.now() : 0;
        const { data, error } = await supabase
          .from("vw_escola_info" as any)
          .select("nome, plano_atual, status")
          .eq("escola_id", targetEscolaId)
          .maybeSingle();
        if (shouldLog) log('query', performance.now() - queryStart);
        if (error) {
          return { ok: false, error: error.message } satisfies NomePayload;
        }
        const row = data as any;
        return {
          ok: true,
          nome: row?.nome ?? null,
          plano: row?.plano_atual ? parsePlanTier(row.plano_atual) : null,
          status: row?.status ?? null,
        } satisfies NomePayload;
      })();

    inFlightByKey.set(key, queryPromise);
    const payload = await queryPromise;
    inFlightByKey.delete(key);

    if (!payload.ok) {
      return NextResponse.json({ ok: false, error: payload.error ?? "Erro ao consultar escola" }, { status: 400 });
    }

    const response = NextResponse.json(payload);
    if (shouldLog) log('total', performance.now() - totalStart);
    return response;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro inesperado";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
