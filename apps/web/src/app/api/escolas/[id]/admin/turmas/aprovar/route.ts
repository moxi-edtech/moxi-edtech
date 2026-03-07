// apps/web/src/app/api/escolas/[id]/admin/turmas/aprovar/route.ts

import { createClient } from "~/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { dispatchSecretariaNotificacao } from "@/lib/notificacoes/dispatchSecretariaNotificacao";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: escolaId } = await params;
  const { turma_ids } = await req.json();

  if (!escolaId) {
    return NextResponse.json(
      { ok: false, error: "ID da escola não fornecido." },
      { status: 400 }
    );
  }

  if (!turma_ids || !Array.isArray(turma_ids) || turma_ids.length === 0) {
    return NextResponse.json(
      { ok: false, error: "Nenhum ID de turma fornecido." },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  const { data: escolaRow } = await supabase
    .from("escolas")
    .select("slug")
    .eq("id", escolaId)
    .maybeSingle();
  const escolaParam = escolaRow?.slug ? String(escolaRow.slug) : escolaId;

  const { error } = await supabase.rpc("aprovar_turmas", {
    p_turma_ids: turma_ids,
    p_escola_id: escolaId,
  });

  if (error) {
    console.error("Erro ao aprovar turmas:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error.message || "Erro desconhecido ao aprovar as turmas.",
      },
      { status: 500 }
    );
  }

  await dispatchSecretariaNotificacao({
    escolaId,
    key: "TURMA_APROVADA",
    params: { actionUrl: `/escola/${escolaParam}/secretaria/turmas` },
    agrupamentoTTLHoras: 12,
  });

  return NextResponse.json({ ok: true });
}
