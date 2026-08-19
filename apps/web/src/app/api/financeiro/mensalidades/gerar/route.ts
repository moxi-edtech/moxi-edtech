// apps/web/src/app/api/financeiro/mensalidades/gerar/route.ts

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseServerTyped } from '@/lib/supabaseServer'
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser'
import { isBillingCompetencyAllowed, resolveTurmaBillingWindow } from '@/lib/financeiro/turma-billing-window'
import { resolveRegimeAcademico } from '@/lib/academico/regime-academico'
import type { Database } from '~types/supabase'

export const dynamic = "force-dynamic"
export const revalidate = 0

const BodySchema = z.object({
  ano_letivo: z.number().min(2020).max(2050),
  mes_referencia: z.number().min(1).max(12),
  dia_vencimento: z.number().min(1).max(31).optional(),
  turma_id: z.string().uuid().optional(),
})

export async function POST(req: Request) {
  try {
    const supabase = await supabaseServerTyped<Database>()
    const supabaseAny = supabase as any
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })
    }

    const idempotencyKey =
      req.headers.get('Idempotency-Key') ?? req.headers.get('idempotency-key')
    if (!idempotencyKey) {
      return NextResponse.json(
        { ok: false, error: 'Idempotency-Key header é obrigatório' },
        { status: 400 }
      )
    }

    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id)
    if (!escolaId) {
      return NextResponse.json({ ok: false, error: 'Escola não identificada' }, { status: 400 })
    }

    const body = await req.json().catch(() => ({}))
    const parsed = BodySchema.safeParse(body)
    
    if (!parsed.success) {
      return NextResponse.json({ 
        ok: false, 
        error: parsed.error.issues[0]?.message || 'Dados inválidos' 
      }, { status: 400 })
    }

    const { data: existingIdempotency } = await supabaseAny
      .from('idempotency_keys')
      .select('result')
      .eq('escola_id', escolaId)
      .eq('scope', 'financeiro_mensalidades_gerar')
      .eq('key', idempotencyKey)
      .maybeSingle()

    if (existingIdempotency?.result) {
      return NextResponse.json(existingIdempotency.result, { status: 200 })
    }

    const { ano_letivo, mes_referencia, dia_vencimento, turma_id } = parsed.data

    const { data: anoLetivoConfig, error: anoLetivoError } = await supabase
      .from("anos_letivos")
      .select("id, data_inicio, data_fim")
      .eq("escola_id", escolaId)
      .eq("ano", ano_letivo)
      .order("ativo", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (anoLetivoError) {
      return NextResponse.json({ ok: false, error: anoLetivoError.message }, { status: 500 });
    }

    if (!anoLetivoConfig?.data_inicio || !anoLetivoConfig.data_fim) {
      return NextResponse.json(
        { ok: false, error: "O ano letivo não tem data de início e fim configuradas.", code: "ACADEMIC_YEAR_DATES_MISSING" },
        { status: 409 },
      );
    }

    const start = new Date(`${anoLetivoConfig.data_inicio}T00:00:00Z`);
    const end = new Date(`${anoLetivoConfig.data_fim}T00:00:00Z`);

    const { data: turmas, error: turmasError } = await supabaseAny
      .from("turmas")
      .select("id, nome, is_classe_exame, classe_num, classes(numero, nome)")
      .eq("escola_id", escolaId)
      .eq("ano_letivo", String(ano_letivo))
      .in("status", ["ativa", "ativo"])
      .match(turma_id ? { id: turma_id } : {});

    if (turmasError) {
      return NextResponse.json({ ok: false, error: turmasError.message }, { status: 500 });
    }

    const turmaIds = (turmas ?? []).map((turma: any) => turma.id).filter(Boolean);
    const janelaResults = turmaIds.length > 0
      ? await Promise.all(turmaIds.map(async (turmaId: string) => {
          const { data, error } = await supabaseAny.rpc("resolve_turma_janela_cobranca", {
            p_turma_id: turmaId,
            p_ano_letivo_id: anoLetivoConfig.id,
          });
          return { turmaId, data: Array.isArray(data) ? data[0] : data, error };
        }))
      : [];
    const janelaError = janelaResults.find((result) => result.error)?.error;
    if (janelaError) {
      return NextResponse.json({ ok: false, error: janelaError.message }, { status: 500 });
    }
    const janelaByTurma = new Map(janelaResults.map(({ turmaId, data }) => [turmaId, data]));

    const crossesCalendarYear = start.getUTCFullYear() !== end.getUTCFullYear();
    const competenciaYear = crossesCalendarYear
      ? (mes_referencia >= start.getUTCMonth() + 1 ? start.getUTCFullYear() : end.getUTCFullYear())
      : ano_letivo;
    const regimeByTurma = new Map<string, Awaited<ReturnType<typeof resolveRegimeAcademico>>>();
    await Promise.all((turmas ?? []).map(async (turma: any) => {
      regimeByTurma.set(turma.id, await resolveRegimeAcademico(supabaseAny, turma.id));
    }));
    const eligibleTurmaIds = (turmas ?? []).filter((turma: any) => {
      const regime = regimeByTurma.get(turma.id);
      const isClasseExame = Boolean(regime?.eh_classe_exame);
      const janela = resolveTurmaBillingWindow({
        academicStart: anoLetivoConfig.data_inicio,
        academicEnd: anoLetivoConfig.data_fim,
        customWindow: janelaByTurma.get(turma.id),
        isClasseExame,
      });
      return isBillingCompetencyAllowed(janela, { ano: competenciaYear, mes: mes_referencia });
    }).map((turma: any) => turma.id);

    if (eligibleTurmaIds.length === 0) {
      return NextResponse.json({
        ok: true,
        stats: { ok: true, geradas: 0, ano: competenciaYear, mes: mes_referencia, ignoradas: (turmas ?? []).length },
        message: `A competência ${mes_referencia}/${competenciaYear} não está dentro do período cobrável das turmas selecionadas.`,
        code: "MONTH_OUTSIDE_ACADEMIC_YEAR",
      });
    }

    // Processamento sequencial: uma falha fica identificada por turma e não é
    // mascarada por Promise.all. A operação só é idempotentizada quando todas
    // as turmas terminam com sucesso.
    const results: Array<{ turma_id: string; geradas: number }> = [];
    const failures: Array<{ turma_id: string; error: string }> = [];
    for (const eligibleTurmaId of eligibleTurmaIds) {
      try {
        const { data, error } = await supabase.rpc('gerar_mensalidades_lote', {
          p_escola_id: escolaId,
          p_ano_letivo: ano_letivo,
          p_mes_referencia: mes_referencia,
          p_dia_vencimento_default: dia_vencimento || 10,
          p_turma_id: eligibleTurmaId,
        });
        if (error) throw error;

        // A RPC legada não preenchia matricula_id. Reassociamos apenas cobranças
        // pendentes do mesmo aluno/turma/competência, sem tocar em pagamentos existentes.
        const { data: matriculasAtivas, error: matriculasError } = await supabaseAny
          .from("matriculas")
          .select("id, aluno_id")
          .eq("escola_id", escolaId)
          .eq("turma_id", eligibleTurmaId)
          .eq("ano_letivo", ano_letivo)
          .in("status", ["ativo", "ativa", "active"]);
        if (matriculasError) throw matriculasError;

        for (const matricula of matriculasAtivas ?? []) {
          const { error: vinculoError } = await supabaseAny
            .from("mensalidades")
            .update({ matricula_id: matricula.id })
            .eq("escola_id", escolaId)
            .eq("aluno_id", matricula.aluno_id)
            .eq("turma_id", eligibleTurmaId)
            .eq("ano_letivo", String(ano_letivo))
            .eq("mes_referencia", mes_referencia)
            .is("matricula_id", null)
            .in("status", ["pendente", "aberta"]);
          if (vinculoError) throw vinculoError;
        }
        results.push({ turma_id: eligibleTurmaId, geradas: Number((data as { geradas?: number } | null)?.geradas ?? 0) });
      } catch (error) {
        failures.push({ turma_id: eligibleTurmaId, error: error instanceof Error ? error.message : "Erro ao gerar mensalidades." });
      }
    }
    const geradas = results.reduce((total, result) => total + result.geradas, 0);

    if (failures.length > 0) {
      return NextResponse.json({
        ok: false,
        code: "MONTHLY_BILLING_PARTIAL_FAILURE",
        error: "A geração terminou parcialmente. Corrija as turmas indicadas e tente novamente com a mesma referência.",
        stats: { geradas, turmas_processadas: results.length, turmas_com_erro: failures.length, ano: competenciaYear, mes: mes_referencia },
        failures,
      }, { status: 502 });
    }

    const responsePayload = { 
      ok: true, 
      stats: { ok: true, geradas, ano: competenciaYear, mes: mes_referencia, turmas_processadas: eligibleTurmaIds.length },
    }

    await supabaseAny.from('idempotency_keys').upsert(
      {
        escola_id: escolaId,
        scope: 'financeiro_mensalidades_gerar',
        key: idempotencyKey,
        result: responsePayload,
      },
      { onConflict: 'escola_id,scope,key' }
    )

    return NextResponse.json(responsePayload)

  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
