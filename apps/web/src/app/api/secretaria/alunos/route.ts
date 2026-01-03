import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";

function inferAno(...valores: Array<string | number | null | undefined>): number | null {
  for (const valor of valores) {
    if (valor === null || valor === undefined) continue;
    if (typeof valor === "number" && Number.isFinite(valor)) return valor;
    const match = String(valor).match(/(19|20)\d{2}/);
    if (match?.[0]) return Number(match[0]);
  }
  return null;
}

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
    const anoParamRaw = url.searchParams.get("ano") || url.searchParams.get("ano_letivo");
    const anoParam = anoParamRaw ? Number(anoParamRaw) : null;
    const anoFromQuery = Number.isFinite(anoParam) ? (anoParam as number) : null;
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
    let targetAno: number | null = anoFromQuery;
    let targetLegacySessionId: string | undefined = undefined;

    if (!targetAno && sessionIdParam) {
      const { data: anoRow } = await admin
        .from('anos_letivos')
        .select('ano, id')
        .eq('id', sessionIdParam)
        .eq('escola_id', escolaId)
        .maybeSingle();
      const anoNumero = typeof (anoRow as any)?.ano === 'string' ? Number((anoRow as any)?.ano) : (anoRow as any)?.ano;
      if (Number.isFinite(anoNumero)) targetAno = anoNumero as number;
    }

    if (!targetAno && sessionIdParam) {
      const { data: sessParam } = await admin
        .from('school_sessions')
        .select('id, nome, data_inicio, data_fim')
        .eq('id', sessionIdParam)
        .eq('escola_id', escolaId)
        .limit(1);
      const sessRow = sessParam?.[0] as any;
      if (sessRow) {
        targetLegacySessionId = sessRow.id as string;
        const anoDerived = inferAno(sessRow?.nome, sessRow?.data_inicio, sessRow?.data_fim);
        if (anoDerived !== null) targetAno = anoDerived;
      }
    }

    if (targetAno === null) {
      const { data: anoAtivo } = await admin
        .from('anos_letivos')
        .select('ano')
        .eq('escola_id', escolaId)
        .eq('ativo', true)
        .order('ano', { ascending: false })
        .limit(1);
      const anoResolved = anoAtivo?.[0]?.ano;
      const anoNumber = typeof anoResolved === 'string' ? Number(anoResolved) : anoResolved;
      if (Number.isFinite(anoNumber)) targetAno = anoNumber as number;
    }

    const selectFields = "id, nome, bi_numero, responsavel, telefone_responsavel, status, created_at, profile_id, escola_id, numero_processo, profiles!alunos_profile_id_fkey ( numero_login, email, bi_numero )";

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
        numero_processo: row.numero_processo,
        bi_numero,
        bilhete: bi_numero,
      };
    };

    // Se existe sessão (selecionada ou ativa), coletar alunos com matrícula nesta sessão para excluí-los do resultado
    let alunosComMatriculaAtual: string[] = [];
    if (escolaId && (targetAno !== null || targetLegacySessionId)) {
      try {
        const { data: mats } = await admin
          .from('matriculas')
          .select('aluno_id')
          .eq('escola_id', escolaId)
          .or([
            targetAno !== null ? `ano_letivo.eq.${targetAno}` : null,
            targetLegacySessionId ? `session_id.eq.${targetLegacySessionId}` : null,
          ].filter(Boolean).join(','));
        alunosComMatriculaAtual = (mats ?? [])
          .map((m: any) => m.aluno_id)
          .filter((v: any) => !!v);
      } catch {
        // silencioso
      }
    } else if (escolaId && targetAno === null) {
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
    let alunosComNumero: string[] = [];
    if (escolaId) {
      try {
        const { data: matsComNumero } = await admin
          .from('matriculas')
          .select('aluno_id')
          .eq('escola_id', escolaId)
          .not('numero_matricula', 'is', null);

        alunosComNumero = (matsComNumero ?? [])
          .map((m: any) => m.aluno_id)
          .filter((v: any) => !!v);
      } catch {
        // silencioso
      }
    }

    const alunosMatriculados = Array.from(new Set([...(alunosComMatriculaAtual || []), ...(alunosComNumero || [])]));
    const shouldFilterMatriculados = Boolean(targetAno !== null) && alunosMatriculados.length > 0;

    // Demais status
    // Agora com relacionamento para profiles(numero_login)
    let query = admin
      .from("alunos")
      .select(selectFields, { count: "exact" })
      .order("created_at", { ascending: false })
      .eq("escola_id", escolaId);

    const idsMatriculados = alunosMatriculados.map((id) => `"${id}"`).join(',');

    switch (status) {
      case 'ativo':
        query = query.eq('status', 'ativo').is('deleted_at', null);
        break;

      case 'inativo':
        query = query.eq('status', 'inativo').is('deleted_at', null);
        break;

      case 'pendente':
        query = query.eq('status', 'pendente').is('deleted_at', null);
        break;

      case 'arquivado':
        query = query.not('deleted_at', 'is', null);
        break;
      
      case 'todos':
      default:
        // Por padrão, 'todos' deve incluir tanto alunos ativos quanto arquivados.
        // Nenhuma condição adicional de deleted_at aqui.
        // Quando estiver filtrando por sessão (cadastro de matrícula), ocultamos arquivados.
        if (sessionIdParam) {
          query = query.is('deleted_at', null);
        }
        break;
    }

    const shouldHideMatriculados =
      idsMatriculados &&
      ((shouldFilterMatriculados && status !== 'arquivado') || (!shouldFilterMatriculados && status === 'inativo'));

    if (shouldHideMatriculados) {
      query = query.not('id', 'in', `(${idsMatriculados})`);
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
