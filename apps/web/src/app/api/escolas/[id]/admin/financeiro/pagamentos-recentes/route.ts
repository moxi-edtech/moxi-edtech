// @kf2 allow-scan
import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const querySchema = z.object({
  limit: z.string().optional(),
  day_key: z.string().optional(),
});

function getLocalDayKey(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Luanda",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: escolaId } = await context.params;
    const supabase = await supabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const metaEscolaId = (user.app_metadata as { escola_id?: string | null } | null)?.escola_id ?? null;
    const resolvedEscolaId = await resolveEscolaIdForUser(
      supabase as any,
      user.id,
      escolaId,
      metaEscolaId ? String(metaEscolaId) : null
    );

    if (!resolvedEscolaId) {
      return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse({
      limit: searchParams.get("limit") || undefined,
      day_key: searchParams.get("day_key") || undefined,
    });

    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Parâmetros inválidos" }, { status: 400 });
    }

    const limit = Math.min(Math.max(Number(parsed.data.limit ?? 10), 1), 50);
    const dayKey = parsed.data.day_key ?? getLocalDayKey();

    const supabaseAny = supabase as any;
    const { data, error } = await supabaseAny
      .from("vw_pagamentos_recentes_humanized")
      .select("id, aluno_id, aluno_nome, valor_pago, metodo, metodo_label, status, status_label, created_at")
      .eq("escola_id", resolvedEscolaId)
      .eq("day_key", dayKey)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const normalized = (data ?? []).map((row: any) => ({
      id: row.id,
      aluno_id: row.aluno_id ?? null,
      aluno_nome: row.aluno_nome ?? null,
      valor_pago: row.valor_pago ?? null,
      metodo: row.metodo_label ?? row.metodo ?? null,
      status: row.status_label ?? row.status ?? null,
      created_at: row.created_at ?? null,
    }));

    return NextResponse.json({ ok: true, data: normalized });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
