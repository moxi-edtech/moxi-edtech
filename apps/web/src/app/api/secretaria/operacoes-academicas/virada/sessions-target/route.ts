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
  template_id: z.string().uuid(),
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

    return NextResponse.json({
      ok: true,
      current_session: anoAtivo,
      target_sessions: (futuros || []).map(s => ({
        ...s,
        has_data: sessionsWithData.has(s.id)
      })),
      official_templates: templates ?? [],
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
      return NextResponse.json({ ok: false, error: "Template oficial inválido" }, { status: 400 });
    }

    const [{ data: activeYear }, { data: template, error: templateError }] = await Promise.all([
      supabase
        .from("anos_letivos")
        .select("id,ano")
        .eq("escola_id", escolaId)
        .eq("ativo", true)
        .maybeSingle(),
      supabase
        .from("calendario_templates")
        .select("id,nome,ano_base,data_inicio,data_fim,subsistema,items:calendario_template_items(*)")
        .eq("id", parsed.data.template_id)
        .eq("is_oficial", true)
        .eq("estado", "PUBLICADO")
        .single(),
    ]);

    if (!activeYear) {
      return NextResponse.json({ ok: false, error: "Nenhum ano letivo ativo" }, { status: 409 });
    }
    if (templateError || !template) {
      return NextResponse.json({ ok: false, error: "Template oficial não encontrado" }, { status: 404 });
    }
    if (template.ano_base <= activeYear.ano) {
      return NextResponse.json({ ok: false, error: "O template deve ser posterior ao ano ativo" }, { status: 409 });
    }

    const { data: existingTarget } = await supabase
      .from("anos_letivos")
      .select("id,ano,ativo")
      .eq("escola_id", escolaId)
      .eq("ano", template.ano_base)
      .maybeSingle();

    let targetId = existingTarget?.id ?? null;
    if (!targetId) {
      const { data: created, error: createError } = await supabase.rpc("setup_active_ano_letivo", {
        p_escola_id: escolaId,
        p_ano_data: {
          ano: template.ano_base,
          data_inicio: template.data_inicio,
          data_fim: template.data_fim,
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
        .eq("ano", template.ano_base)
        .single();
      targetId = target?.id ?? null;
    }
    if (!targetId) throw new Error("Falha ao criar ano letivo de destino");

    const items = template.items ?? [];
    const periodType = items.some((item) => item.tipo === "PERIODO_LETIVO")
      ? "PERIODO_LETIVO"
      : "PROVA_TRIMESTRAL";
    const periods = items
      .filter((item) => item.tipo === periodType)
      .map((item) => ({
        ano_letivo_id: targetId,
        tipo: "TRIMESTRE",
        numero: item.numero,
        data_inicio: item.data_inicio,
        data_fim: item.data_fim,
        peso: item.peso,
      }));
    const events = items
      .filter((item) => item.tipo !== periodType)
      .map((item) => ({
        escola_id: escolaId,
        ano_letivo_id: targetId,
        tipo: item.tipo,
        nome: item.nome,
        data_inicio: item.data_inicio,
        data_fim: item.data_fim,
      }));

    if (periods.length > 0) {
      const { error } = await supabase.rpc("upsert_bulk_periodos_letivos", {
        p_escola_id: escolaId,
        p_periodos_data: periods,
      });
      if (error) throw error;
    }
    if (events.length > 0) {
      const { error } = await supabase
        .from("calendario_eventos")
        .upsert(events, { onConflict: "escola_id,ano_letivo_id,nome,data_inicio" });
      if (error) throw error;
    }

    return NextResponse.json({
      ok: true,
      reused: Boolean(existingTarget),
      target_session: { id: targetId, ano: template.ano_base, ativo: false, has_data: false },
      template: { id: template.id, nome: template.nome, subsistema: template.subsistema },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro interno";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
