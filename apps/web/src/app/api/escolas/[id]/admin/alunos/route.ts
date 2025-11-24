import { NextRequest, NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: escolaId } = await ctx.params;
  try {
    const s = await supabaseServerTyped<any>();
    const { data: userRes } = await s.auth.getUser();
    if (!userRes?.user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const url = new URL(req.url);
    const status = (url.searchParams.get("status") || "active").toLowerCase();
    const q = (url.searchParams.get("q") || "").trim();

    let query = s
      .from("alunos")
      .select(
        "id, nome, status, created_at, profile_id, escola_id, profiles!alunos_profile_id_fkey ( email, numero_login )",
        { count: "exact" }
      )
      .eq("escola_id", escolaId)
      .order("created_at", { ascending: false });

    if (status === "archived") {
      query = query.not("deleted_at", "is", null);
    } else {
      query = query.is("deleted_at", null);
    }

    if (q) {
      const uuidRe = /^[0-9a-fA-F-]{36}$/;
      if (uuidRe.test(q)) {
        query = query.or(`id.eq.${q}`);
      } else {
        // buscar por nome/responsavel e numero_login via profiles
        let profileIds: string[] = [];
        try {
          const { data: profRows } = await s
            .from("profiles")
            .select("user_id, numero_login")
            .ilike("numero_login", `%${q}%`)
            .eq("escola_id", escolaId)
            .limit(500);
          profileIds = (profRows ?? []).map((r: any) => r.user_id).filter(Boolean);
        } catch {}
        const orParts = [`nome.ilike.%${q}%`, `responsavel.ilike.%${q}%`];
        if (profileIds.length > 0) {
          const inList = profileIds.join(",");
          orParts.push(`profile_id.in.(${inList})`);
        }
        query = query.or(orParts.join(","));
      }
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    const items = (data ?? []).map((row: any) => {
      const prof = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      return {
        id: row.id,
        nome: row.nome,
        email: prof?.email ?? null,
        numero_login: prof?.numero_login ?? null,
        created_at: row.created_at,
        status: row.status ?? null,
      };
    });

    return NextResponse.json({ ok: true, items });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

