import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { HttpError } from "@/lib/errors";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

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
    const payload = PayloadSchema.safeParse(await req.json().catch(() => ({})));
    if (!payload.success) {
      return NextResponse.json(
        { ok: false, error: payload.error.issues?.[0]?.message || "Payload inválido." },
        { status: 400 }
      );
    }

    const { mensalidadeId } = payload.data;

    const supabase = await supabaseServerTyped();
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

    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id, undefined, metadataEscolaId);
    if (!escolaId) {
      return NextResponse.json(
        { ok: false, error: "Usuário sem escola associada", code: "NO_SCHOOL" },
        { status: 403 }
      );
    }

    const { data, error } = await supabase.rpc("emitir_recibo", {
      p_mensalidade_id: mensalidadeId,
    });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    if (!data || (data as any)?.ok === false) {
      return NextResponse.json(
        { ok: false, error: (data as any)?.erro || "Falha ao emitir recibo." },
        { status: 400 }
      );
    }

    const publicId = String((data as any).public_id || "");
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
      baseUrl = (escola as any)?.validation_base_url ?? null;
    }

    const urlValidacao = baseUrl
      ? `${String(baseUrl).replace(/\/$/, "")}/documentos/${publicId}`
      : null;

    const response: ReciboResponse = {
      ok: true,
      doc_id: String((data as any).doc_id),
      url_validacao: urlValidacao,
    };

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
