import { createHash, createPublicKey } from "node:crypto";

import { GetPublicKeyCommand, KMSClient } from "@aws-sdk/client-kms";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { requireRoleInSchool } from "@/lib/authz";
import { supabaseRouteClient } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import type { Database } from "~types/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type JsonRecord = Record<string, unknown>;
type RouteSupabase = SupabaseClient<Database>;

const ESCOLA_SETUP_ROLES = [
  "admin",
  "admin_escola",
  "staff_admin",
  "financeiro",
  "admin_financeiro",
  "secretaria_financeiro",
] as const;

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

async function parseRequestBody(req: Request) {
  try {
    return (await req.json()) as { private_key_ref?: string };
  } catch {
    return null;
  }
}

async function checkSuperAdmin(supabase: RouteSupabase) {
  try {
    const { data, error } = await supabase.rpc("check_super_admin_role");
    if (error) return false;
    return data === true;
  } catch {
    return false;
  }
}

function parseKmsPrivateKeyRef(privateKeyRef: string | null | undefined) {
  const ref = (privateKeyRef ?? "").trim();
  if (!ref) {
    return { region: null as string | null, keyId: null as string | null };
  }

  if (ref.startsWith("arn:aws:kms:")) {
    const parts = ref.split(":");
    const region = parts[3] || null;
    return { region, keyId: ref };
  }

  if (ref.startsWith("kms://")) {
    const raw = ref.slice("kms://".length).replace(/^\/+/, "");
    if (!raw) return { region: null, keyId: null };

    const slash = raw.indexOf("/");
    if (slash === -1) {
      return { region: null, keyId: raw };
    }

    const first = raw.slice(0, slash);
    const rest = raw.slice(slash + 1);
    const looksLikeRegion = /^[a-z]{2}-[a-z]+-\d+$/.test(first);
    if (looksLikeRegion && rest) {
      return { region: first, keyId: rest };
    }
    return { region: null, keyId: raw };
  }

  return { region: null, keyId: ref };
}

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();
  const body = await parseRequestBody(req);
  if (!body) {
    return jsonError(400, "INVALID_PAYLOAD", "O corpo da requisição é inválido.", {
      request_id: requestId,
    });
  }

  try {
    const supabase = await supabaseRouteClient<Database>();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return jsonError(401, "UNAUTHENTICATED", "Utilizador não autenticado.", {
        request_id: requestId,
      });
    }

    const escolaId = await resolveEscolaIdForUser(supabase, user.id);
    const isSuperAdmin = await checkSuperAdmin(supabase);

    if (!isSuperAdmin && !escolaId) {
      return jsonError(403, "ESCOLA_ACCESS_DENIED", "Sem acesso à escola informada.", {
        request_id: requestId,
      });
    }

    if (!isSuperAdmin && escolaId) {
      const roleCheck = await requireRoleInSchool({
        supabase,
        escolaId,
        roles: [...ESCOLA_SETUP_ROLES],
      });
      if (roleCheck.error) {
        return roleCheck.error;
      }
    }

    const parsedRef = parseKmsPrivateKeyRef(body.private_key_ref);
    const region = parsedRef.region || process.env.AWS_REGION?.trim() || "";
    const keyId = parsedRef.keyId || process.env.AWS_KMS_KEY_ID?.trim() || "";

    if (!region || !keyId) {
      return jsonError(
        400,
        "KMS_CONFIG_MISSING",
        "Informe private_key_ref ou configure AWS_REGION/AWS_KMS_KEY_ID."
      );
    }

    const kms = new KMSClient({ region });
    const result = await kms.send(new GetPublicKeyCommand({ KeyId: keyId }));
    if (!result.PublicKey) {
      return jsonError(500, "KMS_PUBLIC_KEY_EMPTY", "KMS retornou chave pública vazia.");
    }

    const derBuffer = Buffer.from(result.PublicKey);
    const publicKeyPem = createPublicKey({
      key: derBuffer,
      format: "der",
      type: "spki",
    })
      .export({ format: "pem", type: "spki" })
      .toString();
    const keyFingerprint = `sha256:${createHash("sha256").update(derBuffer).digest("hex")}`;

    return NextResponse.json({
      ok: true,
      data: {
        request_id: requestId,
        region,
        key_id: keyId,
        key_fingerprint: keyFingerprint,
        public_key_pem: publicKeyPem,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Erro interno ao obter chave pública da KMS.";
    return jsonError(500, "FISCAL_KMS_PUBLIC_KEY_RESOLVE_FAILED", message, {
      request_id: requestId,
    });
  }
}

