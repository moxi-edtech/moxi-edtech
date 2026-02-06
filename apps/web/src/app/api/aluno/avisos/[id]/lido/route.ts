import { NextResponse } from "next/server";
import { getAlunoContext } from "@/lib/alunoContext";
import type { Database } from "~types/supabase";

type DatabaseWithAvisos = Database & {
  public: Database["public"] & {
    Tables: Database["public"]["Tables"] & {
      avisos_lidos: {
        Row: {
          aviso_id: string;
          user_id: string;
          lido_em: string | null;
        };
        Insert: {
          aviso_id: string;
          user_id: string;
          lido_em?: string | null;
        };
      };
    };
  };
};

export async function PATCH(_req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { supabase, ctx } = await getAlunoContext();
    if (!ctx) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    const { userId } = ctx;

    // Registra leitura do aviso pelo usuário
    const supabaseAvisos = supabase as unknown as import("@supabase/supabase-js").SupabaseClient<DatabaseWithAvisos>;

    const { error } = await supabaseAvisos
      .from('avisos_lidos')
      .upsert({ aviso_id: id, user_id: userId, lido_em: new Date().toISOString() }, { onConflict: 'aviso_id,user_id' });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
