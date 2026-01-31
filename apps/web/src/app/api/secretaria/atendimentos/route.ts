import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { requireRoleInSchool } from "@/lib/authz";
import { applyKf2ListInvariants } from "@/lib/kf2";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ALLOWED_ROLES = ["secretaria", "admin", "admin_escola", "staff_admin"] as const;

const CreateSchema = z.object({
  aluno_id: z.string().uuid().nullable().optional(),
  motivo: z.string().trim().min(3),
});

export async function GET(request: Request) {
  try {
    const supabase = await supabaseServerTyped<any>();
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id);
    if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não encontrada" }, { status: 400 });

    const { error: authError } = await requireRoleInSchool({
      supabase,
      escolaId,
      roles: [...ALLOWED_ROLES],
    });
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const operadorId = searchParams.get("operador_id");

    let query = supabase
      .from("atendimentos_balcao")
      .select(
        "id, escola_id, aluno_id, operador_id, status, motivo, resolucao, iniciado_em, finalizado_em, created_at, updated_at, alunos(nome, nome_completo, bi_numero)"
      )
      .eq("escola_id", escolaId)
      .order("iniciado_em", { ascending: false });

    if (status) query = query.eq("status", status);
    if (operadorId) query = query.eq("operador_id", operadorId);

    query = applyKf2ListInvariants(query, { defaultLimit: 50 });

    const { data, error } = await query;
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true, items: data ?? [] });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await supabaseServerTyped<any>();
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id);
    if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não encontrada" }, { status: 400 });

    const { error: authError } = await requireRoleInSchool({
      supabase,
      escolaId,
      roles: [...ALLOWED_ROLES],
    });
    if (authError) return authError;

    const payload = await request.json().catch(() => ({}));
    const parsed = CreateSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues?.[0]?.message || "Payload inválido" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("atendimentos_balcao")
      .insert({
        escola_id: escolaId,
        aluno_id: parsed.data.aluno_id ?? null,
        operador_id: user.id,
        motivo: parsed.data.motivo,
        status: "aberto",
      })
      .select("id")
      .single();

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true, id: data?.id });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
