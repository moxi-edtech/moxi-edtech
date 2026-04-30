import { NextResponse } from "next/server";
import { requireFormacaoRoles } from "@/lib/route-auth";
import type { FormacaoSupabaseClient } from "@/lib/db-types";

export const dynamic = "force-dynamic";

const allowedRoles = ["formacao_financeiro", "formacao_admin", "super_admin", "global_admin"];

type DadosPagamento = {
  ativo: boolean;
  banco: string;
  titular_conta: string;
  iban: string;
  numero_conta: string;
  kwik_chave: string;
  instrucoes_checkout: string;
};

const emptyDadosPagamento: DadosPagamento = {
  ativo: false,
  banco: "",
  titular_conta: "",
  iban: "",
  numero_conta: "",
  kwik_chave: "",
  instrucoes_checkout: "",
};

function cleanText(value: unknown, maxLength = 500) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function normalizeDadosPagamento(input: unknown): DadosPagamento {
  const raw = (input ?? {}) as Record<string, unknown>;
  return {
    ativo: Boolean(raw.ativo),
    banco: cleanText(raw.banco, 120),
    titular_conta: cleanText(raw.titular_conta, 160),
    iban: cleanText(raw.iban, 80).toUpperCase(),
    numero_conta: cleanText(raw.numero_conta, 80),
    kwik_chave: cleanText(raw.kwik_chave, 120),
    instrucoes_checkout: cleanText(raw.instrucoes_checkout, 1000),
  };
}

function validateDadosPagamento(data: DadosPagamento) {
  if (!data.ativo) return null;
  if (!data.iban && !data.numero_conta && !data.kwik_chave) {
    return "Informe pelo menos IBAN, número de conta ou chave Kwik para ativar o checkout.";
  }
  if (data.iban && data.iban.length < 10) return "IBAN inválido.";
  if (data.numero_conta && data.numero_conta.length < 4) return "Número de conta inválido.";
  return null;
}

export async function GET() {
  const auth = await requireFormacaoRoles(allowedRoles);
  if (!auth.ok) return auth.response;

  const s = auth.supabase as FormacaoSupabaseClient;
  const { data, error } = await s
    .from("centros_formacao")
    .select("dados_pagamento")
    .eq("escola_id", auth.escolaId)
    .maybeSingle();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

  return NextResponse.json({
    ok: true,
    item: normalizeDadosPagamento((data as { dados_pagamento?: unknown } | null)?.dados_pagamento ?? emptyDadosPagamento),
  });
}

export async function PUT(request: Request) {
  const auth = await requireFormacaoRoles(allowedRoles);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const item = normalizeDadosPagamento((body as { item?: unknown } | null)?.item ?? body);
  const validationError = validateDadosPagamento(item);
  if (validationError) {
    return NextResponse.json({ ok: false, error: validationError }, { status: 400 });
  }

  const s = auth.supabase as FormacaoSupabaseClient & {
    rpc: (
      fn: "formacao_update_dados_pagamento",
      args: { p_escola_id: string; p_dados: DadosPagamento }
    ) => Promise<{ data: unknown; error: { message: string } | null }>;
  };

  const { data, error } = await s.rpc("formacao_update_dados_pagamento", {
    p_escola_id: String(auth.escolaId),
    p_dados: item,
  });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, item: normalizeDadosPagamento(data) });
}
