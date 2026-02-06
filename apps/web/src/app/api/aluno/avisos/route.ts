import { NextResponse } from "next/server";
import { getAlunoContext } from "@/lib/alunoContext";
import { applyKf2ListInvariants } from "@/lib/kf2";
import type { Database } from "~types/supabase";

type DatabaseWithAvisos = Database & {
  public: Database["public"] & {
    Tables: Database["public"]["Tables"] & {
      avisos: {
        Row: {
          id: string;
          titulo: string | null;
          resumo: string | null;
          origem: string | null;
          created_at: string | null;
          escola_id: string | null;
        };
      };
    };
  };
};

export async function GET() {
  try {
    const { supabase, ctx } = await getAlunoContext();
    if (!ctx) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    const { escolaId } = ctx;

    if (!escolaId) return NextResponse.json({ ok: true, avisos: [] });

    const supabaseAvisos = supabase as unknown as import("@supabase/supabase-js").SupabaseClient<DatabaseWithAvisos>;

    let query = supabaseAvisos
      .from('avisos')
      .select('id, titulo, resumo, origem, created_at')
      .eq('escola_id', escolaId)
      
    query = applyKf2ListInvariants(query);

    const { data, error } = await query;

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    const avisos = (data || []).map((a: any) => ({
      id: a.id,
      titulo: a.titulo,
      resumo: a.resumo,
      origem: a.origem,
      data: a.created_at,
    }));

    return NextResponse.json({ ok: true, avisos });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
