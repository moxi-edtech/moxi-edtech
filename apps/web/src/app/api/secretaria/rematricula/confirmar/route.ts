import { NextResponse } from 'next/server'
import { z } from 'zod'
import { authorizeEscolaAction } from '@/lib/escola/disciplinas'
import { supabaseServerTyped } from '@/lib/supabaseServer'
import { recordAuditServer } from '@/lib/audit'
import { normalizeAnoLetivo, resolveTabelaPreco } from '@/lib/financeiro/tabela-preco'
import { tryCanonicalFetch } from '@/lib/api/proxyCanonical'
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser'
import { ACTIVE_MATRICULA_STATUSES } from '@/lib/matriculas/status'

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
    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id)
    if (!escolaId) return NextResponse.json({ ok: false, error: 'Escola não encontrada' }, { status: 400 })
    const authz = await authorizeEscolaAction(supabase as any, escolaId, user.id, ["criar_matricula", "configurar_escola"])
    if (!authz.allowed) return NextResponse.json({ ok: false, error: authz.reason || 'Sem permissão' }, { status: 403 })

    const forwarded = await tryCanonicalFetch(req, `/api/escolas/${escolaId}/rematricula/confirmar`)
    if (forwarded) return forwarded

    type BlockedItem = {
      aluno_id?: string | null;
      matricula_id?: string | null;
      motivos?: string[];
      aluno_nome?: string | null;
      divida_total?: number;
      mensalidades_pendentes?: number;
    }
    type InsertedItem = { aluno_id?: string | null; matricula_id?: string | null; aluno_nome?: string | null }
    const resultsPromocoes: Array<{ origem_turma_id: string; destino_turma_id: string; inserted: number; skipped: number; blocked: BlockedItem[] }> = []

    const gerarMensalidades = Boolean((json as any)?.gerar_mensalidades)
    const gerarTodas = (json as any)?.gerar_todas !== false

    // Preferir RPC quando disponível (transacional e mais escalável)

    // Process promotions
    if (body.promocoes && body.promocoes.length) {
      for (const p of body.promocoes) {
        {
          const { data, error } = await (supabase as any).rpc('rematricula_em_massa', {
            p_escola_id: escolaId,
            p_origem_turma_id: p.origem_turma_id,
            p_destino_turma_id: p.destino_turma_id,
          })
          if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
          const row = Array.isArray(data) ? data[0] : data
          const insertedList = (Array.isArray(row?.inserted) ? row.inserted : []) as InsertedItem[]
          const skippedList = (Array.isArray(row?.skipped) ? row.skipped : []) as BlockedItem[]
          const blockedAlunoIds = Array.from(new Set(skippedList.map((item) => item?.aluno_id).filter(Boolean))) as string[]
          let alunoNomeById = new Map<string, string>()
          if (blockedAlunoIds.length > 0) {
            const { data: alunos } = await supabase
              .from('alunos')
              .select('id, nome')
              .eq('escola_id', escolaId)
              .in('id', blockedAlunoIds)
            alunoNomeById = new Map((alunos || []).map((a: any) => [a.id, a.nome]))
          }
          const blockedEnriched = await enrichBlockedWithDebt(supabase, escolaId, skippedList, alunoNomeById)
          resultsPromocoes.push({
            origem_turma_id: p.origem_turma_id,
            destino_turma_id: p.destino_turma_id,
            inserted: insertedList.length,
            skipped: skippedList.length,
            blocked: blockedEnriched,
          })

          // Mensalidades pós-processo (RPC): determinar inseridos comparando antes/depois
          if (gerarMensalidades && insertedList.length > 0) {
            const { data: dest } = await supabase.from('turmas').select('session_id, classe_id, ano_letivo').eq('id', p.destino_turma_id).maybeSingle()
            const sessionId = (dest as any)?.session_id as string | null
            if (sessionId) {
              const insertedAlunos = insertedList.map((item: any) => item?.aluno_id).filter(Boolean)
              if (insertedAlunos.length > 0) {
                await generateMensalidadesForAlunos(
                  supabase as any,
                  escolaId,
                  p.destino_turma_id,
                  sessionId,
                  (dest as any)?.ano_letivo ?? null,
                  (dest as any)?.classe_id ?? null,
                  insertedAlunos,
                  gerarTodas
                )
              }
            }
          }
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
                .in('status', ACTIVE_MATRICULA_STATUSES)
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

async function enrichBlockedWithDebt(
  supabase: any,
  escolaId: string,
  blocked: Array<{ aluno_id?: string | null; matricula_id?: string | null; motivos?: string[] }>,
  alunoNomeById: Map<string, string>,
) {
  const matriculaIds = blocked.map((item) => item.matricula_id).filter(Boolean) as string[];
  const { data: rows } = matriculaIds.length
    ? await supabase
        .from('mensalidades')
        .select('matricula_id, valor_previsto, valor, valor_pago_total, status')
        .eq('escola_id', escolaId)
        .in('matricula_id', matriculaIds)
    : { data: [] };
  const debtByMatricula = new Map<string, { total: number; count: number }>();
  for (const row of rows ?? []) {
    const balance = Math.max(Number(row.valor_previsto ?? row.valor ?? 0) - Number(row.valor_pago_total ?? 0), 0);
    if (balance <= 0 || ['pago', 'isento', 'cancelado'].includes(String(row.status ?? '').toLowerCase())) continue;
    const current = debtByMatricula.get(row.matricula_id) ?? { total: 0, count: 0 };
    debtByMatricula.set(row.matricula_id, { total: current.total + balance, count: current.count + 1 });
  }
  return blocked.map((item) => {
    const debt = item.matricula_id ? debtByMatricula.get(item.matricula_id) : null;
    return {
      ...item,
      aluno_nome: item.aluno_id ? (alunoNomeById.get(item.aluno_id) ?? null) : null,
      divida_total: debt?.total ?? 0,
      mensalidades_pendentes: debt?.count ?? 0,
    };
  });
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
    tabela_id: tabela.id,
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

    const [{ data: matriculas }, { data: turma }] = await Promise.all([
      client.from('matriculas').select('id, aluno_id, data_inicio_financeiro, data_matricula, created_at')
        .eq('escola_id', escolaId).eq('turma_id', turmaId).eq('ano_letivo', anoLetivoNum)
        .in('aluno_id', alunoIds).in('status', ['ativo', 'ativa', 'active']),
      client.from('turmas').select('is_classe_exame, classe_num, nome').eq('id', turmaId).maybeSingle(),
    ]);
    if (!matriculas || matriculas.length === 0) return;
    const turmaNome = String((turma as any)?.nome ?? '');
    const isClasseExame = Boolean((turma as any)?.is_classe_exame)
      || [6, 9].includes(Number((turma as any)?.classe_num))
      || /\b(6|9)(ª|a)?\s*classe\b/i.test(turmaNome);
    const mesFinal = new Date(dataFimSess.getFullYear(), dataFimSess.getMonth(), 1);

    const pricing = await resolveMensalidadeAtual(client, escolaId, turmaId, anoLetivoNome, classeId);
    const valor = pricing?.valor;
    const dia = pricing?.dia_vencimento || 5;
    const tabelaId = pricing?.tabela_id ?? null;
    if (valor == null || !Number.isFinite(valor)) return;

    const today = new Date();
    const rows: any[] = [];
    for (const matricula of matriculas as any[]) {
      const enrollmentDate = new Date(matricula.data_inicio_financeiro || matricula.data_matricula || matricula.created_at || dataInicioSess);
      const baseStart = new Date(Math.max(dataInicioSess.getTime(), enrollmentDate.getTime()));
      const startMonth = gerarTodas ? new Date(baseStart.getFullYear(), baseStart.getMonth(), 1) : new Date(Math.max(baseStart.getTime(), new Date(today.getFullYear(), today.getMonth(), 1).getTime()));
      const cursor = new Date(startMonth.getFullYear(), startMonth.getMonth(), 1);
      let firstLoop = true;
      while (cursor <= mesFinal) {
        if (!isClasseExame && cursor.getTime() === mesFinal.getTime()) break;
        const ano = cursor.getFullYear();
        const mesIndex = cursor.getMonth();
        const mes = mesIndex + 1;
        const lastDay = new Date(ano, mesIndex + 1, 0).getDate();
        const dd = Math.min(dia, lastDay);
        const venc = new Date(ano, mesIndex, dd);
        let valorMes = Number(Number(valor).toFixed(2));
        if (firstLoop && !gerarTodas && today.getFullYear() === ano && today.getMonth() === mesIndex && today.getDate() > dia) {
          const daysInMonth = new Date(ano, mesIndex + 1, 0).getDate();
          const remainingDays = Math.max(0, daysInMonth - today.getDate() + 1);
          valorMes = Math.max(0, Math.round(((valorMes * remainingDays) / daysInMonth) * 100) / 100);
        }
        rows.push({
          escola_id: escolaId,
          aluno_id: matricula.aluno_id,
          matricula_id: matricula.id,
          turma_id: turmaId,
          ano_letivo: anoLetivo,
          mes_referencia: mes,
          ano_referencia: ano,
          valor_previsto: valorMes,
          data_vencimento: venc.toISOString().slice(0, 10),
          status: 'pendente',
          tabela_id: tabelaId,
        });
        firstLoop = false;
        cursor.setMonth(cursor.getMonth() + 1);
      }
    }

    if (rows.length > 0) {
      for (let i=0; i<rows.length; i+=1000) {
        const { error } = await client.from('mensalidades').insert(rows.slice(i, i+1000) as any);
        if (error) throw error;
      }
    }
  } catch (e) {
    console.warn('[rematricula/confirmar] geração de mensalidades falhou:', e)
  }
}
