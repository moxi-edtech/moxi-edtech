import { NextResponse } from "next/server";
import { authorizeEscolaAction } from "@/lib/escola/disciplinas";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import type { Database } from "~types/supabase";
import { z } from "zod";
import { recordAuditServer } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const OpenIntakeSchema = z.object({
  ano_letivo: z.number().int().min(2000).max(2100),
  data_inicio: z.string().datetime(),
  data_fim: z.string().datetime(),
}).refine((value) => new Date(value.data_fim) > new Date(value.data_inicio), {
  message: "A data final precisa ser posterior à data inicial",
  path: ["data_fim"],
});

export async function GET() {
  try {
    const supabase = await supabaseServerTyped<Database>();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const escolaId = await resolveEscolaIdForUser(supabase, user.id);
    if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não identificada" }, { status: 403 });
    const authz = await authorizeEscolaAction(supabase as any, escolaId, user.id, ["configurar_escola", "criar_matricula"]);
    if (!authz.allowed) return NextResponse.json({ ok: false, error: authz.reason || "Sem permissão" }, { status: 403 });

    const db = supabase as any;
    const [{ data: activeYear }, { data: school }] = await Promise.all([
      db.from("anos_letivos")
        .select("id,ano,ativo,data_inicio,data_fim")
        .eq("escola_id", escolaId)
        .eq("ativo", true)
        .order("ano", { ascending: false })
        .limit(1)
        .maybeSingle(),
      db.from("escolas").select("config_portal_admissao").eq("id", escolaId).maybeSingle(),
    ]);

    const currentYear = Number(activeYear?.ano);
    const nextYear = Number.isInteger(currentYear) ? currentYear + 1 : null;
    const now = new Date().toISOString();
    const targetYear = nextYear
      ? (await db.from("anos_letivos").select("id,ano,ativo,data_inicio,data_fim").eq("escola_id", escolaId).eq("ano", nextYear).maybeSingle()).data
      : null;

    const [readinessResult, windowResult, pendingResult, candidatureResult] = await Promise.all([
      targetYear
        ? db.rpc("get_school_operational_readiness", { p_escola_id: escolaId, p_ano_letivo: nextYear })
        : Promise.resolve({ data: null, error: null }),
      nextYear
        ? db.from("rematricula_janelas")
          .select("id,ano_letivo,data_inicio,data_fim,ativa")
          .eq("escola_id", escolaId)
          .eq("ano_letivo", nextYear)
          .eq("ativa", true)
          .lte("data_inicio", now)
          .gte("data_fim", now)
          .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      db.from("matricula_reclassificacoes")
        .select("id", { count: "exact", head: true })
        .eq("escola_id", escolaId)
        .eq("status", "aguardando_destino"),
      nextYear
        ? db.from("candidaturas")
          .select("id", { count: "exact", head: true })
          .eq("escola_id", escolaId)
          .eq("ano_letivo", nextYear)
          .not("status", "eq", "rejeitada")
        : Promise.resolve({ count: 0, error: null }),
    ]);

    const config = school?.config_portal_admissao && typeof school.config_portal_admissao === "object"
      ? school.config_portal_admissao as Record<string, unknown>
      : {};
    const mode = config.modo_portal_admissoes === "ingresso_imediato"
      ? "ingresso_imediato"
      : "pre_candidatura_proximo_ano";
    const configuredAdmissionsYear = Number(config.ano_letivo_admissoes);
    const formalAdmissionsOpen = Boolean(
      nextYear && Number.isInteger(configuredAdmissionsYear) && configuredAdmissionsYear === nextYear
        && (config.ano_letivo_formais_aberto === nextYear || mode === "ingresso_imediato"),
    );
    const readiness = readinessResult?.data ?? null;
    const readinessOk = Boolean(readiness?.ok && readiness?.badges?.curriculo_published_ok && readiness?.badges?.turmas_ok && readiness?.badges?.precos_ok);
    const rematriculaWindowOpen = Boolean(windowResult?.data);
    const steps = {
      next_year_created: Boolean(targetYear),
      academic_structure_ready: readinessOk,
      rematricula_window_open: rematriculaWindowOpen,
      formal_admissions_open: formalAdmissionsOpen,
      intake_window_open: rematriculaWindowOpen && formalAdmissionsOpen,
      pending_reclassification: Number(pendingResult?.count ?? 0),
      candidates_next_year: Number(candidatureResult?.count ?? 0),
    };

    const primaryAction = !steps.next_year_created
      ? { label: `Preparar ano letivo ${nextYear ?? "seguinte"}`, href: "/admin/operacoes-academicas/wizard", kind: "prepare_year" }
      : !steps.academic_structure_ready
        ? { label: "Concluir preparação académica", href: "/admin/configuracoes/fluxos", kind: "prepare_structure" }
        : steps.pending_reclassification > 0
          ? { label: `Resolver ${steps.pending_reclassification} finalistas`, href: "/operacoes/academico/reclassificacao-finalistas", kind: "resolve_finalists" }
          : !steps.intake_window_open
            ? { label: `Abrir inscrições e rematrículas ${nextYear ?? ""}`.trim(), href: "/admin/configuracoes/fluxos", kind: "open_intake" }
            : { label: "Ver operação do próximo ano", href: "/operacoes/rematricula", kind: "review" };

    return NextResponse.json({ ok: true, current_year: currentYear || null, next_year: nextYear, target_year: targetYear, mode, steps, primary_action: primaryAction });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Erro interno" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await supabaseServerTyped<Database>();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const escolaId = await resolveEscolaIdForUser(supabase, user.id);
    if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não identificada" }, { status: 403 });
    const authz = await authorizeEscolaAction(supabase as any, escolaId, user.id, ["configurar_escola", "criar_matricula"]);
    if (!authz.allowed) return NextResponse.json({ ok: false, error: authz.reason || "Sem permissão" }, { status: 403 });

    const parsed = OpenIntakeSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || "Dados inválidos" }, { status: 400 });

    const { ano_letivo, data_inicio, data_fim } = parsed.data;
    const db = supabase as any;
    const [{ data: targetYear }, { data: school }] = await Promise.all([
      db.from("anos_letivos").select("id,ano,ativo").eq("escola_id", escolaId).eq("ano", ano_letivo).maybeSingle(),
      db.from("escolas").select("config_portal_admissao").eq("id", escolaId).maybeSingle(),
    ]);
    if (!targetYear) return NextResponse.json({ ok: false, error: "Prepare este ano letivo antes de abrir inscrições." }, { status: 409 });

    const { data: readiness, error: readinessError } = await db.rpc("get_school_operational_readiness", {
      p_escola_id: escolaId,
      p_ano_letivo: ano_letivo,
    });
    if (readinessError || !readiness?.ok) return NextResponse.json({ ok: false, error: "Conclua a preparação académica antes de abrir inscrições." }, { status: 409 });
    const badges = readiness.badges ?? {};
    const missing = [
      !badges.curriculo_published_ok ? "currículo" : null,
      !badges.turmas_ok ? "turmas" : null,
      !badges.precos_ok ? "tabela de preços" : null,
    ].filter(Boolean);
    if (missing.length) return NextResponse.json({ ok: false, error: `Conclua: ${missing.join(", ")}.`, missing }, { status: 409 });

    const currentConfig = school?.config_portal_admissao && typeof school.config_portal_admissao === "object"
      ? school.config_portal_admissao as Record<string, unknown>
      : {};
    const nextConfig = {
      ...currentConfig,
      ano_letivo_admissoes: ano_letivo,
      ano_letivo_formais_aberto: ano_letivo,
      modo_portal_admissoes: "ingresso_imediato",
    };
    const { error: configError } = await db.from("escolas").update({ config_portal_admissao: nextConfig }).eq("id", escolaId);
    if (configError) throw configError;

    const { data: existingWindow } = await db.from("rematricula_janelas").select("id").eq("escola_id", escolaId).eq("ano_letivo", ano_letivo).maybeSingle();
    const windowPayload = { data_inicio, data_fim, ativa: true, updated_at: new Date().toISOString(), updated_by: user.id };
    const windowMutation = existingWindow
      ? db.from("rematricula_janelas").update(windowPayload).eq("id", existingWindow.id).eq("escola_id", escolaId)
      : db.from("rematricula_janelas").insert({ escola_id: escolaId, ano_letivo, ...windowPayload, created_by: user.id });
    const { error: windowError } = await windowMutation;
    if (windowError) throw windowError;

    recordAuditServer({ escolaId, portal: "secretaria", acao: "ABRIR_INSCRICOES_E_REMATRICULAS", entity: "anos_letivos", entityId: targetYear.id, details: { ano_letivo, data_inicio, data_fim } }).catch(() => null);
    return NextResponse.json({ ok: true, ano_letivo, data_inicio, data_fim, candidaturas_formais_abertas: true, rematriculas_abertas: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Erro interno" }, { status: 500 });
  }
}
