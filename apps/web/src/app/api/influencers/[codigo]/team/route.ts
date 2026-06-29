import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { supabaseRouteClient } from "@/lib/supabaseServer";
import { INFLUENCER_SESSION_COOKIE } from "@/lib/influencerSession";

export const dynamic = "force-dynamic";

const TeamRoleSchema = z.enum(["admin", "vendas", "implantacao", "suporte_l1", "operator"]);

const CreateMemberSchema = z.object({
  nome: z.string().trim().min(2, "Nome obrigatório"),
  pin: z.string().trim().min(4, "PIN deve ter pelo menos 4 dígitos"),
  role: TeamRoleSchema.default("vendas"),
  ativo: z.boolean().optional(),
});

const UpdateMemberSchema = z.object({
  memberId: z.string().uuid("Membro inválido"),
  nome: z.string().trim().min(2).optional(),
  pin: z.string().trim().min(4, "PIN deve ter pelo menos 4 dígitos").optional(),
  role: TeamRoleSchema.optional(),
  ativo: z.boolean().optional(),
});

async function requireInfluencerSession(codigo: string) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(INFLUENCER_SESSION_COOKIE)?.value ?? "";
  if (!sessionId) {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, error: "Sessão expirada." }, { status: 401 }),
    };
  }

  const supabase = await supabaseRouteClient();
  const { data, error } = await (supabase.rpc as any)("get_influencer_portal_session", {
    p_session_id: sessionId,
    p_codigo: codigo.trim().toUpperCase(),
  });

  if (error || !data?.ok || !data?.session) {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, error: "Sessão expirada." }, { status: 401 }),
    };
  }

  return { ok: true as const, session: data.session };
}

function rpcErrorMessage(error: unknown, fallback: string) {
  const message = error && typeof error === "object" && "message" in error
    ? String((error as { message?: unknown }).message ?? "")
    : "";

  if (message.includes("forbidden")) return "Apenas administradores do parceiro podem gerir a equipe.";
  if (message.includes("invalid_pin")) return "PIN inválido.";
  if (message.includes("invalid_role")) return "Papel inválido.";
  if (message.includes("member_not_found")) return "Membro não encontrado.";
  if (message.includes("cannot_disable_owner")) return "O proprietário principal não pode ser desativado.";
  return message || fallback;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ codigo: string }> }
) {
  const { codigo } = await context.params;
  const auth = await requireInfluencerSession(codigo);
  if (!auth.ok) return auth.response;

  const supabase = await supabaseRouteClient();
  const { data, error } = await (supabase.rpc as any)("list_influencer_members_by_session", {
    p_session_id: auth.session.id,
    p_codigo: auth.session.codigo,
  });

  if (error) {
    return NextResponse.json(
      { ok: false, error: rpcErrorMessage(error, "Falha ao carregar equipe.") },
      { status: error.code === "42501" ? 403 : 400 }
    );
  }

  return NextResponse.json({ ok: true, members: Array.isArray(data) ? data : [] });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ codigo: string }> }
) {
  const { codigo } = await context.params;
  const auth = await requireInfluencerSession(codigo);
  if (!auth.ok) return auth.response;

  const parsed = CreateMemberSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Payload inválido." },
      { status: 400 }
    );
  }

  const supabase = await supabaseRouteClient();
  const { data, error } = await (supabase.rpc as any)("create_influencer_member_by_session", {
    p_session_id: auth.session.id,
    p_codigo: auth.session.codigo,
    p_nome: parsed.data.nome,
    p_pin: parsed.data.pin,
    p_role: parsed.data.role,
    p_ativo: parsed.data.ativo ?? true,
  });

  if (error) {
    return NextResponse.json(
      { ok: false, error: rpcErrorMessage(error, "Falha ao criar membro.") },
      { status: error.code === "42501" ? 403 : 400 }
    );
  }

  return NextResponse.json({ ok: true, member: Array.isArray(data) ? data[0] ?? null : null });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ codigo: string }> }
) {
  const { codigo } = await context.params;
  const auth = await requireInfluencerSession(codigo);
  if (!auth.ok) return auth.response;

  const parsed = UpdateMemberSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Payload inválido." },
      { status: 400 }
    );
  }

  const supabase = await supabaseRouteClient();
  const { data, error } = await (supabase.rpc as any)("update_influencer_member_by_session", {
    p_session_id: auth.session.id,
    p_codigo: auth.session.codigo,
    p_member_id: parsed.data.memberId,
    p_nome: parsed.data.nome ?? null,
    p_role: parsed.data.role ?? null,
    p_ativo: parsed.data.ativo ?? null,
    p_pin: parsed.data.pin ?? null,
  });

  if (error) {
    return NextResponse.json(
      { ok: false, error: rpcErrorMessage(error, "Falha ao atualizar membro.") },
      { status: error.code === "42501" ? 403 : 400 }
    );
  }

  return NextResponse.json({ ok: true, member: Array.isArray(data) ? data[0] ?? null : null });
}
