import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { HttpError } from "@/lib/errors";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { recordAuditServer } from "@/lib/audit";
import { requireFeature } from "@/lib/plan/requireFeature";
import type { Database } from "~types/supabase";

const PayloadSchema = z.object({
  mensalidadeId: z.string().uuid(),
});

type ReciboResponse = {
  ok: true;
  doc_id: string;
  url_validacao: string | null;
};

export async function POST(req: NextRequest) {
  try {
    const idempotencyKey =
      req.headers.get("Idempotency-Key") ?? req.headers.get("idempotency-key");
    if (!idempotencyKey) {
      return NextResponse.json(
        { ok: false, error: "Idempotency-Key header é obrigatório" },
        { status: 400 }
      );
    }

    const payload = PayloadSchema.safeParse(await req.json().catch(() => ({})));
    if (!payload.success) {
      return NextResponse.json(
        { ok: false, error: payload.error.issues?.[0]?.message || "Payload inválido." },
        { status: 400 }
      );
    }

    const { mensalidadeId } = payload.data;

    const supabase = await supabaseServerTyped<Database>();
    const supabaseAny = supabase as any;
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Não autenticado" },
        { status: 401 }
      );
    }

    const metadataEscolaId =
      (user.user_metadata as { escola_id?: string | null } | null)?.escola_id ??
      (user.app_metadata as { escola_id?: string | null } | null)?.escola_id ??
      null;

    const escolaId = await resolveEscolaIdForUser(supabase, user.id, undefined, metadataEscolaId);
    if (!escolaId) {
      return NextResponse.json(
        { ok: false, error: "Usuário sem escola associada", code: "NO_SCHOOL" },
        { status: 403 }
      );
    }

    const { data: existingIdempotency } = await supabaseAny
      .from("idempotency_keys")
      .select("result")
      .eq("escola_id", escolaId)
      .eq("scope", "financeiro_recibo_emitir")
      .eq("key", idempotencyKey)
      .maybeSingle();

    if (existingIdempotency?.result) {
      return NextResponse.json(existingIdempotency.result, { status: 200 });
    }

    try {
      await requireFeature("fin_recibo_pdf");
    } catch (err) {
      if (err instanceof HttpError) {
        return NextResponse.json(
          { ok: false, error: err.message, code: err.code },
          { status: err.status }
        );
      }
      throw err;
    }

    const { data, error } = await supabase.rpc("emitir_recibo", {
      p_mensalidade_id: mensalidadeId,
    });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    const dataPayload = data as { ok?: boolean; erro?: string; public_id?: string; doc_id?: string } | null;
    if (!dataPayload || dataPayload?.ok === false) {
      return NextResponse.json(
        { ok: false, error: dataPayload?.erro || "Falha ao emitir recibo." },
        { status: 400 }
      );
    }

    const publicId = String(dataPayload.public_id || "");
    if (!publicId) {
      return NextResponse.json(
        { ok: false, error: "Recibo emitido sem identificador público." },
        { status: 500 }
      );
    }

    const baseUrlEnv = process.env.NEXT_PUBLIC_VALIDATION_BASE_URL ?? null;
    let baseUrl = baseUrlEnv;
    if (!baseUrlEnv) {
      const { data: escola } = await supabase
        .from("escolas")
        .select("validation_base_url")
        .eq("id", escolaId)
        .maybeSingle();
      baseUrl = (escola as { validation_base_url?: string | null } | null)?.validation_base_url ?? null;
    }

    const urlValidacao = baseUrl
      ? `${String(baseUrl).replace(/\/$/, "")}/documentos/${publicId}`
      : null;

    const response: ReciboResponse = {
      ok: true,
      doc_id: String(dataPayload.doc_id),
      url_validacao: urlValidacao,
    };

    await supabaseAny.from("idempotency_keys").upsert(
      {
        escola_id: escolaId,
        scope: "financeiro_recibo_emitir",
        key: idempotencyKey,
        result: response,
      },
      { onConflict: "escola_id,scope,key" }
    );

    recordAuditServer({
      escolaId,
      portal: "financeiro",
      acao: "RECIBO_EMITIDO",
      entity: "documentos_emitidos",
      entityId: String(dataPayload.doc_id),
      details: { mensalidade_id: mensalidadeId, public_id: publicId },
    }).catch(() => null);

    return NextResponse.json(response, { status: 200 });
  } catch (err) {
    if (err instanceof HttpError) {
      return NextResponse.json(
        { ok: false, error: err.message, code: err.code },
        { status: err.status }
      );
    }

    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
