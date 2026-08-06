import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { authorizeEscolaAction } from "@/lib/escola/disciplinas";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export const dynamic = "force-dynamic";

const StaffPermissions = ["criar_matricula", "gerenciar_turmas", "configurar_escola"];

const CreateSchema = z.object({
  ano_letivo: z.coerce.number().int().min(2000).max(2100),
  data_inicio: z.string().datetime(),
  data_fim: z.string().datetime(),
  ativa: z.boolean().optional().default(true),
  observacao: z.string().trim().max(500).optional().nullable(),
});

const PatchSchema = z.object({
  id: z.string().uuid(),
  ano_letivo: z.coerce.number().int().min(2000).max(2100).optional(),
  data_inicio: z.string().datetime().optional(),
  data_fim: z.string().datetime().optional(),
  ativa: z.boolean().optional(),
  observacao: z.string().trim().max(500).optional().nullable(),
});

const DeleteSchema = z.object({
  id: z.string().uuid(),
});

class IntakePolicyError extends Error {
  readonly status = 409;
}

async function requireAccess(req: Request) {
  const supabase = await supabaseServerTyped();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false as const, response: NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 }) };
  }

  const { searchParams } = new URL(req.url);
  const requestedEscolaId = searchParams.get("escolaId") || searchParams.get("escola_id") || null;
  const escolaId = await resolveEscolaIdForUser(supabase, user.id, requestedEscolaId);
  if (!escolaId) {
    return { ok: false as const, response: NextResponse.json({ ok: false, error: "Escola não encontrada" }, { status: 400 }) };
  }

  const authz = await authorizeEscolaAction(supabase as any, escolaId, user.id, StaffPermissions);
  if (!authz.allowed) {
    return { ok: false as const, response: NextResponse.json({ ok: false, error: authz.reason || "Sem permissão" }, { status: 403 }) };
  }

  return { ok: true as const, supabase, escolaId, userId: user.id };
}

function assertWindowDates(dataInicio: string, dataFim: string) {
  const inicio = new Date(dataInicio);
  const fim = new Date(dataFim);
  if (!Number.isFinite(inicio.getTime()) || !Number.isFinite(fim.getTime())) {
    throw new Error("Datas inválidas");
  }
  if (fim <= inicio) {
    throw new Error("A data final precisa ser posterior à data inicial");
  }
}

async function assertCoupledFutureIntake(access: { supabase: any; escolaId: string }, anoLetivo: number) {
  const [{ data: activeYear, error: activeYearError }, { data: school, error: schoolError }] = await Promise.all([
    access.supabase
      .from("anos_letivos")
      .select("ano")
      .eq("escola_id", access.escolaId)
      .eq("ativo", true)
      .maybeSingle(),
    access.supabase
      .from("escolas")
      .select("config_portal_admissao")
      .eq("id", access.escolaId)
      .maybeSingle(),
  ]);

  if (activeYearError) throw activeYearError;
  if (schoolError) throw schoolError;
  if (activeYear?.ano !== undefined && anoLetivo <= Number(activeYear.ano)) {
    throw new IntakePolicyError("A rematrícula só pode ser aberta para um ano posterior ao ano letivo ativo.");
  }

  const config = school?.config_portal_admissao;
  const formalYear = config && typeof config === "object" && !Array.isArray(config)
    ? Number((config as Record<string, unknown>).ano_letivo_formais_aberto)
    : NaN;
  if (!Number.isInteger(formalYear) || formalYear !== anoLetivo) {
    throw new IntakePolicyError("Abra primeiro as candidaturas formais do mesmo ano; candidaturas e rematrículas usam uma única janela.");
  }
}

export async function GET(req: Request) {
  try {
    const access = await requireAccess(req);
    if (!access.ok) return access.response;

    const [{ data: janelas, error: janelasError }, { data: anos, error: anosError }] = await Promise.all([
      (access.supabase as any)
        .from("rematricula_janelas")
        .select("id, escola_id, ano_letivo, data_inicio, data_fim, ativa, observacao, created_at, updated_at")
        .eq("escola_id", access.escolaId)
        .order("ano_letivo", { ascending: false })
        .order("data_inicio", { ascending: false }),
      access.supabase
        .from("anos_letivos")
        .select("id, ano, data_inicio, data_fim, ativo")
        .eq("escola_id", access.escolaId)
        .order("ano", { ascending: false })
        .limit(50),
    ]);

    if (janelasError) throw janelasError;
    if (anosError) throw anosError;

    return NextResponse.json({ ok: true, items: janelas ?? [], anos: anos ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ ok: false, error: message }, { status: err instanceof IntakePolicyError ? err.status : 500 });
  }
}

export async function POST(req: Request) {
  try {
    const access = await requireAccess(req);
    if (!access.ok) return access.response;

    const parsed = CreateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
    }

    assertWindowDates(parsed.data.data_inicio, parsed.data.data_fim);

    const { data: anoRow, error: anoError } = await access.supabase
      .from("anos_letivos")
      .select("ano")
      .eq("escola_id", access.escolaId)
      .eq("ano", parsed.data.ano_letivo)
      .maybeSingle();

    if (anoError) throw anoError;
    if (!anoRow) {
      return NextResponse.json({ ok: false, error: "Ano letivo não existe para esta escola" }, { status: 400 });
    }

    if (parsed.data.ativa) {
      await assertCoupledFutureIntake({ supabase: access.supabase as any, escolaId: access.escolaId }, parsed.data.ano_letivo);
    }

    const { data, error } = await (access.supabase as any)
      .from("rematricula_janelas")
      .insert({
        escola_id: access.escolaId,
        ano_letivo: parsed.data.ano_letivo,
        data_inicio: parsed.data.data_inicio,
        data_fim: parsed.data.data_fim,
        ativa: parsed.data.ativa,
        observacao: parsed.data.observacao || null,
        created_by: access.userId,
        updated_by: access.userId,
      })
      .select("id, escola_id, ano_letivo, data_inicio, data_fim, ativa, observacao, created_at, updated_at")
      .single();

    if (error) {
      const message = error.code === "23505"
        ? "Já existe uma janela ativa para este ano letivo. Desative ou edite a janela atual."
        : error.message;
      return NextResponse.json({ ok: false, error: message }, { status: error.code === "23505" ? 409 : 500 });
    }

    return NextResponse.json({ ok: true, item: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ ok: false, error: message }, { status: err instanceof IntakePolicyError ? err.status : 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const access = await requireAccess(req);
    if (!access.ok) return access.response;

    const parsed = PatchSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
    }

    if (parsed.data.data_inicio && parsed.data.data_fim) {
      assertWindowDates(parsed.data.data_inicio, parsed.data.data_fim);
    }

    let existingWindow: { ano_letivo: number; ativa: boolean } | null = null;
    if (parsed.data.ano_letivo !== undefined || parsed.data.ativa === true) {
      const { data: currentWindow, error: currentWindowError } = await (access.supabase as any)
        .from("rematricula_janelas")
        .select("ano_letivo, ativa")
        .eq("id", parsed.data.id)
        .eq("escola_id", access.escolaId)
        .maybeSingle();
      if (currentWindowError) throw currentWindowError;
      if (!currentWindow) return NextResponse.json({ ok: false, error: "Janela não encontrada" }, { status: 404 });
      existingWindow = currentWindow;
    }

    if (parsed.data.ano_letivo !== undefined) {
      const { data: anoRow, error: anoError } = await access.supabase
        .from("anos_letivos")
        .select("ano")
        .eq("escola_id", access.escolaId)
        .eq("ano", parsed.data.ano_letivo)
        .maybeSingle();

      if (anoError) throw anoError;
      if (!anoRow) {
        return NextResponse.json({ ok: false, error: "Ano letivo não existe para esta escola" }, { status: 400 });
      }
    }

    const effectiveYear = parsed.data.ano_letivo ?? existingWindow?.ano_letivo;
    const effectiveActive = parsed.data.ativa ?? existingWindow?.ativa;
    if (effectiveYear !== undefined && effectiveActive) {
      await assertCoupledFutureIntake({ supabase: access.supabase as any, escolaId: access.escolaId }, effectiveYear);
    }

    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      updated_by: access.userId,
    };
    for (const key of ["ano_letivo", "data_inicio", "data_fim", "ativa", "observacao"] as const) {
      if (parsed.data[key] !== undefined) patch[key] = parsed.data[key] || null;
    }

    const { data, error } = await (access.supabase as any)
      .from("rematricula_janelas")
      .update(patch)
      .eq("id", parsed.data.id)
      .eq("escola_id", access.escolaId)
      .select("id, escola_id, ano_letivo, data_inicio, data_fim, ativa, observacao, created_at, updated_at")
      .maybeSingle();

    if (error) {
      const message = error.code === "23505"
        ? "Já existe uma janela ativa para este ano letivo. Desative ou edite a janela atual."
        : error.message;
      return NextResponse.json({ ok: false, error: message }, { status: error.code === "23505" ? 409 : 500 });
    }
    if (!data) return NextResponse.json({ ok: false, error: "Janela não encontrada" }, { status: 404 });

    return NextResponse.json({ ok: true, item: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ ok: false, error: message }, { status: err instanceof IntakePolicyError ? err.status : 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const access = await requireAccess(req);
    if (!access.ok) return access.response;

    const parsed = DeleteSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
    }

    const { error, count } = await (access.supabase as any)
      .from("rematricula_janelas")
      .delete({ count: "exact" })
      .eq("id", parsed.data.id)
      .eq("escola_id", access.escolaId);

    if (error) throw error;
    if (!count) return NextResponse.json({ ok: false, error: "Janela não encontrada" }, { status: 404 });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
