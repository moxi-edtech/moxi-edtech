import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { recordAuditServer } from "@/lib/audit";
import { K12_FINANCEIRO_OPERACIONAL_ROLE_GROUP } from "@/lib/roles";
import { roleMatchesAllowedRoles } from "@/lib/permissions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => { const date = new Date(value + "T00:00:00Z"); return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value; }, "Data inválida");
const snapshotColumns = "id, escola_id, day_key, status, declared_by, declared_at, declared_cash, declared_tpa, declared_transfer, declared_mcx, system_cash, system_tpa, system_transfer, system_mcx";
const payloadSchema = z.object({
  escolaId: z.string().min(1).optional(),
  day_key: dateSchema,
  declared: z.object({
    cash: z.number().finite().nonnegative().max(9999999999.99),
    tpa: z.number().finite().nonnegative().max(9999999999.99),
    transfer: z.number().finite().nonnegative().max(9999999999.99),
    mcx: z.number().finite().nonnegative().max(9999999999.99),
  }),
});

export async function POST(request: Request) {
  try {
    const idempotencyKey =
      request.headers.get("Idempotency-Key") ?? request.headers.get("idempotency-key");
    if (!idempotencyKey) {
      return NextResponse.json(
        { ok: false, error: "Idempotency-Key header é obrigatório" },
        { status: 400 }
      );
    }

    const supabase = await supabaseServerTyped<any>();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const parsed = payloadSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ ok: false, error: "Dados do fecho inválidos" }, { status: 400 });
    const escolaId = await resolveEscolaIdForUser(supabase, user.id, parsed.data.escolaId);
    if (!escolaId) {
      return NextResponse.json({ ok: false, error: "Escola não identificada" }, { status: 403 });
    }

    const { data: membership, error: membershipError } = await supabase.from("escola_users").select("papel").eq("escola_id", escolaId).eq("user_id", user.id).maybeSingle();
    if (membershipError || !roleMatchesAllowedRoles(String(membership?.papel ?? ""), [...K12_FINANCEIRO_OPERACIONAL_ROLE_GROUP], "k12")) {
      return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 });
    }

    const { day_key, declared } = parsed.data;

    const { data: existing, error: existingError } = await supabase
      .from("fecho_caixa")
      .select(snapshotColumns)
      .eq("escola_id", escolaId)
      .eq("day_key", day_key)
      .maybeSingle();
    if (existingError) return NextResponse.json({ ok: false, error: "Não foi possível consultar o fecho." }, { status: 500 });
    if (existing) {
      return NextResponse.json({ ok: true, data: existing, idempotent: true });
    }

    const { data, error } = await supabase.rpc("financeiro_fecho_declarar_e_snapshot", {
      p_escola_id: escolaId,
      p_day_key: day_key,
      p_cash: declared.cash,
      p_tpa: declared.tpa,
      p_transfer: declared.transfer,
      p_mcx: declared.mcx,
    });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    await recordAuditServer({
      escolaId,
      portal: "financeiro",
      acao: "FECHO_DECLARADO",
      entity: "fecho_caixa",
      entityId: (data as any)?.id ?? null,
      details: { day_key, declared },
    }).catch(() => null);

    return NextResponse.json({ ok: true, data });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const date = dateSchema.safeParse(url.searchParams.get("date"));
  if (!date.success) return NextResponse.json({ ok: false, error: "Data inválida" }, { status: 400 });
  const supabase = await supabaseServerTyped<any>();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  const escolaId = await resolveEscolaIdForUser(supabase, user.id, url.searchParams.get("escolaId"));
  if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não identificada" }, { status: 403 });
  const { data: membership, error: membershipError } = await supabase.from("escola_users").select("papel").eq("escola_id", escolaId).eq("user_id", user.id).maybeSingle();
  if (membershipError || !roleMatchesAllowedRoles(String(membership?.papel ?? ""), [...K12_FINANCEIRO_OPERACIONAL_ROLE_GROUP], "k12")) {
    return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 });
  }
  const { data, error } = await supabase.from("fecho_caixa").select(snapshotColumns).eq("escola_id", escolaId).eq("day_key", date.data).maybeSingle();
  if (error) return NextResponse.json({ ok: false, error: "Não foi possível carregar a declaração." }, { status: 500 });
  return NextResponse.json({ ok: true, data }, { headers: { "Cache-Control": "private, no-store" } });
}
