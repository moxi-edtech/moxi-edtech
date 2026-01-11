import { applyKf2, kf2Range } from "@/lib/db/kf2";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { Database } from "~types/supabase";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

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
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ ok: false, error: "Server misconfigured" }, { status: 500 });
    }

    const supabase = createClient<Database>(supabaseUrl, serviceKey);

    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes.user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }
    const user = userRes.user;

    const escolaId = await resolveEscolaIdForUser(supabase, user.id);
    if (!escolaId) {
      return NextResponse.json({ ok: false, error: "Usuário não vinculado a nenhuma escola" }, { status: 403 });
    }

    const url = new URL(req.url);
    const q = url.searchParams.get("q")?.trim() || "";
    const status = (url.searchParams.get("status") || 'ativo').toLowerCase();
    const sessionIdParam = url.searchParams.get("session_id")?.trim() || undefined;
    const anoParamRaw = url.searchParams.get("ano") || url.searchParams.get("ano_letivo");
    const anoParam = anoParamRaw ? Number(anoParamRaw) : null;
    const anoFromQuery = Number.isFinite(anoParam) ? (anoParam as number) : null;

    const limitParam = url.searchParams.get("limit");
    const offsetParam = url.searchParams.get("offset");
    const { limit, offset, from } = kf2Range(
      limitParam ? Number(limitParam) : undefined,
      offsetParam ? Number(offsetParam) : undefined
    );

    let targetAno: number | null = anoFromQuery;
    if (targetAno === null && sessionIdParam) {
      const { data: anoAtivo } = await supabase
        .from('anos_letivos')
        .select('ano')
        .eq('id', sessionIdParam)
        .eq('escola_id', escolaId)
        .maybeSingle();
      targetAno = (anoAtivo as any)?.ano ?? null;
    }
    if (targetAno === null) {
      const { data: anoAtivo } = await supabase
        .from('anos_letivos')
        .select('ano')
        .eq('escola_id', escolaId)
        .eq('ativo', true)
        .order('ano', { ascending: false })
        .limit(1)
        .single();
      targetAno = anoAtivo?.ano ?? new Date().getFullYear();
    }

    const mapAlunoRow = (row: any) => {
      const profile = row.profiles;
      const numero_login = profile?.numero_login ?? null;
      const email = profile?.email ?? null;
      const bi_numero = row.bi_numero ?? profile?.bi_numero ?? null;

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

    const matriculaStatusAtivos = ['ativa', 'ativo', 'active'];
    let alunosComMatriculaAtual: string[] = [];
    if (escolaId && targetAno) {
      const { data: mats } = await supabase
        .from('matriculas')
        .select('aluno_id')
        .eq('escola_id', escolaId)
        .eq('ano_letivo', targetAno)
        .in('status', matriculaStatusAtivos);
      alunosComMatriculaAtual = (mats ?? []).map((m: any) => m.aluno_id).filter(Boolean);
    }

    const candidaturaStatus = ["pendente", "aguardando_pagamento"];
    if (status === 'pendente') {
      let query = supabase
        .from("candidaturas")
        .select(
          `id, aluno_id, status, created_at, nome_candidato, dados_candidato,
           alunos:aluno_id ( id, nome, nome_completo, numero_processo, bi_numero, email, telefone_responsavel, responsavel )`,
          { count: "exact" }
        )
        .eq("escola_id", escolaId)
        .in("status", candidaturaStatus)
        .not('aluno_id', 'in', `(${alunosComMatriculaAtual.map(id => `"${id}"`).join(',')})`);

      if (q) {
        query = query.ilike("nome_candidato", `%${q}%`);
      }

      const { data, error, count } = await applyKf2(query, { limit, offset, order: [{ column: 'created_at', ascending: false }] });
      if (error) throw error;

      const items = (data ?? []).map((row: any) => {
        // Mapping logic from original file
        return {
            id: row.id,
            candidatura_id: row.id,
            aluno_id: row.aluno_id,
            nome: row.nome_candidato || "",
            email: row.dados_candidato?.email || null,
            responsavel: row.dados_candidato?.responsavel_nome || null,
            telefone_responsavel: row.dados_candidato?.responsavel_contato || null,
            status: row.status || 'pendente',
            created_at: row.created_at,
            numero_login: null,
            numero_processo: row.dados_candidato?.numero_processo || null,
            bi_numero: row.dados_candidato?.bi_numero ?? null,
            bilhete: row.dados_candidato?.bi_numero ?? null,
            origem: 'candidatura',
          };
      });

      const hasMore = (count ?? 0) > from + items.length;
      const nextOffset = hasMore ? from + items.length : null;

      return NextResponse.json({
        ok: true,
        data: items,
        page: { limit, offset: from, nextOffset, hasMore, total: count ?? 0 },
      });
    }

    let query = supabase
      .from("alunos")
      .select("*, profiles!alunos_profile_id_fkey(numero_login, email, bi_numero)", { count: "exact" })
      .eq("escola_id", escolaId);

    switch (status) {
      case 'ativo':
        query = query.is('deleted_at', null).in('id', alunosComMatriculaAtual);
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
    }

    if (q) {
      const orParts = [
        `nome.ilike.%${q}%`,
        `responsavel.ilike.%${q}%`,
        `profiles.numero_login.ilike.%${q}%`,
        `profiles.email.ilike.%${q}%`,
      ];
      query = query.or(orParts.join(","), { foreignTable: "profiles" });
    }

    const { data, error, count } = await applyKf2(query, { limit, offset });
    if (error) throw error;

    const items = (data ?? []).map((row) => ({
      ...mapAlunoRow(row),
      origem: 'aluno',
    }));

    const hasMore = (count ?? 0) > from + items.length;
    const nextOffset = hasMore ? from + items.length : null;

    return NextResponse.json({
      ok: true,
      data: items,
      page: { limit, offset: from, nextOffset, hasMore, total: count ?? 0 },
    });
  } catch (e: any) {
    console.error("[alunos list error]", e);
    return NextResponse.json({ ok: false, error: e.message || "Erro desconhecido" }, { status: 500 });
  }
}