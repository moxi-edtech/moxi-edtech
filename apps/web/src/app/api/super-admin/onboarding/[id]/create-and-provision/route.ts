import { NextResponse } from "next/server";
import { supabaseRouteClient } from "@/lib/supabaseServer";
import type { DBWithRPC } from "@/types/supabase-augment";
import { isSuperAdminRole } from "@/lib/auth/requireSuperAdminAccess";
import { CreateEscolaBodySchema, CreateSchoolError, finalizeSchoolAdminAndEmails } from "@/lib/escolas/create-school";

export const dynamic = "force-dynamic";

async function requireSuperAdmin() {
  const supabase = await supabaseRouteClient<DBWithRPC>();
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

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ ok: false, error: "ID de onboarding inválido" }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    const parsed = CreateEscolaBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Dados inválidos: " + parsed.error.issues[0]?.message }, { status: 400 });
    }

    const createAndProvisionBody = parsed.data;
    const nif = createAndProvisionBody.nif ? createAndProvisionBody.nif.replace(/\D/g, "") : null;
    const adminEmail = createAndProvisionBody.admin?.email ? createAndProvisionBody.admin.email.trim().toLowerCase() : null;
    const adminTelefone = createAndProvisionBody.admin?.telefone ? createAndProvisionBody.admin.telefone.replace(/\D/g, "") : null;
    const adminNome = createAndProvisionBody.admin?.nome ? createAndProvisionBody.admin.nome.trim() : null;

    const { data, error } = await auth.supabase.rpc("create_and_provision_escola_from_onboarding", {
      p_request_id: id,
      p_nome: createAndProvisionBody.nome,
      p_nif: nif,
      p_endereco: createAndProvisionBody.endereco ?? null,
      p_plano: createAndProvisionBody.plano ?? null,
      p_admin_email: adminEmail,
      p_admin_telefone: adminTelefone,
      p_admin_nome: adminNome,
      p_actor_id: auth.user.id,
    } as any);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message || "Falha ao criar e provisionar escola." }, { status: 400 });
    }

    const payload = data as {
      ok?: boolean;
      escola_id?: string;
      escola?: Record<string, unknown>;
      provision?: Record<string, unknown>;
    } | null;
    const escolaPayload = (payload?.escola ?? {}) as Record<string, unknown>;

    const escolaId = payload?.escola_id ?? ((escolaPayload.escolaId || escolaPayload.escola_id) as string | undefined) ?? null;
    if (!payload?.ok || !escolaId) {
      return NextResponse.json({ ok: false, error: "RPC não devolveu escola provisionada." }, { status: 500 });
    }

    const effects = await finalizeSchoolAdminAndEmails(req, auth.supabase, createAndProvisionBody, {
      payload: escolaPayload as any,
      escolaId,
      escolaNome: String((escolaPayload.escolaNome || escolaPayload.escola_nome || createAndProvisionBody.nome) ?? createAndProvisionBody.nome),
      adminEmail,
      adminTelefone,
      adminNome,
      adminPapel: createAndProvisionBody.admin?.papel ?? "admin",
    });

    return NextResponse.json({
      ok: true,
      escolaId,
      escola: payload?.escola ?? null,
      provision: payload?.provision ?? null,
      ...effects,
    });
  } catch (err) {
    if (err instanceof CreateSchoolError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: err.status });
    }

    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
