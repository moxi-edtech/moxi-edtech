import { NextResponse } from "next/server";
import { z } from "zod";

import {
  fiscalDocumentoActionSchema,
  type FiscalDocumentoActionInput,
} from "@/lib/schemas/fiscal-documento.schema";
import { supabaseRouteClient } from "@/lib/supabaseServer";
import type { Database, Json } from "~types/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type JsonRecord = Record<string, unknown>;

type FiscalRectificarDocumentoArgs = {
  p_documento_id: string;
  p_motivo: string;
  p_metadata?: Json;
};

type FiscalRectificarDocumentoResult = {
  ok: boolean;
  documento_id: string;
  empresa_id: string;
  status: "rectificado";
};

type FiscalDatabase = Database & {
  public: {
    Functions: Database["public"]["Functions"] & {
      fiscal_rectificar_documento: {
        Args: FiscalRectificarDocumentoArgs;
        Returns: FiscalRectificarDocumentoResult;
      };
    };
  };
};

const paramsSchema = z.object({
  documentoId: z.string().uuid(),
});

function jsonError(status: number, code: string, message: string, details?: JsonRecord) {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code,
        message,
        details: details ?? null,
      },
    },
    { status }
  );
}

function mapRpcError(message: string) {
  if (message.startsWith("AUTH:")) {
    return { status: 403, code: "FISCAL_FORBIDDEN" };
  }
  if (message.startsWith("STATE:")) {
    return { status: 409, code: "FISCAL_STATE_CONFLICT" };
  }
  if (message.includes("não encontrado")) {
    return { status: 404, code: "FISCAL_DOCUMENTO_NOT_FOUND" };
  }
  if (message.startsWith("DATA:")) {
    return { status: 400, code: "FISCAL_DATA_INVALID" };
  }
  return { status: 500, code: "FISCAL_RPC_FAILED" };
}

async function parseRequestBody(req: Request): Promise<FiscalDocumentoActionInput | null> {
  try {
    const body = await req.json();
    const parsed = fiscalDocumentoActionSchema.safeParse(body);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function POST(
  req: Request,
  context: { params: Promise<{ documentoId: string }> }
) {
  const requestId = crypto.randomUUID();
  const rawParams = await context.params;
  const parsedParams = paramsSchema.safeParse(rawParams);

  if (!parsedParams.success) {
    return jsonError(400, "INVALID_PARAMS", "Parâmetros inválidos.", {
      request_id: requestId,
      field_errors: parsedParams.error.flatten().fieldErrors,
    });
  }

  const body = await parseRequestBody(req);
  if (!body) {
    return jsonError(400, "INVALID_PAYLOAD", "O corpo da requisição é inválido.", {
      request_id: requestId,
    });
  }

  try {
    const supabase = await supabaseRouteClient<FiscalDatabase>();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return jsonError(401, "UNAUTHENTICATED", "Utilizador não autenticado.", {
        request_id: requestId,
      });
    }

    const rpcArgs: FiscalRectificarDocumentoArgs = {
      p_documento_id: parsedParams.data.documentoId,
      p_motivo: body.motivo,
      p_metadata: (body.metadata ?? {}) as Json,
    };

    const { data, error } = await supabase.rpc("fiscal_rectificar_documento", rpcArgs);

    if (error) {
      const mapped = mapRpcError(error.message ?? "Falha ao rectificar documento fiscal.");
      return jsonError(
        mapped.status,
        mapped.code,
        error.message || "Falha ao rectificar documento fiscal.",
        {
          request_id: requestId,
          documento_id: parsedParams.data.documentoId,
        }
      );
    }

    if (!data?.ok) {
      return jsonError(
        500,
        "FISCAL_RPC_INCONSISTENTE",
        "Resposta inesperada ao rectificar documento fiscal.",
        { request_id: requestId }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        data,
        request_id: requestId,
      },
      { status: 200 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro interno ao rectificar documento fiscal.";
    return jsonError(500, "FISCAL_ROUTE_INTERNAL_ERROR", message, { request_id: requestId });
  }
}
