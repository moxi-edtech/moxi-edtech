import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { normalizeAnoLetivo, resolveTabelaPreco } from "@/lib/financeiro/tabela-preco";
import { recordAuditServer } from "@/lib/audit";
import { tryCanonicalFetch } from "@/lib/api/proxyCanonical";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { dispatchAlunoNotificacao } from "@/lib/notificacoes/dispatchAlunoNotificacao";
import { PayloadLimitError, readJsonWithLimit } from "@/lib/http/readJsonWithLimit";
import type { Database } from "~types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

const REMATRICULA_MAX_JSON_BYTES = 128 * 1024; // 128KB
const RematriculaBodySchema = z.object({
  origin_turma_id: z.string().uuid(),
  destination_turma_id: z.string().uuid(),
  aluno_ids: z.array(z.string().uuid()).min(1),
  use_rpc: z.boolean().optional(),
  gerar_mensalidades: z.boolean().optional(),
  gerar_todas: z.boolean().optional(),
});
type TurmaSessionRow = { session_id: string | null; escola_id: string | null };
type TurmaEscolaRow = { escola_id: string | null };
type TurmaMetaRow = { id: string; session_id: string | null; classe_id: string | null; ano_letivo: string | null };
type MatriculaAlunoRow = { aluno_id: string | null };
type AlunoNomeRow = { id: string; nome: string | null };
type MensalidadeInsert = Database["public"]["Tables"]["mensalidades"]["Insert"];
type DbClient = SupabaseClient<Database>;

export async function POST(req: Request) {
  try {
    const supabase = await supabaseServerTyped<Database>();
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 });

    const escolaId = await resolveEscolaIdForUser(supabase, user.id);
    if (!escolaId) {
      return NextResponse.json({ ok: false, error: 'Escola não encontrada' }, { status: 400 });
    }

    const forwarded = await tryCanonicalFetch(req, `/api/escolas/${escolaId}/rematricula`);
    if (forwarded) return forwarded;

    const rawBody = await readJsonWithLimit(req, {
      maxBytes: REMATRICULA_MAX_JSON_BYTES,
    });
    const parsedBody = RematriculaBodySchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return NextResponse.json({ ok: false, error: parsedBody.error.issues[0]?.message ?? "Payload inválido" }, { status: 400 });
    }
    const {
      origin_turma_id,
      destination_turma_id,
      aluno_ids,
      use_rpc,
      gerar_mensalidades = false,
      gerar_todas = true,
    } = parsedBody.data;

    // RPC fast-path (transacional no banco, reusável)
    if (use_rpc) {
      // Determine session/cls and pre-existing at destino
      const { data: destTurma } = await supabase
        .from('turmas')
        .select('id, session_id, classe_id, ano_letivo')
        .eq('id', destination_turma_id)
        .order('created_at', { ascending: false })
        .limit(1);
      const turmaDestino = (destTurma?.[0] as TurmaMetaRow | undefined) ?? null;
      const sessionId = turmaDestino?.session_id ?? null;
      if (!sessionId) return NextResponse.json({ ok: false, error: 'Turma destino sem sessão vinculada' }, { status: 400 });
      const { data: preActive } = await supabase
        .from('matriculas')
        .select('aluno_id')
        .eq('escola_id', escolaId)
        .eq('session_id', sessionId)
        .in('status', ['ativo','ativa','active']);
      const preSet = new Set<string>((preActive as MatriculaAlunoRow[] | null | undefined || []).map((r) => r.aluno_id).filter(Boolean) as string[]);

      const { data, error } = await supabase.rpc('rematricula_em_massa', {
        p_escola_id: escolaId,
        p_origem_turma_id: origin_turma_id,
        p_destino_turma_id: destination_turma_id,
      });
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
      const row = Array.isArray(data) ? data[0] : data;
      type BlockedItem = { aluno_id?: string | null; matricula_id?: string | null; motivos?: string[]; aluno_nome?: string | null };
      type InsertedItem = { aluno_id?: string | null; matricula_id?: string | null };
      const insertedList = (Array.isArray(row?.inserted) ? row.inserted : []) as InsertedItem[];
      const skippedList = (Array.isArray(row?.skipped) ? row.skipped : []) as BlockedItem[];
      const blockedAlunoIds = Array.from(new Set(skippedList.map((item) => item?.aluno_id).filter(Boolean))) as string[];
      let alunoNomeById = new Map<string, string>();
      if (blockedAlunoIds.length > 0) {
        const { data: alunos } = await supabase
          .from('alunos')
          .select('id, nome')
          .eq('escola_id', escolaId)
          .in('id', blockedAlunoIds);
        alunoNomeById = new Map((alunos as AlunoNomeRow[] | null | undefined || []).map((a) => [a.id, a.nome ?? ""]));
      }
      const blockedEnriched: BlockedItem[] = skippedList.map((item) => ({
        ...item,
        aluno_nome: item?.aluno_id ? (alunoNomeById.get(item.aluno_id) ?? null) : null,
      }));
      // audit
      recordAuditServer({ escolaId, portal: 'secretaria', acao: 'REMATRICULA_RPC', entity: 'matriculas', details: { origin_turma_id, destination_turma_id, inserted: row?.inserted ?? 0, skipped: row?.skipped ?? 0 } }).catch(()=>null)
      const insertedCount = insertedList.length;
      // Pós-processo: gerar mensalidades para os realmente inseridos
      if (gerar_mensalidades && insertedCount > 0) {
        const { data: nowActive } = await supabase
          .from('matriculas')
          .select('aluno_id')
          .eq('escola_id', escolaId)
          .eq('turma_id', destination_turma_id)
          .eq('session_id', sessionId)
          .in('status', ['ativo','ativa','active']);
        const nowSet = new Set<string>((nowActive as MatriculaAlunoRow[] | null | undefined || []).map((r) => r.aluno_id).filter(Boolean) as string[]);
        const insertedAlunos = Array.from(nowSet).filter(id => !preSet.has(id));
        await generateMensalidadesForAlunos(supabase, escolaId, destination_turma_id, sessionId, turmaDestino?.ano_letivo ?? null, turmaDestino?.classe_id ?? null, insertedAlunos, gerar_todas);
      }

      if (insertedList.length > 0) {
        const insertedAlunoIds = insertedList.map((item) => item.aluno_id).filter(Boolean) as string[];
        await dispatchAlunoNotificacao({
          escolaId,
          key: "RENOVACAO_DISPONIVEL",
          alunoIds: insertedAlunoIds,
          params: { actionUrl: "/aluno/renovacao" },
          actorId: user.id,
          actorRole: "secretaria",
          agrupamentoTTLHoras: 24,
        });
      }
      return NextResponse.json({
        ok: true,
        inserted: insertedCount,
        skipped: skippedList.length,
        blocked: blockedEnriched,
        errors: row?.errors ?? [],
      });
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
    const destinationTurmaRow = destinationTurma as TurmaSessionRow | null;
    if (destinationTurmaRow?.escola_id !== escolaId) {
      return NextResponse.json({ ok: false, error: 'Turma de destino não pertence à escola atual' }, { status: 403 });
    }
    if (!destinationTurmaRow?.session_id) {
      return NextResponse.json({ ok: false, error: 'Turma de destino sem ano letivo vinculado' }, { status: 400 });
    }

    // Validate origin turma belongs to same escola
    const { data: originTurma } = await supabase
      .from('turmas')
      .select('id, escola_id')
      .eq('id', origin_turma_id)
      .single();
    if (!originTurma) return NextResponse.json({ ok: false, error: 'Turma de origem não encontrada' }, { status: 400 });
    const originTurmaRow = originTurma as TurmaEscolaRow | null;
    if (originTurmaRow?.escola_id !== escolaId) return NextResponse.json({ ok: false, error: 'Turma de origem não pertence à escola atual' }, { status: 403 });

    // Deduplicar: não criar se já existe matrícula ativa do aluno na mesma sessão
    const { data: existingRows } = await supabase
      .from('matriculas')
      .select('aluno_id')
      .eq('escola_id', escolaId)
      .eq('session_id', destinationTurmaRow.session_id)
      .in('aluno_id', aluno_ids)
      .in('status', ['ativo','ativa','active']);
    const alreadyActive = new Set<string>((existingRows as MatriculaAlunoRow[] | null | undefined || []).map((r) => r.aluno_id).filter(Boolean) as string[]);
    const toInsert = aluno_ids.filter((id) => !alreadyActive.has(id));

    let inserted = 0;
    if (toInsert.length > 0) {
      const newMatriculas = toInsert.map((aluno_id) => ({
        aluno_id,
        turma_id: destination_turma_id,
        session_id: destinationTurmaRow.session_id,
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
      const sessionId = dest?.session_id ?? null;
      await generateMensalidadesForAlunos(
        supabase,
        escolaId,
        destination_turma_id,
        sessionId!,
        dest?.ano_letivo !== null && dest?.ano_letivo !== undefined ? String(dest.ano_letivo) : null,
        dest?.classe_id ?? null,
        toInsert,
        gerar_todas
      );
    }
    if (inserted > 0) {
      await dispatchAlunoNotificacao({
        escolaId,
        key: "RENOVACAO_DISPONIVEL",
        alunoIds: toInsert,
        params: { actionUrl: "/aluno/renovacao" },
        actorId: user.id,
        actorRole: "secretaria",
        agrupamentoTTLHoras: 24,
      });
    }
    recordAuditServer({ escolaId, portal: 'secretaria', acao: 'REMATRICULA_APP', entity: 'matriculas', details: { origin_turma_id, destination_turma_id, inserted, skipped } }).catch(()=>null)
    return NextResponse.json({ ok: true, inserted, skipped });

  } catch (e) {
    if (e instanceof PayloadLimitError) {
      return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    }
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

async function resolveMensalidadeAtual(
  client: DbClient,
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
      const t = turmaView as { curso_id?: string | null; classe_id?: string | null; ano_letivo?: string | null };
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

async function generateMensalidadesForAlunos(client: DbClient, escolaId: string, turmaId: string, sessionId: string, anoLetivoNome: string | null, classeId: string | null, alunoIds: string[], gerarTodas: boolean) {
  try {
    if (!sessionId || alunoIds.length === 0) return;
    const { data: sess } = await client
      .from('school_sessions' as never)
      .select('data_inicio, data_fim, nome')
      .eq('id', sessionId)
      .maybeSingle();
    const sessRow = sess as { data_inicio?: string | null; data_fim?: string | null } | null;
    const dataInicioSess = sessRow?.data_inicio ? new Date(sessRow.data_inicio) : new Date();
    const dataFimSess = sessRow?.data_fim ? new Date(sessRow.data_fim) : new Date(dataInicioSess.getFullYear(), 11, 31);
    const anoLetivoNum = normalizeAnoLetivo(anoLetivoNome ?? dataInicioSess.getFullYear());
    const anoLetivo = String(anoLetivoNum);

    const pricing = await resolveMensalidadeAtual(client, escolaId, turmaId, anoLetivoNome, classeId);
    const valor = pricing?.valor;
    const dia = pricing?.dia_vencimento || 5;
    const tabelaId = pricing?.tabela_id ?? null;
    if (valor == null || !Number.isFinite(valor)) return;

    const today = new Date();
    const startMonth = gerarTodas ? dataInicioSess : new Date(today.getFullYear(), today.getMonth(), 1);
    const endMonth = new Date(dataFimSess.getFullYear(), dataFimSess.getMonth(), 1);

    const rows: MensalidadeInsert[] = [];
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
          valor: valorMes,
          valor_previsto: valorMes,
          data_vencimento: venc.toISOString().slice(0, 10),
          status: 'pendente',
          tabela_id: tabelaId,
        });
      }

      firstLoop = false;
      cursor.setMonth(cursor.getMonth() + 1);
    }

    if (rows.length > 0) {
      for (let i=0; i<rows.length; i+=1000) {
        await client.from('mensalidades').insert(rows.slice(i, i + 1000));
      }
    }
  } catch (e) {
    console.warn('[rematricula] geração de mensalidades falhou:', e);
  }
}
