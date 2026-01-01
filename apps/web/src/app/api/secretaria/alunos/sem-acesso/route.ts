import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";
import { resolveEscolaIdForUser, authorizeEscolaAction } from "@/lib/escola/disciplinas";

export async function GET(req: Request) {
  try {
    const s = await supabaseServerTyped<Database>();
    const { data: userRes } = await s.auth.getUser();
    const user = userRes?.user;
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const url = new URL(req.url);
    const escolaIdParam = url.searchParams.get("escolaId") || undefined;
    const escolaId = escolaIdParam || (await resolveEscolaIdForUser(s as any, user.id));
    if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não encontrada" }, { status: 400 });

    const authz = await authorizeEscolaAction(s as any, escolaId, user.id, []);
    if (!authz.allowed) return NextResponse.json({ ok: false, error: authz.reason || "Sem permissão" }, { status: 403 });

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: "Server misconfigured" }, { status: 500 });
    }

    const admin = createClient<any>(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data, error } = await admin
      .from("alunos")
      .select("id, nome, codigo_ativacao, created_at, responsavel_contato, telefone_responsavel, encarregado_telefone")
      .eq("escola_id", escolaId)
      .is("deleted_at", null)
      .eq("acesso_liberado", false)
      .not("status", "eq", "inativo")
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    const items = (data || []).map((row: any) => {
      const telefone = row.responsavel_contato || row.telefone_responsavel || row.encarregado_telefone || null;
      return {
        id: row.id,
        nome: row.nome,
        codigo_ativacao: row.codigo_ativacao ?? null,
        criado_em: row.created_at ?? null,
        telefone,
      };
    });

    return NextResponse.json({ ok: true, items });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
