// @kf2 allow-scan
// apps/web/src/app/api/secretaria/operacoes-academicas/virada/wizard/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import type { Database, Json } from "~types/supabase";

export const dynamic = "force-dynamic";

const WizardSchema = z.object({
  current_step: z.number().int().min(0).max(10).optional(),
  status: z.enum(["active", "completed", "failed", "cancelled"]).optional(),
  payload: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export async function GET(request: Request) {
  try {
    const supabase = await supabaseServerTyped<Database>();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const escolaId = await resolveEscolaIdForUser(supabase, user.id);
    if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não identificada" }, { status: 403 });

    // Busca o processo de virada ativo mais recente
    const { data: wizard, error } = await supabase
      .from("wizard_processos")
      .select("*")
      .eq("escola_id", escolaId)
      .eq("tipo", "virada_ano_letivo")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({ ok: true, wizard: wizard || null });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await supabaseServerTyped<Database>();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const escolaId = await resolveEscolaIdForUser(supabase, user.id);
    if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não identificada" }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    const parsed = WizardSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ ok: false, error: "Dados inválidos" }, { status: 400 });

    // UPSERT: Atualiza o processo ativo ou cria um novo
    const { data: existing } = await supabase
      .from("wizard_processos")
      .select("id")
      .eq("escola_id", escolaId)
      .eq("tipo", "virada_ano_letivo")
      .eq("status", "active")
      .maybeSingle();

    const payload: Database["public"]["Tables"]["wizard_processos"]["Insert"] = {
      escola_id: escolaId,
      tipo: "virada_ano_letivo",
      created_by: user.id,
      current_step: parsed.data.current_step,
      status: parsed.data.status,
      payload: parsed.data.payload as Json | undefined,
      metadata: parsed.data.metadata as Json | undefined,
    };

    let result;
    if (existing?.id) {
      result = await supabase.from("wizard_processos").update(payload).eq("id", existing.id).select().single();
    } else {
      result = await supabase.from("wizard_processos").insert(payload).select().single();
    }

    if (result.error) throw result.error;

    return NextResponse.json({ ok: true, wizard: result.data });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
