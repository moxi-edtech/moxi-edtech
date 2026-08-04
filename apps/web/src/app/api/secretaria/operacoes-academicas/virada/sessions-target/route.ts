// @kf2 allow-scan
// apps/web/src/app/api/secretaria/operacoes-academicas/virada/sessions-target/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeEscolaAction } from "@/lib/escola/disciplinas";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import type { Database } from "~types/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CreateTargetBody = z.object({
  template_id: z.string().uuid().optional(),
  offerings: z.array(z.object({
    offering_id: z.string().uuid(),
    template_id: z.string().uuid(),
  })).min(1).optional(),
}).refine((value) => Boolean(value.template_id || value.offerings?.length), {
  message: "Selecione pelo menos um perfil regulatório",
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

    const { data: templates } = await supabase
      .from("calendario_templates")
      .select("id,nome,ano_base,data_inicio,data_fim,subsistema,versao_documento")
      .eq("is_oficial", true)
      .eq("estado", "PUBLICADO")
      .gt("ano_base", anoAtivo?.ano || 0)
      .order("ano_base", { ascending: true })
      .order("subsistema", { ascending: true });

    const { data: offerings } = await (supabase as any)
      .from("school_education_offerings")
      .select("id,course_id,education_subsystem,education_level,cycle,grades,calendar_profile_id,status")
      .eq("escola_id", escolaId)
      .eq("status", "active")
      .order("education_subsystem", { ascending: true });

    return NextResponse.json({
      ok: true,
      current_session: anoAtivo,
      target_sessions: (futuros || []).map(s => ({
        ...s,
        has_data: sessionsWithData.has(s.id)
      })),
      official_templates: templates ?? [],
      education_offerings: offerings ?? [],
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
    if (activeYear && templateList.some((template) => template.ano_base <= activeYear.ano)) {
      return NextResponse.json({ ok: false, error: "O template deve ser posterior ao ano ativo" }, { status: 409 });
    }

    const primaryTemplate = templateList[0];
    const { data: existingTarget } = await supabase
      .from("anos_letivos")
      .select("id,ano,ativo")
      .eq("escola_id", escolaId)
      .eq("ano", primaryTemplate.ano_base)
      .maybeSingle();

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
