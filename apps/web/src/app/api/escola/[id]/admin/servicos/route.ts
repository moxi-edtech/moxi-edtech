import { NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/route-client";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

type Payload = {
  id?: string | null;
  codigo: string;
  nome: string;
  descricao?: string | null;
  valor_base: number;
  ativo: boolean;
};

export async function GET(_req: Request, context: { params: { id?: string } }) {
  try {
    const { supabase, escolaId } = await resolveEscolaIdFromRequest(context.params?.id ?? null);
    if (!escolaId) {
      return NextResponse.json({ ok: false, error: "Escola não encontrada" }, { status: 403 });
    }

    const { data, error } = await supabase
      .from("servicos_escola")
      .select("id, codigo, nome, descricao, valor_base, ativo")
      .eq("escola_id", escolaId)
      .order("nome", { ascending: true });

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

export async function POST(req: Request, context: { params: { id?: string } }) {
  try {
    const { supabase, escolaId } = await resolveEscolaIdFromRequest(context.params?.id ?? null);
    if (!escolaId) {
      return NextResponse.json({ ok: false, error: "Escola não encontrada" }, { status: 403 });
    }

    const payload = (await req.json()) as Payload;
    if (!payload?.codigo?.trim() || !payload?.nome?.trim()) {
      return NextResponse.json({ ok: false, error: "Código e nome são obrigatórios" }, { status: 400 });
    }

    const baseData = {
      escola_id: escolaId,
      codigo: payload.codigo.trim(),
      nome: payload.nome.trim(),
      descricao: payload.descricao?.trim() || null,
      valor_base: Number(payload.valor_base ?? 0),
      ativo: Boolean(payload.ativo),
    };

    if (payload.id) {
      const { data, error } = await supabase
        .from("servicos_escola")
        .update(baseData)
        .eq("id", payload.id)
        .eq("escola_id", escolaId)
        .select("id, codigo, nome, descricao, valor_base, ativo")
        .maybeSingle();
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, item: data });
    }

    const { data, error } = await supabase
      .from("servicos_escola")
      .insert(baseData)
      .select("id, codigo, nome, descricao, valor_base, ativo")
      .maybeSingle();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, item: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao salvar serviço";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
