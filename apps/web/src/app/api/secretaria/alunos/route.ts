import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";

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

    const { data: prof } = await supabase
      .from("profiles")
      .select("current_escola_id, escola_id, user_id, role")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1);

    const role = (prof?.[0] as any)?.role as string | undefined;
    const allowedRoles = ["super_admin", "global_admin", "admin", "secretaria", "financeiro", "professor"];
    if (!role || !allowedRoles.includes(role)) {
      return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 });
    }

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
          .limit(1)
          .maybeSingle();
        escolaId = (vinc as any)?.escola_id as string | undefined;
      } catch {
        // silencioso
      }
    }

    if (!escolaId) {
      return NextResponse.json({ ok: false, error: "Usuário não vinculado a nenhuma escola" }, { status: 403 });
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: "Server misconfigured: falta SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 });
    }

    // Admin client to bypass RLS after manual escopo/role checks
    const admin = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const url = new URL(req.url);
    const q = url.searchParams.get("q")?.trim() || "";
    const status = (url.searchParams.get("status") || 'ativo').toLowerCase();
    const sessionIdParam = url.searchParams.get("session_id")?.trim() || undefined;
    const page = Math.max(
      1,
      parseInt(url.searchParams.get("page") || "1", 10) || 1
    );
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(url.searchParams.get("pageSize") || "20", 10) || 20)
    );
    const offset = (page - 1) * pageSize;

    // Tentar usar a sessão enviada na query; se não houver ou não pertencer à escola, cai para a ativa
    let activeSessionId: string | undefined = undefined;
    if (sessionIdParam) {
      const { data: sessParam } = await admin
        .from('school_sessions')
        .select('id')
        .eq('id', sessionIdParam)
        .eq('escola_id', escolaId)
        .limit(1);
      activeSessionId = (sessParam?.[0] as any)?.id as string | undefined;
    }

    // Descobrir sessão ativa da escola (para filtrar alunos já matriculados)
    if (!activeSessionId) {
      const { data: sess } = await admin
        .from('school_sessions')
        .select('id, status')
        .eq('escola_id', escolaId)
        .eq('status', 'ativa')
        .order('data_inicio', { ascending: false })
        .limit(1);
      activeSessionId = (sess?.[0] as any)?.id as string | undefined;
    }

    const selectFields = "id, nome, bi_numero, responsavel, telefone_responsavel, status, created_at, profile_id, escola_id, profiles!alunos_profile_id_fkey ( numero_login, email, bi_numero )";

    const mapAlunoRow = (row: any) => {
      let numero_login: string | null = null;
      let email: string | null = null;
      let bi_numero: string | null = row.bi_numero ?? null;
      const profiles = row.profiles;

      if (Array.isArray(profiles)) {
        numero_login = profiles[0]?.numero_login ?? null;
        email = profiles[0]?.email ?? null;
        bi_numero = bi_numero ?? profiles[0]?.bi_numero ?? null;
      } else if (profiles && typeof profiles === "object") {
        numero_login = (profiles as any).numero_login ?? null;
        email = (profiles as any).email ?? null;
        bi_numero = bi_numero ?? (profiles as any).bi_numero ?? null;
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
        bi_numero,
        bilhete: bi_numero,
      };
    };

    // --- Alunos com matrícula ativa ---
    if (status === 'ativo') {
      let query = admin
        .from('alunos')
        .select(`${selectFields}, matriculas!inner(id, session_id, numero_matricula, status)`, { count: 'exact' })
        .eq('escola_id', escolaId)
        .eq('matriculas.escola_id', escolaId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .not('matriculas.numero_matricula', 'is', null);

      if (activeSessionId) {
        query = query.eq('matriculas.session_id', activeSessionId);
      } else {
        query = query.in('matriculas.status', ['ativo', 'ativa']);
      }

      if (q) {
        const uuidRe = /^[0-9a-fA-F-]{36}$/;
        if (uuidRe.test(q)) {
          query = query.or(`id.eq.${q}`);
        } else {
          let profileIds: string[] = [];
          try {
            let profQuery = admin
              .from("profiles")
              .select("user_id, numero_login")
              .ilike("numero_login", `%${q}%`)
              .or(`escola_id.eq.${escolaId},current_escola_id.eq.${escolaId}`)
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
            const inList = profileIds.map((id) => `"${id}"`).join(",");
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

      const seen = new Set<string>();
      const items = (data ?? []).reduce((acc: any[], row: any) => {
        if (!seen.has(row.id)) {
          seen.add(row.id);
          acc.push(mapAlunoRow(row));
        }
        return acc;
      }, []);

      return NextResponse.json({
        ok: true,
        items,
        total: count ?? items.length,
        page,
        pageSize,
      });
    }

    // Se existe sessão (selecionada ou ativa), coletar alunos com matrícula nesta sessão para excluí-los do resultado
    let alunosComMatriculaAtual: string[] = [];
    if (escolaId && activeSessionId) {
      try {
        const { data: mats } = await admin
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
        const { data: mats } = await admin
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
        const { data: matsComNumero } = await admin
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

    // Demais status
    // Agora com relacionamento para profiles(numero_login)
    let query = admin
      .from("alunos")
      .select(selectFields, { count: "exact" })
      .order("created_at", { ascending: false });

    const alunosMatriculados = Array.from(new Set(alunosComMatriculaAtual)).filter(Boolean);

    // Garante escopo da escola atual
    query = query.eq("escola_id", escolaId);

    switch (status) {
      case 'inativo':
        if (alunosMatriculados.length > 0) {
          const list = alunosMatriculados.map((id) => `"${id}"`).join(',');
          query = query.not('id', 'in', `(${list})`);
        }
        // Garante que "pendentes" não apareçam como inativos
        query = query.not('status', 'eq', 'pendente');
        query = query.is('deleted_at', null);
        break;

      case 'pendente':
        query = query.eq('status', 'pendente');
        query = query.is('deleted_at', null);
        break;

      case 'arquivado':
        query = query.not('deleted_at', 'is', null);
        break;
      
      case 'todos':
      default:
        // Por padrão, 'todos' deve incluir tanto alunos ativos quanto arquivados.
        // Nenhuma condição adicional de deleted_at aqui.
        break;
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
          let profQuery = admin
            .from("profiles")
            .select("user_id, numero_login")
            .ilike("numero_login", `%${q}%`)
            .or(`escola_id.eq.${escolaId},current_escola_id.eq.${escolaId}`)
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
          const inList = profileIds.map((id) => `"${id}"`).join(",");
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

    const items = (data ?? []).map(mapAlunoRow);

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
