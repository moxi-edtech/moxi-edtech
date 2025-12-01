import { NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseServerTyped } from '@/lib/supabaseServer'
import { recordAuditServer } from '@/lib/audit'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import type { Database } from '~types/supabase'
import { resolveMensalidade } from '@/lib/financeiro/pricing'

const Body = z.object({
  promocoes: z.array(z.object({ origem_turma_id: z.string().uuid(), destino_turma_id: z.string().uuid() })).optional(),
  concluir_turmas: z.array(z.object({ origem_turma_id: z.string().uuid() })).optional(),
  gerar_mensalidades: z.boolean().optional(),
  gerar_todas: z.boolean().optional(),
})

// POST /api/secretaria/rematricula/confirmar
// Cria novas matrículas para turmas de destino e atualiza status das antigas.
export async function POST(req: Request) {
  try {
    const supabase = await supabaseServerTyped<any>()
    const { data: userRes } = await supabase.auth.getUser()
    const user = userRes?.user
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    const json = await req.json().catch(() => ({}))
    const parsed = Body.safeParse(json)
    if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues?.[0]?.message || 'Dados inválidos' }, { status: 400 })
    const body = parsed.data

    // Resolve escola
    const { data: prof } = await supabase
      .from('profiles')
      .select('current_escola_id, escola_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
    let escolaId = ((prof?.[0] as any)?.current_escola_id || (prof?.[0] as any)?.escola_id) as string | undefined
    if (!escolaId) {
      const { data: vinc } = await supabase
        .from('escola_usuarios')
        .select('escola_id')
        .eq('user_id', user.id)
        .limit(1)
      escolaId = (vinc?.[0] as any)?.escola_id as string | undefined
    }
    if (!escolaId) return NextResponse.json({ ok: false, error: 'Escola não encontrada' }, { status: 400 })

    // Helper to load turma with session and escola
    async function getTurma(turmaId: string): Promise<{ session_id: string | null; escola_id: string | null } | null> {
      const { data } = await supabase.from('turmas').select('session_id, escola_id').eq('id', turmaId).maybeSingle()
      if (!data) return null
      return { session_id: (data as any)?.session_id ?? null, escola_id: (data as any)?.escola_id ?? null }
    }

    const resultsPromocoes: Array<{ origem_turma_id: string; destino_turma_id: string; inserted: number; skipped: number }> = []

    const gerarMensalidades = Boolean((json as any)?.gerar_mensalidades)
    const gerarTodas = (json as any)?.gerar_todas !== false

    // Preferir RPC quando disponível (transacional e mais escalável)
    const hasAdmin = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
    const admin = hasAdmin ? createAdminClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) : null

    // Process promotions
    if (body.promocoes && body.promocoes.length) {
      for (const p of body.promocoes) {
        if (hasAdmin && admin) {
          const { data, error } = await (admin as any).rpc('rematricula_em_massa', {
            p_escola_id: escolaId,
            p_origem_turma_id: p.origem_turma_id,
            p_destino_turma_id: p.destino_turma_id,
          })
          if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
          const row = Array.isArray(data) ? data[0] : data
          resultsPromocoes.push({ origem_turma_id: p.origem_turma_id, destino_turma_id: p.destino_turma_id, inserted: row?.inserted ?? 0, skipped: row?.skipped ?? 0 })

          // Mensalidades pós-processo (RPC): determinar inseridos comparando antes/depois
          if (gerarMensalidades && (row?.inserted ?? 0) > 0) {
            const { data: dest } = await supabase.from('turmas').select('session_id, classe_id, ano_letivo').eq('id', p.destino_turma_id).maybeSingle()
            const sessionId = (dest as any)?.session_id as string | null
            if (sessionId) {
              const { data: preActive } = await supabase
                .from('matriculas')
                .select('aluno_id')
                .eq('escola_id', escolaId)
                .eq('session_id', sessionId)
                .in('status', ['ativo','ativa','active'])
              const preSet = new Set<string>((preActive || []).map((r:any)=>r.aluno_id))
              const { data: nowActive } = await supabase
                .from('matriculas')
                .select('aluno_id')
                .eq('escola_id', escolaId)
                .eq('turma_id', p.destino_turma_id)
                .eq('session_id', sessionId)
                .in('status', ['ativo','ativa','active'])
              const nowSet = new Set<string>((nowActive || []).map((r:any)=>r.aluno_id))
              const insertedAlunos = Array.from(nowSet).filter(id => !preSet.has(id))
              await generateMensalidadesForAlunos(supabase as any, escolaId, p.destino_turma_id, sessionId, (dest as any)?.ano_letivo ?? null, (dest as any)?.classe_id ?? null, insertedAlunos, gerarTodas)
            }
          }
        } else {
          const dest = await getTurma(p.destino_turma_id)
          if (!dest?.session_id) continue
          if (dest.escola_id !== escolaId) continue
          // alunos ativos na origem
          const { data: mats } = await supabase
            .from('matriculas')
            .select('aluno_id')
            .eq('escola_id', escolaId)
            .eq('turma_id', p.origem_turma_id)
            .in('status', ['ativo', 'ativa', 'active'])
          const alunoIds = (mats || []).map((m: any) => m.aluno_id).filter(Boolean)
          if (alunoIds.length === 0) { resultsPromocoes.push({ origem_turma_id: p.origem_turma_id, destino_turma_id: p.destino_turma_id, inserted: 0, skipped: 0 }); continue }

          // Dedup: excluir quem já tem matrícula ativa na sessão destino
          const { data: existing } = await supabase
            .from('matriculas')
            .select('aluno_id')
            .eq('escola_id', escolaId)
            .eq('session_id', dest.session_id)
            .in('aluno_id', alunoIds)
            .in('status', ['ativo','ativa','active'])
          const already = new Set<string>((existing || []).map((r: any) => r.aluno_id))
          const toInsert = alunoIds.filter((id) => !already.has(id))
          if (toInsert.length > 0) {
            const inserts = toInsert.map((aluno_id: string) => ({
              aluno_id,
              turma_id: p.destino_turma_id,
              session_id: dest.session_id,
              escola_id: escolaId,
              status: 'ativo',
            }))
            const { error: insErr } = await supabase.from('matriculas').insert(inserts as any)
            if (insErr) return NextResponse.json({ ok: false, error: insErr.message }, { status: 400 })

            // Marca antigas como transferido apenas para os inseridos
            await supabase
              .from('matriculas')
              .update({ status: 'transferido' })
              .eq('escola_id', escolaId)
              .eq('turma_id', p.origem_turma_id)
              .in('aluno_id', toInsert)
          }
          // Mensalidades pós-processo
          if (gerarMensalidades && toInsert.length > 0) {
            await generateMensalidadesForAlunos(supabase as any, escolaId, p.destino_turma_id, dest.session_id!, (dest as any)?.ano_letivo ?? null, (dest as any)?.classe_id ?? null, toInsert, gerarTodas)
          }
          resultsPromocoes.push({ origem_turma_id: p.origem_turma_id, destino_turma_id: p.destino_turma_id, inserted: toInsert.length, skipped: alunoIds.length - toInsert.length })
        }
      }
    }

    // Process conclusions for 12ª
    if (body.concluir_turmas && body.concluir_turmas.length) {
      for (const c of body.concluir_turmas) {
        await supabase
          .from('matriculas')
          .update({ status: 'concluido' })
          .eq('escola_id', escolaId)
          .eq('turma_id', c.origem_turma_id)
          .in('status', ['ativo', 'ativa', 'active'])
      }
    }

    const totalInserted = resultsPromocoes.reduce((acc, r) => acc + (r.inserted || 0), 0)
    const totalSkipped = resultsPromocoes.reduce((acc, r) => acc + (r.skipped || 0), 0)

    recordAuditServer({ escolaId, portal: 'secretaria', acao: 'REMATRICULA_CONFIRMAR', entity: 'matriculas', details: { promocoes: body.promocoes?.length ?? 0, concluir_turmas: body.concluir_turmas?.length ?? 0, total_inserted: totalInserted, total_skipped: totalSkipped } }).catch(()=>null)
    return NextResponse.json({ ok: true, results: { promocoes: resultsPromocoes, total_inserted: totalInserted, total_skipped: totalSkipped } })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

async function generateMensalidadesForAlunos(client: any, escolaId: string, turmaId: string, sessionId: string, anoLetivoNome: string | null, classeId: string | null, alunoIds: string[], gerarTodas: boolean) {
  try {
    if (!sessionId || alunoIds.length === 0) return;
    const { data: sess } = await client.from('school_sessions').select('data_inicio, data_fim, nome').eq('id', sessionId).maybeSingle();
    const dataInicioSess = (sess as any)?.data_inicio ? new Date((sess as any).data_inicio) : new Date();
    const dataFimSess = (sess as any)?.data_fim ? new Date((sess as any).data_fim) : new Date(dataInicioSess.getFullYear(), 11, 31);
    const anoLetivo = (anoLetivoNome && String(anoLetivoNome)) || String(dataInicioSess.getFullYear());

    const pricing = await resolveMensalidade(client, escolaId, { classeId: classeId || undefined, cursoId: undefined });
    const valor = pricing?.valor;
    const dia = pricing?.dia_vencimento || 5;
    if (!valor || !Number.isFinite(valor)) return;

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
    console.warn('[rematricula/confirmar] geração de mensalidades falhou:', e)
  }
}
