import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { generateNumeroLogin } from "@/lib/generateNumeroLogin";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const q = url.searchParams.get('q')?.trim() || '';
    const days = url.searchParams.get('days') || '30';
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize') || '20', 10) || 20));
    const turmaIdFilter = url.searchParams.get('turma_id') || '';
    const offset = (page - 1) * pageSize;

    const supabase = await supabaseServerTyped<any>();
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 });

    const { data: prof } = await supabase
      .from('profiles')
      .select('current_escola_id, escola_id, user_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1);
    let escolaId = ((prof?.[0] as any)?.current_escola_id || (prof?.[0] as any)?.escola_id) as string | undefined;
    if (!escolaId) {
      try {
        const { data: vinc } = await supabase
          .from('escola_usuarios')
          .select('escola_id')
          .eq('user_id', user.id)
          .limit(1);
        escolaId = (vinc?.[0] as any)?.escola_id as string | undefined;
      } catch {}
    }
    if (!escolaId) return NextResponse.json({ ok: true, items: [], total: 0, page, pageSize });

    const since = (() => {
      const d = parseInt(days || '30', 10);
      if (!Number.isFinite(d) || d <= 0) return '1970-01-01';
      const dt = new Date(); dt.setDate(dt.getDate() - d); return dt.toISOString();
    })();

    // Busca matrículas incluindo dados úteis para exibição: número, aluno.nome e turma.nome
    let query = supabase
      .from('matriculas')
      .select('id, numero_matricula, aluno_id, turma_id, status, created_at, alunos ( nome ), turmas ( nome )', { count: 'exact' })
      .eq('escola_id', escolaId)
      .gte('created_at', since)
      .order('created_at', { ascending: false });

    if (turmaIdFilter) {
      query = query.eq('turma_id', turmaIdFilter);
    }

    if (q) {
      const uuidRe = /^[0-9a-fA-F-]{36}$/;
      if (uuidRe.test(q)) {
        query = query.or(`id.eq.${q},aluno_id.eq.${q},turma_id.eq.${q}`);
      } else {
        query = query.or(`status.ilike.%${q}%`);
      }
    }

    const { data, error, count } = await query.range(offset, offset + pageSize - 1);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    // Normaliza/achata os dados para o cliente
    const items = (data || []).map((row: any) => ({
      id: row.id,
      numero_matricula: row.numero_matricula ?? null,
      aluno_id: row.aluno_id,
      turma_id: row.turma_id,
      aluno_nome: row.alunos?.nome ?? null,
      turma_nome: row.turmas?.nome ?? null,
      status: row.status,
      created_at: row.created_at,
    }));

    return NextResponse.json({ ok: true, items, total: count ?? 0, page, pageSize });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await supabaseServerTyped<any>();
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 });

    const body = await req.json();
    const { aluno_id, session_id, turma_id, numero_matricula, data_matricula } = body;

    // Resolve escola a partir do aluno, com fallback ao perfil do usuário
    let escolaId: string | undefined = undefined;
    if (aluno_id) {
      try {
        const { data: aluno } = await supabase
          .from('alunos')
          .select('escola_id')
          .eq('id', aluno_id)
          .maybeSingle();
        escolaId = (aluno as any)?.escola_id as string | undefined;
      } catch {}
    }
    if (!escolaId) {
      const { data: prof } = await supabase
        .from('profiles')
        .select('current_escola_id, escola_id, user_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);
      escolaId = ((prof?.[0] as any)?.current_escola_id || (prof?.[0] as any)?.escola_id) as string | undefined;
      if (!escolaId) {
        try {
          const { data: vinc } = await supabase
            .from('escola_usuarios')
            .select('escola_id')
            .eq('user_id', user.id)
            .limit(1);
          escolaId = (vinc?.[0] as any)?.escola_id as string | undefined;
        } catch {}
      }
    }
    if (!escolaId) {
      return NextResponse.json({ ok: false, error: 'Escola não encontrada' }, { status: 400 });
    }

    if (!aluno_id || !session_id || !turma_id) {
      return NextResponse.json({ ok: false, error: 'Campos obrigatórios em falta' }, { status: 400 });
    }

    // Gerar numero de matrícula a partir da função padronizada
    let numeroGerado: string | null = null;
    try {
      if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
        const admin = createAdminClient<Database>(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
        numeroGerado = await generateNumeroLogin(escolaId, 'aluno' as any, admin as any);
      } else {
        numeroGerado = await generateNumeroLogin(escolaId, 'aluno' as any, supabase as any);
      }
    } catch {
      numeroGerado = null;
    }

    const { data: newMatricula, error } = await supabase
      .from('matriculas')
      .insert({
        aluno_id,
        session_id,
        turma_id,
        numero_matricula: numeroGerado || numero_matricula || null,
        data_matricula: data_matricula || null,
        escola_id: escolaId,
        status: 'ativo',
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, data: newMatricula });

  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
