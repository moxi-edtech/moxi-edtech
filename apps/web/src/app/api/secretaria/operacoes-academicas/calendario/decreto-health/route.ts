import { NextRequest, NextResponse } from "next/server";

import { requireRoleInSchool } from "@/lib/authz";
import { auditDecreeSync, type DecreeSyncSnapshot } from "@/lib/academic-calendar/decree-sync-health";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import type { Database } from "~types/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Auditoria somente de leitura, disponível no contexto académico autorizado.
 * Não expõe identificadores de alunos e não aplica modelos, períodos ou eventos.
 * ano=2026 representa o ano letivo 2026/2027.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await supabaseServerTyped<Database>();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const escolaId = await resolveEscolaIdForUser(supabase, user.id);
    if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não identificada" }, { status: 403 });

    const authz = await requireRoleInSchool({
      supabase: supabase as any,
      escolaId,
      roles: ["admin", "admin_escola", "staff_admin", "admin_secretaria", "diretor", "secretaria"],
    });
    if (authz.error) return authz.error;

    const query = request.nextUrl.searchParams.get("ano");
    if (query && !/^20\d{2}$/.test(query)) {
      return NextResponse.json({ ok: false, error: "Informe o ano base, por exemplo 2026 para 2026/2027." }, { status: 400 });
    }
    let yearRequest = supabase
      .from("anos_letivos")
      .select("id,ano,data_inicio,data_fim,ativo")
      .eq("escola_id", escolaId);
    yearRequest = query ? yearRequest.eq("ano", Number(query)) : yearRequest.eq("ativo", true);
    const { data: year, error: yearError } = await yearRequest.maybeSingle();
    if (yearError) throw yearError;
    if (!year) {
      return NextResponse.json({
        ok: true, healthy: false,
        result: auditDecreeSync({ year: null, offerings: [], templates: [], periods: [], events: [] }),
      });
    }

    const db = supabase as any;
    const { data: offerings, error: offeringsError } = await db
      .from("school_education_offerings")
      .select("id,education_subsystem,calendar_profile_id")
      .eq("escola_id", escolaId)
      .eq("status", "active");
    if (offeringsError) throw offeringsError;

    const templateIds = [...new Set(
      ((offerings ?? []) as Array<{ calendar_profile_id: string | null }>)
        .map((o) => o.calendar_profile_id)
        .filter((value): value is string => Boolean(value)),
    )];

    const [templatesResult, periodsResult, eventsResult] = await Promise.all([
      templateIds.length
        ? db.from("calendario_templates")
          .select("id,ano_base,subsistema,data_inicio,data_fim,estado,is_oficial,versao_documento,fonte_documento_url,fonte_referencia,items:calendario_template_items(id,tipo,numero,nome,data_inicio,data_fim,peso,applies_to_all_offerings)")
          .in("id", templateIds)
        : Promise.resolve({ data: [], error: null }),
      db.from("periodos_letivos")
        .select("id,numero,tipo,data_inicio,data_fim,offering_id,source_template_id,source_item_id,source_version")
        .eq("escola_id", escolaId).eq("ano_letivo_id", year.id),
      db.from("calendario_eventos")
        .select("id,nome,tipo,data_inicio,data_fim,offering_id,source_template_id,source_item_id,source_version")
        .eq("escola_id", escolaId).eq("ano_letivo_id", year.id),
    ]);
    if (templatesResult.error) throw templatesResult.error;
    if (periodsResult.error) throw periodsResult.error;
    if (eventsResult.error) throw eventsResult.error;

    const snapshot: DecreeSyncSnapshot = {
      year: year as DecreeSyncSnapshot["year"],
      offerings: (offerings ?? []) as DecreeSyncSnapshot["offerings"],
      templates: (templatesResult.data ?? []) as DecreeSyncSnapshot["templates"],
      periods: (periodsResult.data ?? []) as DecreeSyncSnapshot["periods"],
      events: (eventsResult.data ?? []) as DecreeSyncSnapshot["events"],
    };
    const result = auditDecreeSync(snapshot);

    return NextResponse.json({
      ok: true,
      healthy: result.ok,
      result,
      read_only: true,
      checked_at: new Date().toISOString(),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Não foi possível auditar o calendário.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
