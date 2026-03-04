import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import type { Database } from "~types/supabase";
import { requireRoleInSchool } from "@/lib/authz";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const QuerySchema = z.object({
  ano_letivo_id: z.string().uuid(),
  matricula_id: z.string().uuid().optional(),
  status: z.enum(["aberto", "fechado", "reaberto"]).optional(),
});

const PatchSchema = z.object({
  ano_letivo_id: z.string().uuid(),
  matricula_ids: z.array(z.string().uuid()).min(1),
  novo_estado: z.enum(["aberto", "fechado", "reaberto"]),
  motivo: z.string().max(1000),
  run_id: z.string().uuid().optional(),
});

export async function GET(req: Request) {
  try {
    const supabase = await supabaseServerTyped<Database>();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id);
    if (!escolaId) return NextResponse.json({ ok: false, error: "Escola inválida" }, { status: 403 });

    const url = new URL(req.url);
    const parsed = QuerySchema.safeParse({
      ano_letivo_id: url.searchParams.get("ano_letivo_id"),
      matricula_id: url.searchParams.get("matricula_id") || undefined,
      status: (url.searchParams.get("status") as "aberto" | "fechado" | "reaberto" | null) ?? undefined,
    });
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Parâmetros inválidos" }, { status: 400 });
    }

    let query = supabase
      .from("vw_historico_snapshot_status")
      .select("escola_id,ano_letivo_id,matricula_id,historico_ano_id,status,lock_run_id,lock_step,lock_reason,locked_at,reopened_at,reopened_by,reopened_reason,allow_reopen,updated_at")
      .eq("escola_id", escolaId)
      .eq("ano_letivo_id", parsed.data.ano_letivo_id)
      .order("updated_at", { ascending: false })
      .limit(200);

    if (parsed.data.matricula_id) query = query.eq("matricula_id", parsed.data.matricula_id);
    if (parsed.data.status) query = query.eq("status", parsed.data.status);

    const { data, error } = await query;
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true, snapshots: data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const payload = PatchSchema.safeParse(await req.json().catch(() => null));
    if (!payload.success) {
      return NextResponse.json({ ok: false, error: payload.error.issues[0]?.message ?? "Payload inválido" }, { status: 400 });
    }

    const supabase = await supabaseServerTyped<Database>();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id);
    if (!escolaId) return NextResponse.json({ ok: false, error: "Escola inválida" }, { status: 403 });

    const roleCheck = await requireRoleInSchool({
      supabase,
      escolaId,
      roles: ["admin", "admin_escola", "staff_admin"],
    });
    if (roleCheck.error) return roleCheck.error;

    const { data, error } = await supabase.rpc("historico_set_snapshot_state", {
      p_escola_id: escolaId,
      p_matricula_ids: payload.data.matricula_ids,
      p_ano_letivo_id: payload.data.ano_letivo_id,
      p_novo_estado: payload.data.novo_estado,
      p_motivo: payload.data.motivo,
      p_run_id: payload.data.run_id ?? undefined,
    });

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true, result: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
