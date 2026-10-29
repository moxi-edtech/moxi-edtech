// @kf2 allow-scan
// apps/web/src/app/api/secretaria/operacoes-academicas/virada/sessions-target/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeEscolaAction } from "@/lib/escola/disciplinas";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import type { Database } from "~types/supabase";
import { prepareCanonicalMedCalendar } from "@/lib/academico/prepare-canonical-calendar";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CreateTargetBody = z.object({
  ano_base: z.number().int().min(2026).max(2050).optional(),
  template_id: z.string().uuid().optional(),
  offerings: z.array(z.object({
    offering_id: z.string().uuid(),
    template_id: z.string().uuid(),
  })).min(1).optional(),
}).refine((value) => Boolean(value.ano_base || value.template_id || value.offerings?.length), {
  message: "Selecione o ano letivo do calendário oficial",
});

export async function GET() {
  try {
    const supabase = await supabaseServerTyped<Database>();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const escolaId = await resolveEscolaIdForUser(supabase, user.id);
    if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não identificada" }, { status: 403 });
    const authz = await authorizeEscolaAction(supabase as any, escolaId, user.id, ["configurar_escola"]);
    if (!authz.allowed) {
      return NextResponse.json({ ok: false, error: authz.reason || "Sem permissão" }, { status: 403 });
    }

    // 1. Obter o ano ativo
    const { data: anoAtivo } = await supabase
      .from("anos_letivos")
      .select("id, ano")
      .eq("escola_id", escolaId)
      .eq("ativo", true)
      .maybeSingle();

    // 2. Obter potenciais destinos (anos futuros cadastrados ou criar sugestão)
    const { data: futuros } = await supabase
      .from("anos_letivos")
      .select("id, ano, ativo")
      .eq("escola_id", escolaId)
      .gt("ano", anoAtivo?.ano || 0)
      .order("ano", { ascending: true });

    // 3. Verificar se já houve clonagem para algum desses anos
    const { data: existingStructure } = await supabase
      .from("turmas")
      .select("session_id")
      .eq("escola_id", escolaId);
    
    const sessionsWithData = new Set((existingStructure ?? []).map((t) => t.session_id));

    const { data: templates, error: templatesError } = await supabase
      .from("calendario_templates")
      .select("id,nome,ano_base,data_inicio,data_fim,subsistema,calendario_canonico_ano,versao_documento")
      .eq("is_oficial", true)
      .eq("estado", "PUBLICADO")
      // O calendário 2026/2027 tem ano_base=2026. O ano-base coincide
      // com o ano letivo de origem e deve aparecer como destino elegível.
      .gte("ano_base", anoAtivo?.ano || 0)
      .order("ano_base", { ascending: true })
      .order("subsistema", { ascending: true });

    if (templatesError) throw templatesError;

    const { data: officialCalendars, error: canonicalError } = await (supabase as any)
      .from("calendarios_oficiais_anos")
      .select("ano_base,data_inicio,data_fim,versao_documento,estado")
      .eq("estado", "PUBLICADO")
      .gte("ano_base", anoAtivo?.ano || 0)
      .order("ano_base", { ascending: true });
    if (canonicalError) throw canonicalError;

    const { data: offerings } = await (supabase as any)
      .from("school_education_offerings")
      .select("id,course_id,education_subsystem,education_level,cycle,grades,calendar_profile_id,status")
      .eq("escola_id", escolaId)
      .eq("status", "active")
      .order("education_subsystem", { ascending: true });

    const courseIds = [...new Set((offerings ?? []).map((offering: { course_id: string | null }) => offering.course_id).filter(Boolean))] as string[];
    const { data: courses } = courseIds.length
      ? await supabase.from("cursos").select("id,nome").eq("escola_id", escolaId).in("id", courseIds)
      : { data: [] as Array<{ id: string; nome: string }> };
    const courseNameById = new Map((courses ?? []).map((course: { id: string; nome: string }) => [course.id, course.nome]));

    return NextResponse.json({
      ok: true,
      current_session: anoAtivo,
      target_sessions: (futuros || []).map(s => ({
        ...s,
        has_data: sessionsWithData.has(s.id)
      })),
      official_calendars: officialCalendars ?? [],
      official_templates: templates ?? [],
      education_offerings: (offerings ?? []).map((offering: { course_id: string | null }) => ({
        ...offering,
        course_name: offering.course_id ? courseNameById.get(offering.course_id) ?? null : null,
      })),
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await supabaseServerTyped<Database>();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const escolaId = await resolveEscolaIdForUser(supabase, user.id);
    if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não identificada" }, { status: 403 });
    const authz = await authorizeEscolaAction(supabase as any, escolaId, user.id, ["configurar_escola"]);
    if (!authz.allowed) {
      return NextResponse.json({ ok: false, error: authz.reason || "Sem permissão" }, { status: 403 });
    }

    const parsed = CreateTargetBody.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Selecione pelo menos um perfil regulatório" }, { status: 400 });
    }

    if (parsed.data.ano_base) {
      return prepareCanonicalMedCalendar({
        db: supabase as any, escolaId, userId: user.id,
        anoBase: parsed.data.ano_base, selections: parsed.data.offerings,
      });
    }

    const db = supabase as any;
    const { data: activeYear } = await supabase
      .from("anos_letivos")
      .select("id,ano")
      .eq("escola_id", escolaId)
      .eq("ativo", true)
      .maybeSingle();

    const { data: educationOfferings, error: offeringsError } = await db
      .from("school_education_offerings")
      .select("id,education_subsystem,education_level,cycle,grades,calendar_profile_id")
      .eq("escola_id", escolaId)
      .eq("status", "active");
    if (offeringsError) throw offeringsError;

    const requestedMappings = parsed.data.offerings ?? (
      parsed.data.template_id ? [{ offering_id: null, template_id: parsed.data.template_id }] : []
    );
    const knownOfferingIds = new Set((educationOfferings ?? []).map((offering: { id: string }) => offering.id));
    const scopedMappings = requestedMappings.filter((mapping) => mapping.offering_id);
    if (scopedMappings.some((mapping) => !knownOfferingIds.has(mapping.offering_id as string))) {
      return NextResponse.json({ ok: false, error: "Oferta educativa inválida para esta escola" }, { status: 400 });
    }
    const templateIds = [...new Set(requestedMappings.map((mapping) => mapping.template_id))];

    const [{ data: templates, error: templateError }] = await Promise.all([
      supabase
        .from("calendario_templates")
        .select("id,nome,ano_base,data_inicio,data_fim,subsistema,versao_documento,items:calendario_template_items(*)")
        .in("id", templateIds)
        .eq("is_oficial", true)
        .eq("estado", "PUBLICADO"),
    ]);

    const templateList = templates ?? [];
    if (templateError || templateList.length !== templateIds.length) {
      return NextResponse.json({ ok: false, error: "Um ou mais templates oficiais não foram encontrados" }, { status: 404 });
    }
    // Historical clients cannot bypass the canonical-year contract by
    // sending several independent official profiles as templates.
    if (templateList.some((template) => template.ano_base >= 2026)) {
      return NextResponse.json({
        ok: false, code: "CANONICAL_CALENDAR_SELECTION_REQUIRED",
        error: "Selecione um calendário oficial do ano e associe os perfis aos cursos.",
      }, { status: 409 });
    }
    const primaryOfficial = templateList[0];
    if (primaryOfficial && primaryOfficial.ano_base >= 2026) {
      const canonicalPeriodKey = (candidate: typeof primaryOfficial) => {
        const items = (candidate.items ?? [])
          .filter((item: { tipo: string }) => item.tipo === "PERIODO_LETIVO")
          .map((item: { numero: number | null; data_inicio: string; data_fim: string }) =>
            [item.numero, item.data_inicio, item.data_fim])
          .sort((a: unknown[], b: unknown[]) => Number(a[0]) - Number(b[0]));
        if (items.length !== 3 || new Set(items.map((row) => row[0])).size !== 3 ||
            items.some((row) => ![1, 2, 3].includes(Number(row[0])))) return null;
        return JSON.stringify(items);
      };
      const key = canonicalPeriodKey(primaryOfficial);
      if (!key || templateList.some((candidate) =>
        candidate.ano_base !== primaryOfficial.ano_base ||
        candidate.data_inicio !== primaryOfficial.data_inicio ||
        candidate.data_fim !== primaryOfficial.data_fim ||
        canonicalPeriodKey(candidate) !== key)) {
        return NextResponse.json({
          ok: false, code: "ACADEMIC_MULTI_TEMPLATE_PERIOD_DIVERGENCE",
          error: "Os calendários oficiais escolhidos têm períodos diferentes. É necessário conciliar as ofertas educativas.",
        }, { status: 409 });
      }
    }
    if (activeYear && templateList.some((template) => template.ano_base < activeYear.ano)) {
      return NextResponse.json({ ok: false, error: "O template não pode ser anterior ao ano ativo" }, { status: 409 });
    }

    const offeringById = new Map(
      ((educationOfferings ?? []) as Array<{ id: string; education_subsystem: string }>)
        .map((offering) => [offering.id, offering] as const)
    );
    const templateById = new Map(templateList.map((template: { id: string; subsistema: string | null }) => [template.id, template]));
    for (const mapping of scopedMappings) {
      const offering = offeringById.get(mapping.offering_id as string);
      const template = templateById.get(mapping.template_id);
      if (!offering || !template || template.subsistema !== offering.education_subsystem) {
        return NextResponse.json({
          ok: false,
          error: "O calendário selecionado não é compatível com a oferta educativa.",
        }, { status: 409 });
      }
    }

    const primaryTemplate = templateList[0];
    const { data: existingTarget } = await supabase
      .from("anos_letivos")
      .select("id,ano,ativo,data_inicio,data_fim")
      .eq("escola_id", escolaId)
      .eq("ano", primaryTemplate.ano_base)
      .maybeSingle();

    if (primaryTemplate.ano_base >= 2026 && existingTarget &&
        (existingTarget.data_inicio !== primaryTemplate.data_inicio ||
         existingTarget.data_fim !== primaryTemplate.data_fim)) {
      return NextResponse.json({
        ok: false, code: "ACADEMIC_YEAR_CALENDAR_MISMATCH",
        error: "As datas do ano letivo divergem do calendário publicado. Concilie antes de aplicar.",
      }, { status: 409 });
    }

    let targetId = existingTarget?.id ?? null;
    if (!targetId) {
      const { data: created, error: createError } = await supabase.rpc("setup_active_ano_letivo", {
        p_escola_id: escolaId,
        p_ano_data: {
          ano: primaryTemplate.ano_base,
          data_inicio: primaryTemplate.data_inicio,
          data_fim: primaryTemplate.data_fim,
          ativo: false,
        },
      });
      if (createError) throw createError;
      targetId = typeof created === "object" && created && "id" in created
        ? String((created as { id: unknown }).id)
        : null;
    }

    if (!targetId) {
      const { data: target } = await supabase
        .from("anos_letivos")
        .select("id")
        .eq("escola_id", escolaId)
        .eq("ano", primaryTemplate.ano_base)
        .single();
      targetId = target?.id ?? null;
    }
    if (!targetId) throw new Error("Falha ao criar ano letivo de destino");

    const periodTemplate = primaryTemplate;
    const periodItems = (periodTemplate.items ?? []).filter((item: { tipo: string }) =>
      item.tipo === "PERIODO_LETIVO" || item.tipo === "PROVA_TRIMESTRAL"
    );
    const periodType = periodItems.some((item: { tipo: string }) => item.tipo === "PERIODO_LETIVO")
      ? "PERIODO_LETIVO"
      : "PROVA_TRIMESTRAL";
    const periods = periodItems
      .filter((item: { tipo: string }) => item.tipo === periodType)
      .map((item: {
        id: string;
        numero: number | null;
        data_inicio: string;
        data_fim: string;
        peso: number | null;
      }) => ({
        ano_letivo_id: targetId,
        tipo: "TRIMESTRE",
        numero: item.numero,
        data_inicio: item.data_inicio,
        data_fim: item.data_fim,
        peso: item.peso,
        // The official-calendar RPC validates item ID, dates and template
        // before persisting provenance on periodos_letivos.
        source_template_id: periodTemplate.id,
        source_item_id: item.id,
        source_version: periodTemplate.versao_documento,
      }));
    const events = requestedMappings.flatMap((mapping) => {
      const template = templateList.find((candidate) => candidate.id === mapping.template_id);
      return (template?.items ?? [])
        .filter((item: { tipo: string }) => item.tipo !== periodType)
        .map((item: {
          tipo: string;
          nome: string;
          data_inicio: string;
          data_fim: string;
          id: string;
          applies_to_all_offerings?: boolean;
        }) => ({
          escola_id: escolaId,
          ano_letivo_id: targetId,
          offering_id: item.applies_to_all_offerings === false ? mapping.offering_id : null,
          tipo: item.tipo,
          nome: item.nome,
          data_inicio: item.data_inicio,
          data_fim: item.data_fim,
          source_template_id: template?.id,
          source_item_id: item.id,
          source_version: template?.versao_documento,
          applied_at: new Date().toISOString(),
          applied_by: user.id,
        }));
    }).filter((event, index, allEvents) =>
      event.offering_id !== null ||
      allEvents.findIndex((candidate) =>
        candidate.nome === event.nome &&
        candidate.data_inicio === event.data_inicio &&
        candidate.offering_id === null
      ) === index
    );

    // The existing period RPC treats omitted lock deadlines as NULL.
    // Reapplying a template must never silently remove a closure already
    // established by the academic direction.
    if (periods.length > 0) {
      const { data: existingLocks, error: lockError } = await supabase
        .from("periodos_letivos")
        .select("id,numero,trava_notas_em")
        .eq("escola_id", escolaId)
        .eq("ano_letivo_id", targetId)
        .eq("tipo", "TRIMESTRE")
        .not("trava_notas_em", "is", null);
      if (lockError) throw lockError;
      if ((existingLocks ?? []).length > 0) {
        return NextResponse.json({
          ok: false, code: "ACADEMIC_PERIOD_LOCK_REVIEW_REQUIRED",
          error: "Existem trimestres com fecho de notas definido. Revise os prazos antes de reaplicar o calendário.",
        }, { status: 409 });
      }
    }

    if (periods.length > 0) {
      const { error } = await supabase.rpc("upsert_bulk_periodos_letivos", {
        p_escola_id: escolaId,
        p_periodos_data: periods,
      });
      if (error) throw error;
    }
    if (events.length > 0) {
      for (const event of events) {
        let existingQuery = db
          .from("calendario_eventos")
          .select("id")
          .eq("escola_id", event.escola_id)
          .eq("ano_letivo_id", event.ano_letivo_id)
          .eq("nome", event.nome)
          .eq("data_inicio", event.data_inicio);
        existingQuery = event.offering_id
          ? existingQuery.eq("offering_id", event.offering_id)
          : existingQuery.is("offering_id", null);
        const { data: existingEvent, error: existingError } = await existingQuery.maybeSingle();
        if (existingError) throw existingError;

        const result = existingEvent
          ? await db.from("calendario_eventos").update(event).eq("id", existingEvent.id)
          : await db.from("calendario_eventos").insert(event);
        if (result.error) throw result.error;
      }
    }

    // Publish the profile mapping only after the official dates and events
    // have persisted, so an RPC rejection cannot switch profiles prematurely.
    await Promise.all(scopedMappings.map(async (mapping) => {
      const { error: updateError } = await db
        .from("school_education_offerings")
        .update({ calendar_profile_id: mapping.template_id, updated_at: new Date().toISOString() })
        .eq("id", mapping.offering_id)
        .eq("escola_id", escolaId);
      if (updateError) throw updateError;
    }));

    return NextResponse.json({
      ok: true,
      reused: Boolean(existingTarget),
      target_session: { id: targetId, ano: primaryTemplate.ano_base, ativo: false, has_data: false },
      templates: templateList.map((template) => ({
        id: template.id,
        nome: template.nome,
        subsistema: template.subsistema,
      })),
      offerings: requestedMappings,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro interno";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
