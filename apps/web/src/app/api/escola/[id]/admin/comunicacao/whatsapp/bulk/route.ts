import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import {
  authorizeWhatsappUser,
  hashPhone,
  inferApproval,
  interpolateTemplate,
  isWahaEnabled,
  maskPhone,
  normalizeWhatsappPhone,
  userHasAnyRole,
  WHATSAPP_FINANCE_ROLES,
  withNoStore,
} from "@/lib/server/whatsappUtility";
import type { DBWithRPC } from "@/types/supabase-augment";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const schema = z.object({
  messageType: z.enum(["school_notice", "finance_charge"]),
  title: z.string().trim().min(1).max(160),
  body: z.string().trim().max(2000).optional().nullable(),
  templateKey: z.string().trim().max(120).optional().nullable(),
  noticeBody: z.string().trim().max(1600).optional().nullable(),
  filters: z.object({
    alunoIds: z.array(z.string().uuid()).max(50).optional().default([]),
    turmaId: z.string().uuid().optional().nullable(),
    classeId: z.string().uuid().optional().nullable(),
    statusMatricula: z.string().trim().max(40).optional().nullable(),
    financialGroup: z.enum(["inadimplentes"]).optional().nullable(),
  }),
  expectedCount: z.number().int().min(1).max(50),
});

type Recipient = {
  alunoId: string;
  name: string;
  studentName: string;
  phone: string | null;
  amount?: number | null;
};
type RiskLevel = "low" | "medium" | "high";

type ServerSupabase = SupabaseClient<DBWithRPC>;
type TemplateRow = {
  key: string;
  title: string;
  body: string;
  risk_level: RiskLevel;
  requires_approval: boolean;
  allowed_roles: string[];
};
type CommunicationOutboxInsert = DBWithRPC["public"]["Tables"]["communication_outbox"]["Insert"];
type StudentContactRow = {
  id: string;
  nome: string | null;
  responsavel_nome: string | null;
  encarregado_nome: string | null;
  responsavel_contato: string | null;
  telefone_responsavel: string | null;
  encarregado_telefone: string | null;
};
type FinanceRecipientRow = {
  aluno_id: string;
  aluno_nome: string | null;
  responsavel_nome: string | null;
  telefone_responsavel: string | null;
  valor_total_atraso: number | string | null;
};

async function loadProvider(supabase: ServerSupabase, escolaId: string) {
  const { data, error } = await supabase
    .from("school_notification_providers")
    .select("status")
    .eq("school_id", escolaId)
    .eq("provider_type", "whatsapp_waha")
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

async function templateAllowedForUser(supabase: ServerSupabase, escolaId: string, allowedRoles: unknown) {
  if (!Array.isArray(allowedRoles) || allowedRoles.length === 0) return true;
  const roles = allowedRoles.map((role) => String(role)).filter(Boolean);
  if (roles.length === 0) return true;
  return userHasAnyRole(supabase, escolaId, roles);
}

async function loadStudentsByIds(supabase: ServerSupabase, escolaId: string, alunoIds: string[]) {
  if (alunoIds.length === 0) return [];
  const { data, error } = await supabase
    .from("alunos")
    .select("id,nome,responsavel_nome,encarregado_nome,responsavel_contato,telefone_responsavel,encarregado_telefone")
    .eq("escola_id", escolaId)
    .in("id", alunoIds)
    .limit(50);
  if (error) throw error;
  const rows = Array.isArray(data) ? data as StudentContactRow[] : [];
  return rows.map((row): Recipient => ({
    alunoId: row.id,
    name: row.responsavel_nome || row.encarregado_nome || `Encarregado de ${row.nome}`,
    studentName: row.nome || "Aluno",
    phone: row.responsavel_contato || row.telefone_responsavel || row.encarregado_telefone || null,
  }));
}

async function loadStudentsByMatriculaFilters(
  supabase: ServerSupabase,
  escolaId: string,
  filters: z.infer<typeof schema>["filters"]
) {
  let turmaIds: string[] | null = null;
  if (filters.classeId) {
    const { data: turmas, error } = await supabase
      .from("turmas")
      .select("id")
      .eq("escola_id", escolaId)
      .eq("classe_id", filters.classeId)
      .limit(100);
    if (error) throw error;
    const turmaRows = Array.isArray(turmas) ? turmas as Array<{ id?: unknown }> : [];
    const nextTurmaIds = turmaRows.map((row) => row.id).filter((value): value is string => typeof value === "string");
    if (nextTurmaIds.length === 0) return [];
    turmaIds = nextTurmaIds;
  }

  let query = supabase
    .from("matriculas")
    .select("aluno_id")
    .eq("escola_id", escolaId)
    .not("aluno_id", "is", null)
    .limit(50);

  if (filters.turmaId) query = query.eq("turma_id", filters.turmaId);
  else if (turmaIds) query = query.in("turma_id", turmaIds);
  if (filters.statusMatricula) query = query.eq("status", filters.statusMatricula);

  const { data, error } = await query;
  if (error) throw error;
  const matriculaRows = Array.isArray(data) ? data as Array<{ aluno_id?: unknown }> : [];
  const alunoIds = Array.from(
    new Set(matriculaRows.map((row) => row.aluno_id).filter((value): value is string => typeof value === "string"))
  ).slice(0, 50);
  return loadStudentsByIds(supabase, escolaId, alunoIds);
}

async function loadFinancialRecipients(supabase: ServerSupabase, escolaId: string) {
  const { data, error } = await supabase
    .from("vw_financeiro_radar_resumo")
    .select("aluno_id,aluno_nome,responsavel_nome,telefone_responsavel,valor_total_atraso")
    .eq("escola_id", escolaId)
    .order("valor_total_atraso", { ascending: false })
    .limit(50);
  if (error) throw error;
  const rows = Array.isArray(data) ? data as FinanceRecipientRow[] : [];
  return rows.map((row): Recipient => ({
    alunoId: row.aluno_id,
    name: row.responsavel_nome || `Encarregado de ${row.aluno_nome || "Aluno"}`,
    studentName: row.aluno_nome || "Aluno",
    phone: row.telefone_responsavel || null,
    amount: Number(row.valor_total_atraso || 0),
  }));
}

function mergeRecipients(groups: Recipient[][]) {
  const map = new Map<string, Recipient>();
  for (const group of groups) {
    for (const recipient of group) {
      if (recipient.alunoId && !map.has(recipient.alunoId)) map.set(recipient.alunoId, recipient);
    }
  }
  return Array.from(map.values()).slice(0, 50);
}

function normalizeRiskLevel(value: string | null | undefined, fallback: RiskLevel): RiskLevel {
  return value === "low" || value === "medium" || value === "high" ? value : fallback;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await supabaseServerTyped<DBWithRPC>();
    const auth = await authorizeWhatsappUser(supabase, id);
    if (!auth.ok) return withNoStore(NextResponse.json({ ok: false, error: auth.error }, { status: auth.status }));
    if (!isWahaEnabled()) return withNoStore(NextResponse.json({ ok: false, error: "WhatsApp KLASSE está desativado neste ambiente." }, { status: 403 }));

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return withNoStore(NextResponse.json({ ok: false, error: "Payload inválido." }, { status: 400 }));

    if (parsed.data.messageType === "finance_charge") {
      const allowed = await userHasAnyRole(supabase, auth.auth.escolaId, WHATSAPP_FINANCE_ROLES);
      if (!allowed) return withNoStore(NextResponse.json({ ok: false, error: "Sem permissão para mensagens financeiras." }, { status: 403 }));
    }

    const provider = await loadProvider(supabase, auth.auth.escolaId);
    if (!provider || provider.status !== "connected") {
      return withNoStore(NextResponse.json({ ok: false, error: "WhatsApp da escola está desconectado." }, { status: 409 }));
    }

    const filters = parsed.data.filters;
    const hasFilter =
      filters.alunoIds.length > 0 || Boolean(filters.turmaId || filters.classeId || filters.statusMatricula || filters.financialGroup);
    if (!hasFilter) return withNoStore(NextResponse.json({ ok: false, error: "Informe pelo menos um filtro de destinatários." }, { status: 400 }));

    let template: TemplateRow | null = null;
    if (parsed.data.templateKey) {
      const { data, error } = await supabase
        .from("communication_templates")
        .select("key,title,body,risk_level,requires_approval,allowed_roles")
        .eq("key", parsed.data.templateKey)
        .eq("active", true)
        .maybeSingle();
      if (error) throw error;
      if (!data) return withNoStore(NextResponse.json({ ok: false, error: "Template não encontrado." }, { status: 404 }));
      template = data;
      const allowed = await templateAllowedForUser(supabase, auth.auth.escolaId, template.allowed_roles);
      if (!allowed) return withNoStore(NextResponse.json({ ok: false, error: "Sem permissão para usar este template." }, { status: 403 }));
    }

    const [{ data: escola }, manualRecipients, matriculaRecipients, financialRecipients] = await Promise.all([
      supabase.from("escolas").select("nome").eq("id", auth.auth.escolaId).maybeSingle(),
      loadStudentsByIds(supabase, auth.auth.escolaId, filters.alunoIds),
      filters.turmaId || filters.classeId || filters.statusMatricula
        ? loadStudentsByMatriculaFilters(supabase, auth.auth.escolaId, filters)
        : Promise.resolve([]),
      filters.financialGroup === "inadimplentes"
        ? loadFinancialRecipients(supabase, auth.auth.escolaId)
        : Promise.resolve([]),
    ]);

    const recipients = mergeRecipients([manualRecipients, matriculaRecipients, financialRecipients]);
    if (recipients.length !== parsed.data.expectedCount) {
      return withNoStore(
        NextResponse.json(
          {
            ok: false,
            error: `Confirmação inválida. Foram encontrados ${recipients.length} destinatários elegíveis.`,
            data: { count: recipients.length },
          },
          { status: 409 }
        )
      );
    }

    const baseBody = template?.body || parsed.data.body || parsed.data.noticeBody || "";
    if (!baseBody.trim()) return withNoStore(NextResponse.json({ ok: false, error: "Mensagem obrigatória." }, { status: 400 }));

    const riskLevel = normalizeRiskLevel(template?.risk_level, parsed.data.messageType === "finance_charge" ? "high" : "medium");
    const requiresApproval = inferApproval(riskLevel, parsed.data.messageType, Boolean(template?.requires_approval));
    const now = new Date().toISOString();
    let skippedInvalidPhone = 0;

    const rows: CommunicationOutboxInsert[] = recipients.flatMap((recipient) => {
      const phone = normalizeWhatsappPhone(recipient.phone);
      if (!phone) {
        skippedInvalidPhone += 1;
        return [];
      }
      const variables = {
        guardianName: recipient.name,
        studentName: recipient.studentName,
        schoolName: escola?.nome || "Escola",
        noticeBody: parsed.data.noticeBody || parsed.data.body || "",
        amount: recipient.amount ? `${recipient.amount.toLocaleString("pt-AO")} Kz` : "",
      };
      const body = interpolateTemplate(baseBody, variables);
      const idempotencyKey = `${parsed.data.messageType}:${recipient.alunoId}:${crypto.randomUUID()}`;
      return [{
        school_id: auth.auth.escolaId,
        created_by: auth.auth.userId,
        provider: "waha",
        channel: "whatsapp",
        message_type: parsed.data.messageType,
        source_module: parsed.data.messageType === "finance_charge" ? "financeiro" : "comunicacao",
        source_entity_type: "alunos",
        source_entity_id: recipient.alunoId,
        recipient_type: "encarregado",
        recipient_ref_id: recipient.alunoId,
        recipient_name: recipient.name,
        recipient_phone_masked: maskPhone(phone),
        recipient_phone_hash: hashPhone(phone),
        title: parsed.data.title,
        body,
        template_key: template?.key || parsed.data.templateKey || null,
        metadata: { phone, bulk: true, filters, variables },
        status: requiresApproval ? "review_required" : "queued",
        risk_level: riskLevel,
        requires_approval: requiresApproval,
        idempotency_key: idempotencyKey,
        queued_at: requiresApproval ? null : now,
      }];
    });

    if (rows.length === 0) {
      return withNoStore(NextResponse.json({ ok: false, error: "Nenhum destinatário com telefone válido." }, { status: 400 }));
    }

    const { data, error } = await supabase
      .from("communication_outbox")
      .insert(rows)
      .select("id,status");
    if (error) throw error;

    await supabase.from("communication_logs").insert({
      outbox_id: null,
      school_id: auth.auth.escolaId,
      event_type: "outbox.bulk_created",
      provider: "waha",
      payload_sanitized: {
        message_type: parsed.data.messageType,
        created: data?.length || 0,
        skipped_invalid_phone: skippedInvalidPhone,
        requires_approval: requiresApproval,
      },
    });

    return withNoStore(
      NextResponse.json({
        ok: true,
        data: {
          created: data?.length || 0,
          skippedInvalidPhone,
          requiresApproval,
          status: requiresApproval ? "review_required" : "queued",
          limited: recipients.length >= 50,
        },
      })
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return withNoStore(NextResponse.json({ ok: false, error: message }, { status: 500 }));
  }
}
