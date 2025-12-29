import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { requireFeature } from "@/lib/plan/requireFeature";
import { HttpError } from "@/lib/errors";

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

    const { escolaId } = await requireFeature("fin_recibo_pdf");
    const supabase = await supabaseServerTyped();

    const { data: escola, error: escolaError } = await supabase
      .from("escolas")
      .select("validation_base_url")
      .eq("id", escolaId)
      .maybeSingle();

    if (escolaError) {
      return NextResponse.json(
        { ok: false, error: "Falha ao carregar escola." },
        { status: 500 }
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

    const baseUrl =
      process.env.NEXT_PUBLIC_VALIDATION_BASE_URL ??
      (escola as any)?.validation_base_url ??
      null;

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
