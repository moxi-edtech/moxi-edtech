import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { createActivationToken } from "@/lib/activationLink";
import {
  authorizeWhatsappUser,
  hashPhone,
  isWahaEnabled,
  maskPhone,
  normalizeWhatsappPhone,
  withNoStore,
} from "@/lib/server/whatsappUtility";
import type { DBWithRPC } from "@/types/supabase-augment";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const schema = z.object({
  alunoId: z.string().uuid(),
  templateKey: z.string().trim().max(120).default("student_access_activation"),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await supabaseServerTyped<DBWithRPC>();
    const auth = await authorizeWhatsappUser(supabase, id);
    if (!auth.ok) return withNoStore(NextResponse.json({ ok: false, error: auth.error }, { status: auth.status }));
    if (!isWahaEnabled()) return withNoStore(NextResponse.json({ ok: false, error: "WhatsApp KLASSE está desativado neste ambiente." }, { status: 403 }));

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return withNoStore(NextResponse.json({ ok: false, error: "Payload inválido." }, { status: 400 }));

    const { data: provider } = await (supabase as any)
      .from("school_notification_providers")
      .select("status")
      .eq("school_id", auth.auth.escolaId)
      .eq("provider_type", "whatsapp_waha")
      .maybeSingle();
    if (!provider || provider.status !== "connected") {
      return withNoStore(NextResponse.json({ ok: false, error: "WhatsApp da escola está desconectado." }, { status: 409 }));
    }

    const { data: aluno, error: alunoError } = await (supabase as any)
      .from("alunos")
      .select("id,nome,codigo_ativacao,responsavel_nome,encarregado_nome,responsavel_contato,telefone_responsavel,encarregado_telefone,escola_id")
      .eq("id", parsed.data.alunoId)
      .eq("escola_id", auth.auth.escolaId)
      .maybeSingle();
    if (alunoError) throw alunoError;
    if (!aluno) return withNoStore(NextResponse.json({ ok: false, error: "Aluno não encontrado." }, { status: 404 }));
    if (!aluno.codigo_ativacao) {
      return withNoStore(NextResponse.json({ ok: false, error: "Aluno sem código de ativação seguro. Gere o acesso antes de enviar por WhatsApp." }, { status: 409 }));
    }

    const phone = aluno.responsavel_contato || aluno.telefone_responsavel || aluno.encarregado_telefone || null;
    const normalizedPhone = normalizeWhatsappPhone(phone);
    if (!normalizedPhone) return withNoStore(NextResponse.json({ ok: false, error: "Telefone do encarregado inválido." }, { status: 400 }));

    const { data: escola } = await (supabase as any)
      .from("escolas")
      .select("nome")
      .eq("id", auth.auth.escolaId)
      .maybeSingle();

    const token = createActivationToken({
      escola_id: auth.auth.escolaId,
      escola_nome: escola?.nome || "Escola",
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
    });
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://app.klasse.ao").replace(/\/$/, "");
    const activationParams = new URLSearchParams({ codigo: String(aluno.codigo_ativacao) });
    if (token) activationParams.set("token", token);
    const activationLink = `${appUrl}/ativar-acesso?${activationParams.toString()}`;

    const guardianName = aluno.responsavel_nome || aluno.encarregado_nome || "encarregado";
    const body = `Olá, ${guardianName}. Use este link seguro para ativar o acesso de ${aluno.nome}: ${activationLink}. O link é pessoal e deve ser usado apenas pelo encarregado.`;
    const now = new Date().toISOString();
    const idempotencyKey = `auth_provision_student:${aluno.id}:${crypto.randomUUID()}`;

    const { data, error } = await (supabase as any)
      .from("communication_outbox")
      .insert({
        school_id: auth.auth.escolaId,
        created_by: auth.auth.userId,
        provider: "waha",
        channel: "whatsapp",
        message_type: "auth_provision_student",
        source_module: "secretaria",
        source_entity_type: "alunos",
        source_entity_id: aluno.id,
        recipient_type: "encarregado",
        recipient_ref_id: aluno.id,
        recipient_name: guardianName,
        recipient_phone_masked: maskPhone(normalizedPhone),
        recipient_phone_hash: hashPhone(normalizedPhone),
        title: "Acesso ao Portal do Aluno",
        body,
        template_key: parsed.data.templateKey,
        metadata: { phone: normalizedPhone, aluno_id: aluno.id },
        status: "queued",
        risk_level: "low",
        requires_approval: false,
        idempotency_key: idempotencyKey,
        queued_at: now,
      })
      .select("id,status")
      .single();
    if (error) throw error;

    await (supabase as any).from("communication_logs").insert({
      outbox_id: data.id,
      school_id: auth.auth.escolaId,
      event_type: "outbox.student_access.created",
      provider: "waha",
      payload_sanitized: { aluno_id: aluno.id },
    });

    return withNoStore(NextResponse.json({ ok: true, data }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return withNoStore(NextResponse.json({ ok: false, error: message }, { status: 500 }));
  }
}
