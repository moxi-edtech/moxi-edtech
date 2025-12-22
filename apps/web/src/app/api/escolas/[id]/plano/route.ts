import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { parsePlanTier } from "@/config/plans";

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const supabase = await supabaseServerTyped<any>();
    const { data } = await supabase.from('escolas').select('plano_atual, plano').eq('id', id).maybeSingle();
    const planoRaw = (data as any)?.plano_atual ?? (data as any)?.plano ?? null;
    return NextResponse.json({ plano: planoRaw ? parsePlanTier(planoRaw) : null });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ plano: null, error: message }, { status: 200 });
  }
}
