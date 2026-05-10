import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { applyKf2ListInvariants } from "@/lib/kf2";
import type { Database } from "~types/supabase";

export const dynamic = 'force-dynamic';

const postBodySchema = z.object({
  anoLetivo: z.number().int().min(2020).max(2050),
  data_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  data_fim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  esquemaPeriodos: z.enum(["trimestral", "semestral", "bimestral"]),
  templateId: z.string().uuid().optional(),
});

const splitRanges = (startISO: string, endISO: string, parts: number): Array<{ start: string; end: string }> => {
  const toDate = (s: string) => new Date(`${s}T00:00:00Z`);
  const toISO = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  
  const start = toDate(startISO);
  const end = toDate(endISO);

  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
      throw new Error("Invalid date range");
  }

  const totalDays = Math.floor((end.getTime() - start.getTime()) / (24 * 3600 * 1000)) + 1;
  const chunk = Math.floor(totalDays / parts);
  const remainder = totalDays % parts;
  const ranges: Array<{ start: string; end: string }> = [];
  const cursor = new Date(start);

  for (let i = 0; i < parts; i++) {
    const len = chunk + (i < remainder ? 1 : 0);
    const segStart = new Date(cursor);
    const segEnd = new Date(cursor);
    segEnd.setUTCDate(segEnd.getUTCDate() + (len - 1));
    ranges.push({ start: toISO(segStart), end: toISO(segEnd) });
    cursor.setUTCDate(cursor.getUTCDate() + len);
  }
  return ranges;
};

// POST /api/escolas/[id]/onboarding/core/session
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: requestedEscolaId } = await context.params;
  const supabase = await supabaseServerTyped<Database>();

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const userEscolaId = await resolveEscolaIdForUser(supabase, user.id, requestedEscolaId);
    if (!userEscolaId) {
      return NextResponse.json({ ok: false, error: "Acesso negado a esta escola." }, { status: 403 });
    }

    const { data: hasRole, error: rolesError } = await supabase.rpc('user_has_role_in_school', {
      p_escola_id: userEscolaId,
      p_roles: ['admin_escola', 'secretaria'],
    });

    if (rolesError || !hasRole) {
      return NextResponse.json({ ok: false, error: "Você não tem permissão para executar esta ação." }, { status: 403 });
    }

    const body = await req.json();
    const parseResult = postBodySchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ ok: false, error: "Dados inválidos.", issues: parseResult.error.issues }, { status: 400 });
    }

    const { anoLetivo, data_inicio, data_fim, esquemaPeriodos, templateId } = parseResult.data;

    // 1. Create/Activate the Academic Year
    const { data: anoLetivoResult, error: anoError } = await supabase.rpc('setup_active_ano_letivo', {
      p_escola_id: userEscolaId,
      p_ano_data: {
        ano: anoLetivo,
        data_inicio,
        data_fim,
        ativo: true,
      },
    });

    if (anoError) throw new Error(`Erro ao salvar ano letivo: ${anoError.message}`);

    const anoLetivoId = (anoLetivoResult as { id: string })?.id;
    if (!anoLetivoId) throw new Error("Falha ao obter o ID do ano letivo.");

    // 2. Generate and save the periods and events
    let periodosPayload: Database['public']['Tables']['periodos_letivos']['Insert'][] = [];
    
    if (templateId) {
      const { data: templateItems } = await supabase
        .from('calendario_template_items')
        .select('*')
        .eq('template_id', templateId);
      
      const items = templateItems || [];

      periodosPayload = items
        .filter(i => i.tipo === 'PROVA_TRIMESTRAL')
        .map(i => ({
          ano_letivo_id: anoLetivoId,
          escola_id: userEscolaId,
          tipo: 'TRIMESTRE' as const,
          numero: i.numero || 1,
          data_inicio: i.data_inicio,
          data_fim: i.data_fim,
          trava_notas_em: null,
          peso: i.peso
        }));

      const eventosPayload: Database['public']['Tables']['calendario_eventos']['Insert'][] = items
        .filter(i => i.tipo !== 'PROVA_TRIMESTRAL')
        .map(i => ({
          escola_id: userEscolaId,
          ano_letivo_id: anoLetivoId,
          tipo: i.tipo,
          nome: i.nome,
          data_inicio: i.data_inicio,
          data_fim: i.data_fim
        }));

      if (eventosPayload.length > 0) {
        await supabase.from('calendario_eventos').upsert(eventosPayload, { onConflict: 'escola_id,ano_letivo_id,nome,data_inicio' });
      }
    } else {
      const tipoUpper = (esquemaPeriodos === 'semestral' ? 'SEMESTRE' : esquemaPeriodos === 'bimestral' ? 'BIMESTRE' : 'TRIMESTRE') as Database['public']['Enums']['periodo_tipo'];
      const parts = tipoUpper === 'SEMESTRE' ? 2 : tipoUpper === 'BIMESTRE' ? 4 : 3;
      const ranges = splitRanges(data_inicio, data_fim, parts);
      
      periodosPayload = ranges.map((r, idx) => ({
        ano_letivo_id: anoLetivoId,
        escola_id: userEscolaId,
        tipo: tipoUpper,
        numero: idx + 1,
        data_inicio: r.start,
        data_fim: r.end,
        trava_notas_em: null,
        peso: Math.floor(100 / parts)
      }));
    }

    const { data: periodos, error: periodosError } = await supabase.rpc('upsert_bulk_periodos_letivos', {
      p_escola_id: userEscolaId,
      p_periodos_data: periodosPayload,
    });

    if (periodosError) throw new Error(`Erro ao salvar períodos letivos: ${periodosError.message}`);

    // 3. School configuration
    await supabase.from("configuracoes_escola").upsert(
        {
          escola_id: userEscolaId,
          periodo_tipo: templateId ? 'trimestral' : esquemaPeriodos,
          autogerar_periodos: true,
          estrutura: 'cursos',
          tipo_presenca: 'curso',
        },
        { onConflict: "escola_id" }
    );
      
    await supabase.from('onboarding_drafts').delete().eq('escola_id', userEscolaId);

    return NextResponse.json({
      ok: true,
      data: {
        id: anoLetivoId,
        nome: `${anoLetivo}/${anoLetivo + 1}`,
        data_inicio,
        data_fim,
        status: 'ativa',
        ano_letivo: String(anoLetivo),
      },
      periodos,
    });

  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro inesperado";
    console.error(`[Onboarding Session POST] Error: ${msg}`, e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// GET /api/escolas/[id]/onboarding/core/session
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: requestedEscolaId } = await context.params;
  const supabase = await supabaseServerTyped<Database>();

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const userEscolaId = await resolveEscolaIdForUser(supabase, user.id, requestedEscolaId);
    if (!userEscolaId) {
      return NextResponse.json({ ok: false, error: "Acesso negado a esta escola." }, { status: 403 });
    }

    let anosQuery = supabase
      .from('anos_letivos')
      .select('id, ano, data_inicio, data_fim, ativo')
      .eq('escola_id', userEscolaId)

    anosQuery = applyKf2ListInvariants(anosQuery, {
      defaultLimit: 50,
      order: [{ column: 'ano', ascending: false }],
    })

    const { data: anos, error } = await anosQuery;

    if (error) {
      return NextResponse.json({ ok: false, error: `Erro ao buscar anos letivos: ${error.message}` }, { status: 500 });
    }

    const list = anos.map((row) => ({
      id: row.id,
      nome: `${row.ano}/${row.ano + 1}`,
      data_inicio: row.data_inicio,
      data_fim: row.data_fim,
      status: row.ativo ? 'ativa' : 'arquivada',
      ano_letivo: String(row.ano),
    }));

    let periodos: any[] = [];
    const ativo = anos.find((r) => r.ativo);
    if (ativo) {
      let periodosQuery = supabase
        .from('periodos_letivos')
        .select('id, tipo, numero, data_inicio, data_fim, trava_notas_em')
        .eq('ano_letivo_id', ativo.id)

      periodosQuery = applyKf2ListInvariants(periodosQuery, {
        defaultLimit: 50,
        order: [{ column: 'numero', ascending: true }],
      })

      const { data: per, error: perError } = await periodosQuery;

      if (perError) {
         return NextResponse.json({ ok: false, error: `Erro ao buscar períodos: ${perError.message}` }, { status: 500 });
      }
        
      periodos = (per || []).map((p) => ({
        id: p.id,
        tipo: p.tipo,
        numero: p.numero,
        nome: `${p.numero}º ${p.tipo === 'SEMESTRE' ? 'Semestre' : p.tipo === 'BIMESTRE' ? 'Bimestre' : 'Trimestre'}`,
        data_inicio: p.data_inicio,
        data_fim: p.data_fim,
        trava_notas_em: p.trava_notas_em,
        sessao_id: ativo.id,
      }));
    }

    return NextResponse.json({ ok: true, data: list, periodos });

  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro inesperado';
    console.error(`[Onboarding Session GET] Error: ${msg}`, e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
