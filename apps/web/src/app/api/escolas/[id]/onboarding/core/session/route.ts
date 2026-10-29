import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { assertEscolaAccessAndPermissions } from "@/lib/api/assertEscolaAccessAndPermissions";
import { applyKf2ListInvariants } from "@/lib/kf2";
import type { Database } from "~types/supabase";
import { prepareCanonicalMedCalendar } from '@/lib/academico/prepare-canonical-calendar';

export const dynamic = 'force-dynamic';

const postBodySchema = z.object({
  anoLetivo: z.number().int().min(2020).max(2050),
  data_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  data_fim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  esquemaPeriodos: z.enum(["trimestral", "semestral", "bimestral"]),
  templateId: z.string().uuid().optional(),
  periodosConfig: z.array(
    z.object({
      numero: z.number().int().min(1).max(4),
      data_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      data_fim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      trava_notas_em: z.string().datetime().optional().or(z.literal("")),
    })
  ).optional(),
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

    const access = await assertEscolaAccessAndPermissions({
      client: supabase,
      userId: user.id,
      requestedEscolaId,
      allowedPapels: ["admin", "staff_admin", "admin_escola", "secretaria", "admin_financeiro"],
      route: "/api/escolas/[id]/onboarding/core/session",
    });
    if (!access.ok) {
      return NextResponse.json({ ok: false, error: access.error }, { status: access.status });
    }
    const userEscolaId = access.escolaId;

    const body = await req.json();
    const parseResult = postBodySchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ ok: false, error: "Dados inválidos.", issues: parseResult.error.issues }, { status: 400 });
    }

    const { anoLetivo, data_inicio, data_fim, esquemaPeriodos, templateId, periodosConfig } = parseResult.data;

    let officialVersion: string | null = null;
    if (anoLetivo >= 2026) {
      if (!templateId || (periodosConfig?.length ?? 0) > 0 || esquemaPeriodos !== "trimestral") {
        return NextResponse.json({
          ok: false, code: "OFFICIAL_CALENDAR_REQUIRED",
          error: "A partir de 2026/2027, os trimestres devem vir do calendário oficial publicado.",
        }, { status: 409 });
      }
      const { data: official, error: officialError } = await supabase
        .from("calendario_templates")
         .select("id,ano_base,estado,is_oficial,subsistema,data_inicio,data_fim,versao_documento,items:calendario_template_items(id,numero,tipo,data_inicio,data_fim)")
        .eq("id", templateId).maybeSingle();
      if (officialError) throw officialError;
      const officialTerms = official?.items?.filter((item) => item.tipo === "PERIODO_LETIVO") ?? [];
      if (!official || !official.is_oficial || official.estado !== "PUBLICADO" ||
          official.ano_base !== anoLetivo ||
          official.data_inicio !== data_inicio || official.data_fim !== data_fim ||
          officialTerms.length !== 3 ||
          new Set(officialTerms.map((item) => item.numero)).size !== 3 ||
          officialTerms.some((item) => ![1, 2, 3].includes(Number(item.numero)))) {
        return NextResponse.json({
          ok: false, code: "ACADEMIC_CALENDAR_TEMPLATE_MISMATCH",
          error: "As datas ou os trimestres não correspondem ao decreto publicado.",
        }, { status: 409 });
      }
      officialVersion = official.versao_documento;
      const { data: offerings, error: offeringsError } = await supabase
        .from("school_education_offerings")
        .select("education_subsystem")
        .eq("escola_id", userEscolaId).eq("status", "active");
      if (offeringsError) throw offeringsError;
      if ((offerings ?? []).some((item) => item.education_subsystem !== official.subsistema)) {
        return NextResponse.json({
          ok: false, code: "MULTI_OFFERING_CALENDAR_REQUIRES_SCOPED_IMPORT",
          error: "A escola possui ofertas com calendários diferentes. Configure cada oferta no fluxo académico.",
        }, { status: 409 });
      }
    }

    if (anoLetivo >= 2026) {
      const [{ data: canonical, error: canonicalError }, { data: reference, error: referenceError }] =
        await Promise.all([
          (supabase as any).from("calendarios_oficiais_anos")
            .select("ano_base,data_inicio,data_fim")
            .eq("ano_base", anoLetivo).maybeSingle(),
          (supabase as any).from("calendario_templates")
            .select("id,items:calendario_template_items(numero,tipo,data_inicio,data_fim)")
            .eq("calendario_canonico_ano", anoLetivo).eq("estado", "PUBLICADO")
            .eq("is_oficial", true).order("id", { ascending: true }).limit(1).maybeSingle(),
        ]);
      if (canonicalError || referenceError) throw canonicalError ?? referenceError;
      const officialTerms = (reference?.items ?? [])
        .filter((item: { tipo: string }) => item.tipo === "PERIODO_LETIVO");
      if (!canonical || !reference || canonical.data_inicio !== data_inicio ||
          canonical.data_fim !== data_fim || officialTerms.length !== 3 ||
          (periodosConfig ?? []).some((periodo) => !officialTerms.some((item: {
            numero: number; data_inicio: string; data_fim: string;
          }) => item.numero === periodo.numero &&
               item.data_inicio === periodo.data_inicio && item.data_fim === periodo.data_fim))) {
        return NextResponse.json({
          ok: false, code: "ACADEMIC_CALENDAR_TEMPLATE_MISMATCH",
          error: "As datas ou os trimestres não correspondem ao calendário oficial publicado.",
        }, { status: 409 });
      }
      if (templateId) {
        const { data: chosen, error } = await (supabase as any)
          .from("calendario_templates").select("calendario_canonico_ano")
          .eq("id", templateId).maybeSingle();
        if (error) throw error;
        if (chosen?.calendario_canonico_ano !== anoLetivo) {
          return NextResponse.json({
            ok: false, code: "COURSE_CALENDAR_PROFILE_MISMATCH",
            error: "Este perfil não pertence ao calendário oficial selecionado.",
          }, { status: 409 });
        }
      }
      const result = await prepareCanonicalMedCalendar({
        db: supabase as any, escolaId: userEscolaId, userId: user.id, anoBase: anoLetivo,
      });
      const prepared = await result.json();
      if (!result.ok || !prepared.ok || !prepared.target_session?.id) {
        return NextResponse.json(prepared, { status: result.status });
      }
      const { error: activationError } = await supabase.rpc("setup_active_ano_letivo", {
        p_escola_id: userEscolaId,
        p_ano_data: { id: prepared.target_session.id, ano: anoLetivo, data_inicio, data_fim, ativo: true },
      });
      if (activationError) throw activationError;
      const { error: configError } = await supabase.from("configuracoes_escola").upsert({
        escola_id: userEscolaId, periodo_tipo: "trimestral",
        autogerar_periodos: true, estrutura: "cursos", tipo_presenca: "curso",
      }, { onConflict: "escola_id" });
      if (configError) throw configError;
      return NextResponse.json({
        ok: true, data: {
          id: prepared.target_session.id, nome: `${anoLetivo}/${anoLetivo + 1}`,
          data_inicio, data_fim, status: "ativa", ano_letivo: String(anoLetivo),
        },
        periodos: { source: "CALENDARIO_CANONICO_MED", count: prepared.trimestres },
      });
    }

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
    let eventosPayload: Database['public']['Tables']['calendario_eventos']['Insert'][] = [];
    
    if (Array.isArray(periodosConfig) && periodosConfig.length > 0) {
      const sortedConfig = periodosConfig.slice().sort((a, b) => a.numero - b.numero);
      const totalPeriodos = Math.max(sortedConfig.length, 1);
      const basePeso = Math.floor(100 / totalPeriodos);
      const pesoRemainder = 100 - (basePeso * totalPeriodos);

      periodosPayload = periodosConfig
        .slice()
        .sort((a, b) => a.numero - b.numero)
        .map((periodo, index) => ({
          ano_letivo_id: anoLetivoId,
          escola_id: userEscolaId,
          tipo: 'TRIMESTRE' as const,
          numero: periodo.numero,
          data_inicio: periodo.data_inicio,
          data_fim: periodo.data_fim,
          trava_notas_em: periodo.trava_notas_em ? periodo.trava_notas_em : null,
          peso: basePeso + (index < pesoRemainder ? 1 : 0),
        }));
    } else if (templateId) {
      const { data: templateItems } = await supabase
        .from('calendario_template_items')
        .select('*')
        .eq('template_id', templateId);
      
      const items = templateItems || [];

      const periodoTipo = items.some(i => i.tipo === 'PERIODO_LETIVO')
        ? 'PERIODO_LETIVO'
        : 'PROVA_TRIMESTRAL';

      periodosPayload = items
        .filter(i => i.tipo === periodoTipo)
        .map(i => ({
          ano_letivo_id: anoLetivoId,
          escola_id: userEscolaId,
          tipo: 'TRIMESTRE' as const,
          numero: i.numero || 1,
          data_inicio: i.data_inicio,
          data_fim: i.data_fim,
          trava_notas_em: null,
          peso: i.peso,
          ...(anoLetivo >= 2026 ? {
            source_template_id: templateId,
            source_item_id: i.id,
            source_version: officialVersion,
          } : {}),
        }));

      eventosPayload = items
        .filter(i => i.tipo !== periodoTipo)
        .map(i => ({
          escola_id: userEscolaId,
          ano_letivo_id: anoLetivoId,
          tipo: i.tipo,
          nome: i.nome,
          data_inicio: i.data_inicio,
          data_fim: i.data_fim,
          ...(anoLetivo >= 2026 ? {
            source_template_id: templateId,
            source_item_id: i.id,
            source_version: officialVersion,
            applied_at: new Date().toISOString(),
            applied_by: user.id,
          } : {}),
        }));

    } else {
      const tipoUpper = (esquemaPeriodos === 'semestral' ? 'SEMESTRE' : esquemaPeriodos === 'bimestral' ? 'BIMESTRE' : 'TRIMESTRE') as Database['public']['Enums']['periodo_tipo'];
      const parts = tipoUpper === 'SEMESTRE' ? 2 : tipoUpper === 'BIMESTRE' ? 4 : 3;
      const ranges = splitRanges(data_inicio, data_fim, parts);
      const basePeso = Math.floor(100 / parts);
      const pesoRemainder = 100 - (basePeso * parts);
      
      periodosPayload = ranges.map((r, idx) => ({
        ano_letivo_id: anoLetivoId,
        escola_id: userEscolaId,
        tipo: tipoUpper,
        numero: idx + 1,
        data_inicio: r.start,
        data_fim: r.end,
        trava_notas_em: null,
        peso: basePeso + (idx < pesoRemainder ? 1 : 0)
      }));
    }

    const { data: periodos, error: periodosError } = await supabase.rpc('upsert_bulk_periodos_letivos', {
      p_escola_id: userEscolaId,
      p_periodos_data: periodosPayload,
    });

    if (periodosError) throw new Error(`Erro ao salvar períodos letivos: ${periodosError.message}`);

    if (eventosPayload.length > 0) {
      const { error: eventsError } = await supabase.from('calendario_eventos')
        .upsert(eventosPayload, { onConflict: 'escola_id,ano_letivo_id,offering_id,nome,data_inicio' });
      if (eventsError) throw new Error(`Erro ao salvar eventos do calendário: ${eventsError.message}`);
    }

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

    const access = await assertEscolaAccessAndPermissions({
      client: supabase,
      userId: user.id,
      requestedEscolaId,
      allowedPapels: ["admin", "staff_admin", "admin_escola", "secretaria", "admin_financeiro"],
      route: "/api/escolas/[id]/onboarding/core/session",
    });
    if (!access.ok) {
      return NextResponse.json({ ok: false, error: access.error }, { status: access.status });
    }
    const userEscolaId = access.escolaId;

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
