import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { requireRoleInSchool } from "@/lib/authz";
import { recordAuditServer } from "@/lib/audit";

export const dynamic = "force-dynamic";

const payloadSchema = z.object({
  aluno_id: z.string().uuid().optional(),
  mensalidade_id: z.string().uuid().optional(),
  valor: z.number().positive().optional(),
  metodo: z.enum(["cash", "tpa", "transfer", "mcx", "kiwk", "kwik"]).optional(),
  reference: z.string().trim().max(64).optional().nullable(),
  evidence_url: z.string().trim().max(255).optional().nullable(),
  meta: z.record(z.any()).optional(),
  metodo_pagamento: z.string().optional(),
  observacao: z.string().trim().max(255).optional().nullable(),
});

const normalizeMetodo = (raw: string) => {
  const value = raw.toLowerCase().trim();
  if (["cash", "tpa", "transfer", "mcx", "kiwk", "kwik"].includes(value)) {
    return value === "kwik" ? "kiwk" : value;
  }
  if (value === "numerario" || value === "dinheiro") return "cash";
  if (value === "multicaixa" || value === "tpa_fisico" || value === "tpa") return "tpa";
  if (value === "transferencia") return "transfer";
  if (value === "mcx_express" || value === "mbway" || value === "referencia") return "mcx";
  if (value === "kwik") return "kiwk";
  return "cash";
};

export async function POST(req: Request) {
  try {
    const idempotencyKey =
      req.headers.get("Idempotency-Key") ?? req.headers.get("idempotency-key");
    if (!idempotencyKey) {
      return NextResponse.json(
        { ok: false, error: "Idempotency-Key header é obrigatório" },
        { status: 400 }
      );
    }

    const supabase = await supabaseServerTyped<any>();
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const parsed = payloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues?.[0]?.message || "Payload inválido." },
        { status: 400 }
      );
    }

    const metodo = normalizeMetodo(parsed.data.metodo ?? parsed.data.metodo_pagamento ?? "cash");
    const observacao = parsed.data.observacao ?? null;

    type MensalidadeRow = {
      id: string;
      escola_id: string;
      status: string | null;
      valor: number | null;
      valor_previsto: number | null;
      aluno_id: string | null;
    };

    let mensalidade: MensalidadeRow | null = null;

    if (parsed.data.mensalidade_id) {
      const { data: mensalidadeRow, error: mensalidadeErr } = await supabase
        .from("mensalidades")
        .select("id, escola_id, status, valor, valor_previsto, aluno_id")
        .eq("id", parsed.data.mensalidade_id)
        .maybeSingle();

      if (mensalidadeErr || !mensalidadeRow) {
        return NextResponse.json({ ok: false, error: "Mensalidade não encontrada." }, { status: 404 });
      }

      mensalidade = mensalidadeRow as MensalidadeRow;
    }

    const escolaId = await resolveEscolaIdForUser(
      supabase,
      user.id,
      mensalidade?.escola_id ?? null
    );
    if (!escolaId || (mensalidade?.escola_id && escolaId !== mensalidade.escola_id)) {
      return NextResponse.json({ ok: false, error: "Sem permissão." }, { status: 403 });
    }

    const { error: roleError } = await requireRoleInSchool({
      supabase,
      escolaId,
      roles: ["secretaria", "financeiro", "admin", "admin_escola", "staff_admin"],
    });
    if (roleError) return roleError;

    if (mensalidade?.status === "pago") {
      return NextResponse.json({ ok: true, mensagem: "Mensalidade já paga." });
    }
    if (!mensalidade && !parsed.data.aluno_id) {
      return NextResponse.json({ ok: false, error: "Informe aluno ou mensalidade." }, { status: 400 });
    }

    const alunoId = parsed.data.aluno_id ?? mensalidade?.aluno_id ?? null;
    if (!alunoId) {
      return NextResponse.json({ ok: false, error: "Aluno não identificado." }, { status: 400 });
    }

    const valor = Number(parsed.data.valor ?? mensalidade?.valor_previsto ?? mensalidade?.valor ?? 0);
    if (!Number.isFinite(valor) || valor <= 0) {
      return NextResponse.json({ ok: false, error: "Valor inválido." }, { status: 400 });
    }

    const { data: existingPagamento } = await supabase
      .from("pagamentos")
      .select("id, status, meta")
      .eq("escola_id", escolaId)
      .contains("meta", { idempotency_key: idempotencyKey })
      .maybeSingle();
    if (existingPagamento) {
      return NextResponse.json({ ok: true, data: existingPagamento, idempotent: true });
    }

    const { data: pagamento, error } = await supabase.rpc("financeiro_registrar_pagamento_secretaria", {
      p_escola_id: escolaId,
      p_aluno_id: alunoId,
      p_mensalidade_id: mensalidade?.id ?? null,
      p_valor: valor,
      p_metodo: metodo,
      p_reference: parsed.data.reference ?? null,
      p_evidence_url: parsed.data.evidence_url ?? null,
      p_gateway_ref: null,
      p_meta: {
        observacao: observacao ?? undefined,
        origem: "portal_financeiro",
        ...(parsed.data.meta ?? {}),
        idempotency_key: idempotencyKey,
      },
    });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    recordAuditServer({
      escolaId,
      portal: "financeiro",
      acao: "PAGAMENTO_REGISTRADO",
      entity: "pagamento",
      entityId: (pagamento as any)?.id ?? null,
      details: { valor, metodo, mensalidade_id: mensalidade?.id ?? null },
    }).catch(() => null);

    return NextResponse.json({ ok: true, data: pagamento });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
