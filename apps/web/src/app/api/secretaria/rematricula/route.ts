import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";
import { normalizeAnoLetivo, resolveTabelaPreco } from "@/lib/financeiro/tabela-preco";
import { recordAuditServer } from "@/lib/audit";
import { tryCanonicalFetch } from "@/lib/api/proxyCanonical";

export async function POST(req: Request) {
  try {
    const supabase = await supabaseServerTyped<any>();
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 });

    const { data: prof } = await supabase
      .from('profiles')
      .select('escola_id')
      .order('created_at', { ascending: false })
      .limit(1);
    const escolaId = (prof?.[0] as any)?.escola_id as string | undefined;
    if (!escolaId) {
      return NextResponse.json({ ok: false, error: 'Escola não encontrada' }, { status: 400 });
    }

    const forwarded = await tryCanonicalFetch(req, `/api/escolas/${escolaId}/rematricula`);
    if (forwarded) return forwarded;

    const body = await req.json();
    const { origin_turma_id, destination_turma_id, aluno_ids, use_rpc, gerar_mensalidades = false, gerar_todas = true } = body;

    if (!origin_turma_id || !destination_turma_id || !aluno_ids || !aluno_ids.length) {
      return NextResponse.json({ ok: false, error: 'Campos obrigatórios em falta' }, { status: 400 });
    }

    // RPC fast-path (transacional no banco, reusável)
    if (use_rpc && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const admin = createAdminClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
      // Determine session/cls and pre-existing at destino
      const { data: destTurma } = await (admin as any).from('turmas').select('id, session_id, classe_id, ano_letivo').eq('id', destination_turma_id).maybeSingle();
      const sessionId = (destTurma as any)?.session_id as string | null;
      if (!sessionId) return NextResponse.json({ ok: false, error: 'Turma destino sem sessão vinculada' }, { status: 400 });
      const { data: preActive } = await (admin as any)
        .from('matriculas')
        .select('aluno_id')
        .eq('escola_id', escolaId)
        .eq('session_id', sessionId)
        .in('status', ['ativo','ativa','active']);
      const preSet = new Set<string>((preActive || []).map((r: any) => r.aluno_id));

      const { data, error } = await (admin as any).rpc('rematricula_em_massa', {
        p_escola_id: escolaId,
        p_origem_turma_id: origin_turma_id,
        p_destino_turma_id: destination_turma_id,
      });
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
      const row = Array.isArray(data) ? data[0] : data;
      // audit
      recordAuditServer({ escolaId, portal: 'secretaria', acao: 'REMATRICULA_RPC', entity: 'matriculas', details: { origin_turma_id, destination_turma_id, inserted: row?.inserted ?? 0, skipped: row?.skipped ?? 0 } }).catch(()=>null)
      let insertedCount = row?.inserted ?? 0;
      // Pós-processo: gerar mensalidades para os realmente inseridos
      if (gerar_mensalidades && insertedCount > 0) {
        const { data: nowActive } = await (admin as any)
          .from('matriculas')
          .select('aluno_id')
          .eq('escola_id', escolaId)
          .eq('turma_id', destination_turma_id)
          .eq('session_id', sessionId)
          .in('status', ['ativo','ativa','active']);
        const nowSet = new Set<string>((nowActive || []).map((r: any) => r.aluno_id));
        const insertedAlunos = Array.from(nowSet).filter(id => !preSet.has(id));
        await generateMensalidadesForAlunos(admin as any, escolaId, destination_turma_id, sessionId, (destTurma as any)?.ano_letivo ?? null, (destTurma as any)?.classe_id ?? null, insertedAlunos, gerar_todas);
      }
      return NextResponse.json({ ok: true, inserted: insertedCount, skipped: row?.skipped ?? 0, errors: row?.errors ?? [] });
    }

    // Get the destination turma to get the session_id and validate escola
    const { data: destinationTurma } = await supabase
      .from('turmas')
      .select('session_id, escola_id')
      .eq('id', destination_turma_id)
      .single();

    if (!destinationTurma) {
      return NextResponse.json({ ok: false, error: 'Turma de destino não encontrada' }, { status: 400 });
    }
    if ((destinationTurma as any).escola_id !== escolaId) {
      return NextResponse.json({ ok: false, error: 'Turma de destino não pertence à escola atual' }, { status: 403 });
    }
    if (!(destinationTurma as any).session_id) {
      return NextResponse.json({ ok: false, error: 'Turma de destino sem ano letivo vinculado' }, { status: 400 });
    }

    // Validate origin turma belongs to same escola
    const { data: originTurma } = await supabase
      .from('turmas')
      .select('id, escola_id')
      .eq('id', origin_turma_id)
      .single();
    if (!originTurma) return NextResponse.json({ ok: false, error: 'Turma de origem não encontrada' }, { status: 400 });
    if ((originTurma as any).escola_id !== escolaId) return NextResponse.json({ ok: false, error: 'Turma de origem não pertence à escola atual' }, { status: 403 });

    // Deduplicar: não criar se já existe matrícula ativa do aluno na mesma sessão
    const { data: existingRows } = await supabase
      .from('matriculas')
      .select('aluno_id')
      .eq('escola_id', escolaId)
      .eq('session_id', (destinationTurma as any).session_id)
      .in('aluno_id', aluno_ids)
      .in('status', ['ativo','ativa','active']);
    const alreadyActive = new Set<string>((existingRows || []).map((r: any) => r.aluno_id));
    const toInsert = aluno_ids.filter((id: string) => !alreadyActive.has(id));

    let inserted = 0;
    if (toInsert.length > 0) {
      const newMatriculas = toInsert.map((aluno_id: string) => ({
        aluno_id,
        turma_id: destination_turma_id,
        session_id: (destinationTurma as any).session_id,
        escola_id: escolaId,
        status: 'ativo',
      }));
      const { error: insertError } = await supabase.from('matriculas').insert(newMatriculas);
      if (insertError) {
        return NextResponse.json({ ok: false, error: insertError.message }, { status: 400 });
      }
      inserted = toInsert.length;
    }

    // Atualiza status das antigas apenas para os que foram efetivamente rematriculados
    if (inserted > 0) {
      const { error: updateError } = await supabase
        .from('matriculas')
        .update({ status: 'transferido' })
        .eq('turma_id', origin_turma_id)
        .in('aluno_id', toInsert);
      if (updateError) console.error('Failed to update old matriculas', updateError);
    }

    const skipped = aluno_ids.length - inserted;
    // Pós-processo: gerar mensalidades no fallback
    if (gerar_mensalidades && inserted > 0) {
      const { data: dest } = await supabase.from('turmas').select('session_id, ano_letivo, classe_id').eq('id', destination_turma_id).maybeSingle();
      const sessionId = (dest as any)?.session_id as string | null;
      await generateMensalidadesForAlunos(supabase as any, escolaId, destination_turma_id, sessionId!, (dest as any)?.ano_letivo ?? null, (dest as any)?.classe_id ?? null, toInsert, gerar_todas);
    }
    recordAuditServer({ escolaId, portal: 'secretaria', acao: 'REMATRICULA_APP', entity: 'matriculas', details: { origin_turma_id, destination_turma_id, inserted, skipped } }).catch(()=>null)
    return NextResponse.json({ ok: true, inserted, skipped });

  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

async function resolveMensalidadeAtual(
  client: any,
  escolaId: string,
  turmaId: string,
  anoLetivoNome: string | null,
  classeIdHint: string | null,
) {
  let cursoId: string | null = null;
  let classeId = classeIdHint || null;
  let anoLetivo = normalizeAnoLetivo(anoLetivoNome ?? new Date().getFullYear());

  try {
    const { data: turmaView } = await client
      .from('vw_turmas_para_matricula')
      .select('curso_id, classe_id, ano_letivo')
      .eq('id', turmaId)
      .maybeSingle();

    if (turmaView) {
      const t = turmaView as any;
      if (t.curso_id) cursoId = t.curso_id as string;
      if (t.classe_id) classeId = t.classe_id as string;
      if (t.ano_letivo) anoLetivo = normalizeAnoLetivo(t.ano_letivo);
    }
  } catch {}

  if (cursoId) {
    try {
      const { data: realCurso } = await client
        .from('vw_cursos_reais')
        .select('id')
        .eq('escola_id', escolaId)
        .eq('id', cursoId)
        .maybeSingle();
      if (!realCurso) cursoId = null;
    } catch {}
  }

  const { tabela } = await resolveTabelaPreco(client, {
    escolaId,
    anoLetivo,
    cursoId: cursoId || undefined,
    classeId: classeId || undefined,
    allowMensalidadeFallback: false,
  });

  if (!tabela) return null;

  return {
    valor: tabela.valor_mensalidade,
    dia_vencimento: tabela.dia_vencimento,
  };
}

async function generateMensalidadesForAlunos(client: any, escolaId: string, turmaId: string, sessionId: string, anoLetivoNome: string | null, classeId: string | null, alunoIds: string[], gerarTodas: boolean) {
  try {
    if (!sessionId || alunoIds.length === 0) return;
    const { data: sess } = await client.from('school_sessions').select('data_inicio, data_fim, nome').eq('id', sessionId).maybeSingle();
    const dataInicioSess = (sess as any)?.data_inicio ? new Date((sess as any).data_inicio) : new Date();
    const dataFimSess = (sess as any)?.data_fim ? new Date((sess as any).data_fim) : new Date(dataInicioSess.getFullYear(), 11, 31);
    const anoLetivoNum = normalizeAnoLetivo(anoLetivoNome ?? dataInicioSess.getFullYear());
    const anoLetivo = String(anoLetivoNum);

    const pricing = await resolveMensalidadeAtual(client, escolaId, turmaId, anoLetivoNome, classeId);
    const valor = pricing?.valor;
    const dia = pricing?.dia_vencimento || 5;
    if (valor == null || !Number.isFinite(valor)) return;

    const today = new Date();
    const startMonth = gerarTodas ? dataInicioSess : new Date(today.getFullYear(), today.getMonth(), 1);
    const endMonth = new Date(dataFimSess.getFullYear(), dataFimSess.getMonth(), 1);

    const rows: any[] = [];
    const cursor = new Date(startMonth.getFullYear(), startMonth.getMonth(), 1);
    let firstLoop = true;
    while (cursor <= endMonth) {
      const ano = cursor.getFullYear();
      const mesIndex = cursor.getMonth();
      const mes = mesIndex + 1;
      const lastDay = new Date(ano, mesIndex + 1, 0).getDate();
      const dd = Math.min(dia, lastDay);
      const venc = new Date(ano, mesIndex, dd);

      let valorMes = Number(Number(valor).toFixed(2));
      if (firstLoop && !gerarTodas) {
        // pró-rata se já passou o dia nesse mês corrente
        if (today.getFullYear() === ano && today.getMonth() === mesIndex && today.getDate() > dia) {
          const daysInMonth = new Date(ano, mesIndex + 1, 0).getDate();
          const remainingDays = Math.max(0, daysInMonth - today.getDate() + 1);
          const prorata = (valorMes * remainingDays) / daysInMonth;
          valorMes = Math.max(0, Math.round(prorata * 100) / 100);
        }
      }

      for (const alunoId of alunoIds) {
        rows.push({
          escola_id: escolaId,
          aluno_id: alunoId,
          turma_id: turmaId,
          ano_letivo: anoLetivo,
          mes_referencia: mes,
          ano_referencia: ano,
          valor_previsto: valorMes,
          data_vencimento: venc.toISOString().slice(0, 10),
          status: 'pendente',
        });
      }

      firstLoop = false;
      cursor.setMonth(cursor.getMonth() + 1);
    }

    if (rows.length > 0) {
      for (let i=0; i<rows.length; i+=1000) {
        await client.from('mensalidades').insert(rows.slice(i, i+1000) as any);
      }
    }
  } catch (e) {
    console.warn('[rematricula] geração de mensalidades falhou:', e);
  }
}
