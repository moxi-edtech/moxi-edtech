import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseRouteClient } from "@/lib/supabaseServer";
import { isSuperAdminRole } from "@/lib/auth/requireSuperAdminAccess";

export const dynamic = "force-dynamic";

const CreateMemberSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(2, "Nome obrigatório")
    .refine((value) => !/.+@.+\..+/.test(value), "Nome do membro não pode ser um email"),
  pin: z.string().trim().min(4, "PIN inválido"),
  ativo: z.boolean().optional(),
});

const ToggleMemberSchema = z.object({
  memberId: z.string().uuid("ID de membro inválido"),
  ativo: z.boolean(),
});

const DeleteMemberSchema = z.object({
  memberId: z.string().uuid("ID de membro inválido"),
});

async function requireSuperAdmin() {
  const supabase = await supabaseRouteClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false as const, response: NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 }) };
  }

  let role = user.app_metadata?.role ?? user.user_metadata?.role ?? null;
  if (!role) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("user_id", user.id).maybeSingle();
    role = profile?.role ?? null;
  }

  if (!isSuperAdminRole(typeof role === "string" ? role : null)) {
    return { ok: false as const, response: NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 }) };
  }

  return { ok: true as const, supabase, user };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ ok: false, error: "ID do parceiro inválido" }, { status: 400 });
  }

  const { data, error } = await (auth.supabase.rpc as any)("list_influencer_members_admin", {
    p_afiliado_id: id,
  });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, items: data ?? [] });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ ok: false, error: "ID do parceiro inválido" }, { status: 400 });
  }

  const parsed = CreateMemberSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Payload inválido" }, { status: 400 });
  }

  const { data, error } = await (auth.supabase.rpc as any)("create_influencer_member_admin", {
    p_afiliado_id: id,
    p_nome: parsed.data.nome,
    p_pin: parsed.data.pin,
    p_ativo: parsed.data.ativo ?? true,
  });

  if (error) {
    const status = error.code === "23505" ? 409 : 400;
    return NextResponse.json({ ok: false, error: error.message }, { status });
  }

  return NextResponse.json({
    ok: true,
    member: Array.isArray(data) ? data[0] ?? null : null,
  });
}

export async function PATCH(
  request: Request,
  _context: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await _context.params;
  if (!id) {
    return NextResponse.json({ ok: false, error: "ID do parceiro inválido" }, { status: 400 });
  }

  const parsed = ToggleMemberSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Payload inválido" }, { status: 400 });
  }

  const { data, error } = await (auth.supabase
    .from("afiliado_membros" as any)
    .update({
      ativo: parsed.data.ativo,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.memberId)
    .eq("afiliado_id", id)
    .select("id, afiliado_id, nome, ativo, created_at, updated_at")
    .single() as any);

  if (error || !data) {
    return NextResponse.json({ ok: false, error: error?.message || "Membro não encontrado" }, { status: 400 });
  }

  try {
    await auth.supabase.from("audit_logs" as any).insert({
      user_id: auth.user.id,
      portal: "super_admin",
      action: "AFILIADO_MEMBRO_STATUS_ALTERADO",
      entity: "afiliado_membros",
      entity_id: parsed.data.memberId,
      details: {
        afiliado_id: id,
        ativo: parsed.data.ativo,
      },
    });
  } catch {
    // ignore
  }

  return NextResponse.json({
    ok: true,
    member: data,
  });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ ok: false, error: "ID do parceiro inválido" }, { status: 400 });
  }

  const parsed = DeleteMemberSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Payload inválido" }, { status: 400 });
  }

  const { data: member, error: readError } = await (auth.supabase
    .from("afiliado_membros" as any)
    .select("id, afiliado_id, nome, ativo, created_at, updated_at")
    .eq("id", parsed.data.memberId)
    .eq("afiliado_id", id)
    .single() as any);

  if (readError || !member) {
    return NextResponse.json({ ok: false, error: "Membro não encontrado" }, { status: 404 });
  }

  const { count, error: usageError } = await (auth.supabase
    .from("onboarding_uploads" as any)
    .select("id", { count: "exact", head: true })
    .eq("criado_por_membro_id", parsed.data.memberId) as any);

  if (usageError) {
    return NextResponse.json({ ok: false, error: usageError.message }, { status: 400 });
  }

  if ((count || 0) > 0) {
    return NextResponse.json({ ok: false, error: "Este membro já possui uploads associados. Inative-o em vez de apagar." }, { status: 409 });
  }

  const { error: deleteError } = await auth.supabase
    .from("afiliado_membros" as any)
    .delete()
    .eq("id", parsed.data.memberId)
    .eq("afiliado_id", id);

  if (deleteError) {
    return NextResponse.json({ ok: false, error: deleteError.message }, { status: 400 });
  }

  try {
    await auth.supabase.from("audit_logs" as any).insert({
      user_id: auth.user.id,
      portal: "super_admin",
      action: "AFILIADO_MEMBRO_REMOVIDO",
      entity: "afiliado_membros",
      entity_id: parsed.data.memberId,
      details: {
        afiliado_id: id,
        nome: member.nome,
      },
    });
  } catch {
    // ignore
  }

  return NextResponse.json({
    ok: true,
    member,
  });
}
