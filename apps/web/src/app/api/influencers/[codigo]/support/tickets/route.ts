import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { supabaseRouteClient } from "@/lib/supabaseServer";
import { INFLUENCER_SESSION_COOKIE } from "@/lib/influencerSession";

export const dynamic = "force-dynamic";

const ChannelSchema = z.enum(["whatsapp", "telefone", "email", "presencial", "portal", "outro"]);
const CategorySchema = z.enum(["acesso", "pagamentos", "matriculas", "notas", "documentos", "operacional", "tecnico", "outro"]);
const SeveritySchema = z.enum(["alta", "media", "baixa"]);
const StatusSchema = z.enum(["aberto", "em_atendimento", "aguardando_cliente", "escalado_klasse", "resolvido"]);

const CreateTicketSchema = z.object({
  onboarding_token: z.string().trim().optional().nullable(),
  escola_nome: z.string().trim().optional().nullable(),
  canal: ChannelSchema.default("whatsapp"),
  categoria: CategorySchema.default("operacional"),
  gravidade: SeveritySchema.default("media"),
  titulo: z.string().trim().min(3, "Título obrigatório"),
  descricao: z.string().trim().optional().nullable(),
  responsavel_membro_id: z.string().uuid().optional().nullable(),
});

const UpdateTicketSchema = z.object({
  ticket_id: z.string().uuid("Ticket inválido"),
  status: StatusSchema.optional().nullable(),
  responsavel_membro_id: z.string().uuid().optional().nullable(),
  note: z.string().trim().optional().nullable(),
  escalation_reason: z.string().trim().optional().nullable(),
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

  if (message.includes("invalid_channel")) return "Canal inválido.";
  if (message.includes("invalid_category")) return "Categoria inválida.";
  if (message.includes("invalid_severity")) return "Gravidade inválida.";
  if (message.includes("invalid_status")) return "Estado inválido.";
  if (message.includes("invalid_title")) return "Informe um título para o ticket.";
  if (message.includes("invalid_school")) return "Informe a escola ou selecione uma ativação.";
  if (message.includes("onboarding_not_found")) return "Ativação não encontrada para este parceiro.";
  if (message.includes("responsavel_not_found")) return "Responsável não encontrado nesta equipe.";
  if (message.includes("ticket_not_found")) return "Ticket não encontrado.";
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
  const { data, error } = await (supabase.rpc as any)("list_influencer_support_tickets", {
    p_session_id: auth.session.id,
    p_codigo: auth.session.codigo,
  });

  if (error || !data?.ok) {
    return NextResponse.json(
      { ok: false, error: rpcErrorMessage(error, "Falha ao carregar tickets de suporte.") },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    tickets: Array.isArray(data.tickets) ? data.tickets : [],
    summary: data.summary ?? null,
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ codigo: string }> }
) {
  const { codigo } = await context.params;
  const auth = await requireInfluencerSession(codigo);
  if (!auth.ok) return auth.response;

  const parsed = CreateTicketSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Payload inválido." },
      { status: 400 }
    );
  }

  const supabase = await supabaseRouteClient();
  const { data, error } = await (supabase.rpc as any)("create_influencer_support_ticket", {
    p_session_id: auth.session.id,
    p_codigo: auth.session.codigo,
    p_onboarding_token: parsed.data.onboarding_token || null,
    p_escola_nome: parsed.data.escola_nome || null,
    p_canal: parsed.data.canal,
    p_categoria: parsed.data.categoria,
    p_gravidade: parsed.data.gravidade,
    p_titulo: parsed.data.titulo,
    p_descricao: parsed.data.descricao || null,
    p_responsavel_membro_id: parsed.data.responsavel_membro_id || null,
  });

  if (error || !data?.ok) {
    return NextResponse.json(
      { ok: false, error: rpcErrorMessage(error, "Falha ao criar ticket de suporte.") },
      { status: error?.code === "42501" ? 403 : 400 }
    );
  }

  return NextResponse.json({ ok: true, ticket_id: data.ticket_id });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ codigo: string }> }
) {
  const { codigo } = await context.params;
  const auth = await requireInfluencerSession(codigo);
  if (!auth.ok) return auth.response;

  const parsed = UpdateTicketSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Payload inválido." },
      { status: 400 }
    );
  }

  const supabase = await supabaseRouteClient();
  const { data, error } = await (supabase.rpc as any)("update_influencer_support_ticket", {
    p_session_id: auth.session.id,
    p_codigo: auth.session.codigo,
    p_ticket_id: parsed.data.ticket_id,
    p_status: parsed.data.status || null,
    p_responsavel_membro_id: parsed.data.responsavel_membro_id || null,
    p_note: parsed.data.note || null,
    p_escalation_reason: parsed.data.escalation_reason || null,
  });

  if (error || !data?.ok) {
    return NextResponse.json(
      { ok: false, error: rpcErrorMessage(error, "Falha ao atualizar ticket de suporte.") },
      { status: error?.code === "42501" ? 403 : 400 }
    );
  }

  return NextResponse.json({ ok: true });
}
