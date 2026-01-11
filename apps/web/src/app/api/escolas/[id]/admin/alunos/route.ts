import { NextRequest, NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { applyKf2ListInvariants } from "@/lib/kf2";

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

    query = applyKf2ListInvariants(query, { defaultLimit: 500 });

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
          let profQuery = s
            .from("profiles")
            .select("user_id, numero_login")
            .ilike("numero_login", `%${q}%`)
            .eq("escola_id", escolaId)

          profQuery = applyKf2ListInvariants(profQuery, { defaultLimit: 500 });

          const { data: profRows } = await profQuery;
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

    const alunoItems = (data ?? []).map((row: any) => {
      const prof = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      return {
        id: row.id,
        nome: row.nome,
        email: prof?.email ?? null,
        numero_login: prof?.numero_login ?? null,
        created_at: row.created_at,
        status: row.status ?? null,
        origem: 'aluno',
      };
    });

    let candidaturaItems: Array<any> = [];
    if (status !== "archived") {
      let candQuery = s
        .from("candidaturas")
        .select(
          `id, aluno_id, status, created_at, nome_candidato, dados_candidato,
           alunos:aluno_id ( id, nome, nome_completo, numero_processo, bi_numero, email )`
        )
        .eq("escola_id", escolaId)
        .not("status", "in", "(matriculado,rejeitada,cancelada)")
        .order("created_at", { ascending: false });

      candQuery = applyKf2ListInvariants(candQuery, { defaultLimit: 500 });

      if (q) {
        const uuidRe = /^[0-9a-fA-F-]{36}$/;
        if (uuidRe.test(q)) {
          candQuery = candQuery.or(`id.eq.${q}`);
        } else {
          const orParts = [
            `nome_candidato.ilike.%${q}%`,
            `alunos.nome.ilike.%${q}%`,
            `alunos.nome_completo.ilike.%${q}%`,
            `alunos.numero_processo.ilike.%${q}%`,
          ];
          candQuery = candQuery.or(orParts.join(","));
        }
      }

      const { data: candData, error: candError } = await candQuery;
      if (candError) {
        return NextResponse.json({ ok: false, error: candError.message }, { status: 400 });
      }

      candidaturaItems = (candData ?? []).map((row: any) => {
        const alunoRaw = Array.isArray(row.alunos) ? row.alunos[0] : row.alunos;
        const payload = row.dados_candidato || {};
        const nome =
          alunoRaw?.nome_completo ||
          alunoRaw?.nome ||
          payload.nome_completo ||
          payload.nome ||
          row.nome_candidato ||
          "";
        const email = alunoRaw?.email || payload.email || payload.encarregado_email || null;
        return {
          id: row.id,
          nome,
          email,
          numero_login: null,
          created_at: row.created_at,
          status: row.status ?? null,
          origem: 'candidatura',
          aluno_id: row.aluno_id ?? null,
        };
      });
    }

    return NextResponse.json({ ok: true, items: [...candidaturaItems, ...alunoItems] });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
