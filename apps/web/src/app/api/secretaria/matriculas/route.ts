import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { generateNumeroLogin } from "@/lib/generateNumeroLogin";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";
import { resolveMensalidade } from "@/lib/financeiro/pricing";

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
    const body_classe_id: string | undefined = body?.classe_id || undefined;
    const body_curso_id: string | undefined = body?.curso_id || undefined;
    const valor_mensalidade: number | undefined = body?.valor_mensalidade != null ? Number(body.valor_mensalidade) : undefined;
    const dia_vencimento: number | undefined = body?.dia_vencimento != null ? Number(body.dia_vencimento) : undefined;
    const gerar_todas: boolean = body?.gerar_mensalidades_todas ?? true;

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

    // Resolve valor/dia de vencimento a partir da tabela da escola se não informado
    let efetivoValor: number | undefined = valor_mensalidade;
    let efetivoDia: number | undefined = dia_vencimento;
    if ((!efetivoValor || !Number.isFinite(efetivoValor)) || (!efetivoDia || !Number.isFinite(efetivoDia))) {
      try {
        // Deriva curso/classe: preferir body, senão por turma -> cursos_oferta
        let cursoId: string | undefined = body_curso_id;
        let classeId: string | undefined = body_classe_id;
        if (!cursoId) {
          const { data: co } = await supabase
            .from('cursos_oferta')
            .select('curso_id')
            .eq('turma_id', turma_id)
            .limit(1);
          cursoId = (co?.[0] as any)?.curso_id as string | undefined;
        }

        const resolved = await resolveMensalidade(supabase as any, escolaId, { classeId, cursoId });
        if ((!efetivoValor || !Number.isFinite(efetivoValor)) && typeof resolved.valor === 'number') efetivoValor = resolved.valor;
        if ((!efetivoDia || !Number.isFinite(efetivoDia)) && resolved.dia_vencimento) efetivoDia = Number(resolved.dia_vencimento);
      } catch (_) {}
    }

    // Opcional: gerar mensalidades do ano letivo (todas ou apenas a primeira) se há valor/dia
    if (efetivoValor && efetivoDia && Number.isFinite(efetivoValor) && Number.isFinite(efetivoDia)) {
      try {
        const { data: sess } = await supabase
          .from('school_sessions')
          .select('data_inicio, data_fim, nome')
          .eq('id', session_id)
          .maybeSingle();

        const dataInicioSess = (sess as any)?.data_inicio ? new Date((sess as any).data_inicio) : new Date();
        const dataFimSess = (sess as any)?.data_fim ? new Date((sess as any).data_fim) : new Date(dataInicioSess.getFullYear(), 11, 31);
        // Data efetiva da matrícula: fornecida ou agora
        const dataMat = data_matricula ? new Date(data_matricula) : new Date();

        // Ano letivo preferindo nome (se for um ano numérico) senão ano de início
        let anoLetivo = String(dataInicioSess.getFullYear());
        const nomeSess = String(((sess as any)?.nome ?? '')).trim();
        const anoNome = (nomeSess.match(/\b(20\d{2}|19\d{2})\b/) || [])[0];
        if (anoNome) anoLetivo = anoNome;

        const dia = Math.min(Math.max(1, Math.trunc(efetivoDia as number)), 31);

        // Decide de que mês iniciar: o mês da matrícula ou o início da sessão, o que for mais tarde
        const startYear = Math.max(dataInicioSess.getFullYear(), dataMat.getFullYear());
        const startMonthIndex = (() => {
          const s = new Date(dataInicioSess.getFullYear(), dataInicioSess.getMonth(), 1) < new Date(dataMat.getFullYear(), dataMat.getMonth(), 1)
            ? dataMat.getMonth() : dataInicioSess.getMonth();
          return s;
        })();

        const cursor = new Date(startYear, startMonthIndex, 1);
        const limite = gerar_todas ? new Date(dataFimSess.getFullYear(), dataFimSess.getMonth(), 1) : new Date(dataMat.getFullYear(), dataMat.getMonth(), 1);
        const rows: any[] = [];
        let firstRow = true;
        while (cursor <= limite) {
          const ano = cursor.getFullYear();
          const mesIndex = cursor.getMonth();
          const mes = mesIndex + 1; // 1..12
          const lastDay = new Date(ano, mesIndex + 1, 0).getDate();
          const dd = Math.min(dia, lastDay);
          const venc = new Date(ano, mesIndex, dd);

          // Pro-rata no primeiro mês se matrícula ocorrer após o dia de vencimento do mês corrente
          let valor = Number(Number(efetivoValor as number).toFixed(2));
          if (firstRow && ano === dataMat.getFullYear() && mesIndex === dataMat.getMonth() && dataMat.getDate() > dia) {
            const daysInMonth = new Date(ano, mesIndex + 1, 0).getDate();
            const remainingDays = Math.max(0, daysInMonth - dataMat.getDate() + 1);
            const prorata = (valor * remainingDays) / daysInMonth;
            valor = Math.max(0, Math.round(prorata * 100) / 100);
          }

          rows.push({
            escola_id: escolaId,
            aluno_id,
            turma_id,
            ano_letivo: anoLetivo,
            mes_referencia: mes,
            ano_referencia: ano,
            valor_previsto: valor,
            data_vencimento: venc.toISOString().slice(0, 10),
            status: 'pendente',
          });

          firstRow = false;
          // próximo mês
          cursor.setMonth(cursor.getMonth() + 1);
        }

        if (rows.length > 0) {
          const adminUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
          const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
          const client: any = (adminUrl && serviceRole)
            ? createAdminClient<Database>(adminUrl, serviceRole)
            : supabase;
          await client.from('mensalidades').insert(rows as any);
        }
      } catch (mErr) {
        console.warn('[matriculas.create] Falha ao gerar mensalidades:', mErr instanceof Error ? mErr.message : mErr);
      }
    }

    return NextResponse.json({ ok: true, data: newMatricula });

  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
