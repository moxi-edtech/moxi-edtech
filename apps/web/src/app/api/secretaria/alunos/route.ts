import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";

// Lista alunos (portal secretaria)
// Agora trazendo numero_login via relacionamento alunos -> profiles
export async function GET(req: Request) {
  try {
    const supabase = await supabaseServerTyped<any>();
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Não autenticado" },
        { status: 401 }
      );
    }

    // Ainda resolvemos escolaId (útil pra RLS / futuro)
    const { data: prof } = await supabase
      .from("profiles")
      .select("current_escola_id, escola_id, user_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1);

    let escolaId = (
      (prof?.[0] as any)?.current_escola_id ||
      (prof?.[0] as any)?.escola_id
    ) as string | undefined;

    if (!escolaId) {
      try {
        const { data: vinc } = await supabase
          .from("escola_users")
          .select("escola_id")
          .eq("user_id", user.id)
          .limit(1);
        escolaId = (vinc?.[0] as any)?.escola_id as string | undefined;
      } catch {
        // silencioso
      }
    }

    const url = new URL(req.url);
    const q = url.searchParams.get("q")?.trim() || "";
    const status = (url.searchParams.get("status") || 'active').toLowerCase();
    const sessionIdParam = url.searchParams.get("session_id")?.trim() || undefined;
    const daysParam = url.searchParams.get("days") || "";
    const page = Math.max(
      1,
      parseInt(url.searchParams.get("page") || "1", 10) || 1
    );
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(url.searchParams.get("pageSize") || "20", 10) || 20)
    );
    const offset = (page - 1) * pageSize;

    // Filtra por período (days)
    let since: string | null = null;
    if (daysParam) {
      const d = parseInt(daysParam, 10);
      if (Number.isFinite(d) && d > 0) {
        const dt = new Date();
        dt.setDate(dt.getDate() - d);
        since = dt.toISOString();
      }
    }



    // Tentar usar a sessão enviada na query; se não houver ou não pertencer à escola, cai para a ativa
    let activeSessionId: string | undefined = undefined;
    if (escolaId && sessionIdParam) {
      try {
        const { data: sessParam } = await supabase
          .from('school_sessions')
          .select('id')
          .eq('id', sessionIdParam)
          .eq('escola_id', escolaId)
          .limit(1);
        activeSessionId = (sessParam?.[0] as any)?.id as string | undefined;
      } catch {
        // silencioso
      }
    }

    // Descobrir sessão ativa da escola (para filtrar alunos já matriculados)
    if (!activeSessionId && escolaId) {
      try {
        const { data: sess } = await supabase
          .from('school_sessions')
          .select('id, status')
          .eq('escola_id', escolaId)
          .eq('status', 'ativa')
          .order('data_inicio', { ascending: false })
          .limit(1);
        activeSessionId = (sess?.[0] as any)?.id as string | undefined;
      } catch {
        // silencioso
      }
    }

    // Se existe sessão (selecionada ou ativa), coletar alunos com matrícula nesta sessão para excluí-los do resultado
    let alunosComMatriculaAtual: string[] = [];
    if (escolaId && activeSessionId) {
      try {
        const { data: mats } = await supabase
          .from('matriculas')
          .select('aluno_id')
          .eq('escola_id', escolaId)
          .eq('session_id', activeSessionId);
        alunosComMatriculaAtual = (mats ?? [])
          .map((m: any) => m.aluno_id)
          .filter((v: any) => !!v);
      } catch {
        // silencioso
      }
    } else if (escolaId && !activeSessionId) {
      // Fallback: excluir alunos com matrícula ativa na escola, sem filtrar por sessão
      try {
        const { data: mats } = await supabase
          .from('matriculas')
          .select('aluno_id, status')
          .eq('escola_id', escolaId)
          .eq('status', 'ativo');
        alunosComMatriculaAtual = (mats ?? [])
          .map((m: any) => m.aluno_id)
          .filter((v: any) => !!v);
      } catch {
        // silencioso
      }
    }

    // Blindagem extra: exclui qualquer aluno que já possua numero_matricula atribuído na escola, independentemente da sessão
    if (escolaId) {
      try {
        const { data: matsComNumero } = await supabase
          .from('matriculas')
          .select('aluno_id')
          .eq('escola_id', escolaId)
          .not('numero_matricula', 'is', null);

        const withNumero = (matsComNumero ?? [])
          .map((m: any) => m.aluno_id)
          .filter((v: any) => !!v);

        alunosComMatriculaAtual = Array.from(new Set([...(alunosComMatriculaAtual || []), ...withNumero]));
      } catch {
        // silencioso
      }
    }

    // Agora com relacionamento para profiles(numero_login)
    let query = supabase
      .from("alunos")
      .select(
        "id, nome, responsavel, telefone_responsavel, status, created_at, profile_id, escola_id, profiles!alunos_profile_id_fkey ( numero_login, email )",
        { count: "exact" }
      )
      .order("created_at", { ascending: false });

    // Garante escopo da escola atual
    if (escolaId) {
      query = query.eq("escola_id", escolaId);
    }

    // Status: ativos (deleted_at null) ou arquivados (deleted_at not null)
    if (status === 'archived') {
      query = query.not('deleted_at', 'is', null as any)
    } else {
      query = query.is('deleted_at', null)
    }

    // Excluir alunos já matriculados na sessão em uso
    if (alunosComMatriculaAtual.length > 0) {
      const list = Array.from(new Set(alunosComMatriculaAtual)).join(',');
      // NOT IN ( ... ) via supabase-js
      query = query.not('id', 'in', `(${list})`);
    }



    // Aplica filtro de período, se definido
    if (since) {
      query = query.gte("created_at", since);
    }

    if (q) {
      const uuidRe = /^[0-9a-fA-F-]{36}$/;
      if (uuidRe.test(q)) {
        query = query.or(`id.eq.${q}`);
      } else {
        // Busca por nome / responsável e também por numero_login (via profile_id)
        // 1) Coletar possíveis profiles por numero_login
        let profileIds: string[] = [];
        try {
          let profQuery = supabase
            .from("profiles")
            .select("user_id, numero_login")
            .ilike("numero_login", `%${q}%`)
            .limit(500);
          const { data: profRows } = await profQuery;
          profileIds = (profRows ?? []).map((r: any) => r.user_id).filter(Boolean);
        } catch {
          // ignore
        }

        const orParts = [
          `nome.ilike.%${q}%`,
          `responsavel.ilike.%${q}%`,
        ];
        if (profileIds.length > 0) {
          const inList = profileIds.map((id) => id).join(",");
          orParts.push(`profile_id.in.(${inList})`);
        }
        query = query.or(orParts.join(","));
      }
    }

    const { data, error, count } = await query.range(
      offset,
      offset + pageSize - 1
    );

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 400 }
      );
    }

    const items =
      (data ?? []).map((row: any) => {
        let numero_login: string | null = null;
        let email: string | null = null;
        const profiles = row.profiles;

        if (Array.isArray(profiles)) {
          numero_login = profiles[0]?.numero_login ?? null;
          email = profiles[0]?.email ?? null;
        } else if (profiles && typeof profiles === "object") {
          numero_login = (profiles as any).numero_login ?? null;
          email = (profiles as any).email ?? null;
        }

        return {
          id: row.id,
          nome: row.nome,
          email,
          responsavel: row.responsavel,
          telefone_responsavel: row.telefone_responsavel,
          status: row.status,
          created_at: row.created_at,
          numero_login,
        };
      }) ?? [];

    return NextResponse.json({
      ok: true,
      items,
      total: count ?? 0,
      page,
      pageSize,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
