import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const supabase = await supabaseServerTyped<any>();
    const { data } = await supabase.from('escolas').select('plano').eq('id', id).maybeSingle();
    return NextResponse.json({ plano: (data as any)?.plano ?? null });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ plano: null, error: message }, { status: 200 });
  }
}

