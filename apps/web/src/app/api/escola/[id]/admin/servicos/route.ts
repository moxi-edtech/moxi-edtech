import { NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/route-client";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { SERVICOS_ESCOLA_PADRAO } from "@/lib/secretaria/servicos-catalogo-padrao";

export const dynamic = "force-dynamic";

const SERVICO_SELECT =
  "id, codigo, nome, descricao, valor_base, ativo, pode_bloquear_por_debito, exige_pagamento_antes_de_liberar, aceita_pagamento_pendente, exige_aprovacao";

type Payload = {
  action?: "install_defaults";
  id?: string | null;
  codigo?: string;
  nome?: string;
  descricao?: string | null;
  valor_base?: number;
  ativo?: boolean;
  pode_bloquear_por_debito?: boolean;
  exige_pagamento_antes_de_liberar?: boolean;
  aceita_pagamento_pendente?: boolean;
  exige_aprovacao?: boolean;
};

export async function GET(_req: Request, context: { params: Promise<{ id?: string }> }) {
  try {
    const { id } = await context.params;
    const { supabase, escolaId } = await resolveEscolaIdFromRequest(id ?? null);
    if (!escolaId) {
      return NextResponse.json({ ok: false, error: "Escola não encontrada" }, { status: 403 });
    }

    const { data, error } = await supabase
      .from("servicos_escola")
      .select(SERVICO_SELECT)
      .eq("escola_id", escolaId)
      .order("nome", { ascending: true })
      .order("id", { ascending: true })
      .limit(100);

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, items: data ?? [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao listar serviços";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

async function resolveEscolaIdFromRequest(requestedId: string | null) {
  const supabase = await createRouteClient();
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes.user) {
    return { supabase, escolaId: null };
  }
  const metadataEscolaId = (userRes.user.app_metadata as { escola_id?: string | null } | null)?.escola_id ?? null;
  const escolaId = await resolveEscolaIdForUser(
    supabase,
    userRes.user.id,
    requestedId ?? null,
    metadataEscolaId ? String(metadataEscolaId) : null
  );
  return { supabase, escolaId };
}

export async function POST(req: Request, context: { params: Promise<{ id?: string }> }) {
  try {
    const { id } = await context.params;
    const { supabase, escolaId } = await resolveEscolaIdFromRequest(id ?? null);
    if (!escolaId) {
      return NextResponse.json({ ok: false, error: "Escola não encontrada" }, { status: 403 });
    }

    const payload = (await req.json()) as Payload;
    if (payload?.action === "install_defaults") {
      const { data: existing, error: existingError } = await supabase
        .from("servicos_escola")
        .select("codigo")
        .eq("escola_id", escolaId);

      if (existingError) {
        return NextResponse.json({ ok: false, error: existingError.message }, { status: 500 });
      }

      const existingCodes = new Set((existing ?? []).map((item) => String(item.codigo)));
      const missing = SERVICOS_ESCOLA_PADRAO.filter((item) => !existingCodes.has(item.codigo));

      if (missing.length > 0) {
        const { error: insertError } = await supabase.from("servicos_escola").insert(
          missing.map((item) => ({
            escola_id: escolaId,
            codigo: item.codigo,
            nome: item.nome,
            descricao: item.descricao,
            valor_base: item.valor_base,
            ativo: item.ativo,
            pode_bloquear_por_debito: item.pode_bloquear_por_debito,
            exige_pagamento_antes_de_liberar: item.exige_pagamento_antes_de_liberar,
            aceita_pagamento_pendente: item.aceita_pagamento_pendente,
            exige_aprovacao: item.exige_aprovacao,
          }))
        );

        if (insertError) {
          return NextResponse.json({ ok: false, error: insertError.message }, { status: 500 });
        }
      }

      const { data, error } = await supabase
        .from("servicos_escola")
        .select(SERVICO_SELECT)
        .eq("escola_id", escolaId)
        .order("nome", { ascending: true })
        .order("id", { ascending: true })
        .limit(100);

      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, inserted: missing.length, items: data ?? [] });
    }

    if (!payload?.codigo?.trim() || !payload?.nome?.trim()) {
      return NextResponse.json({ ok: false, error: "Código e nome são obrigatórios" }, { status: 400 });
    }

    const baseData = {
      escola_id: escolaId,
      codigo: payload.codigo.trim(),
      nome: payload.nome.trim(),
      descricao: payload.descricao?.trim() || null,
      valor_base: Number(payload.valor_base ?? 0),
      ativo: payload.ativo ?? true,
      pode_bloquear_por_debito: Boolean(payload.pode_bloquear_por_debito),
      exige_pagamento_antes_de_liberar: Boolean(payload.exige_pagamento_antes_de_liberar),
      aceita_pagamento_pendente: Boolean(payload.aceita_pagamento_pendente),
      exige_aprovacao: Boolean(payload.exige_aprovacao),
    };

    if (payload.id) {
      const { data, error } = await supabase
        .from("servicos_escola")
        .update(baseData)
        .eq("id", payload.id)
        .eq("escola_id", escolaId)
        .select(SERVICO_SELECT)
        .maybeSingle();
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, item: data });
    }

    const { data, error } = await supabase
      .from("servicos_escola")
      .insert(baseData)
      .select(SERVICO_SELECT)
      .maybeSingle();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, item: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao salvar serviço";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
