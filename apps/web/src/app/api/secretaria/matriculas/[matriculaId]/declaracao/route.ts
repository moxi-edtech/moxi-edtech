import { NextResponse } from "next/server";
import { recordAuditServer } from "@/lib/audit";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SUNSET_DATE = "2027-03-31";
const REPLACEMENT_ENDPOINT = "/api/secretaria/documentos/emitir";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ matriculaId: string }> }
) {
  const { matriculaId } = await params;
  const supabase = await supabaseServerTyped<any>();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  }

  const escolaId = await resolveEscolaIdForUser(supabase as any, user.id);
  if (!escolaId) {
    return NextResponse.json({ ok: false, error: "Escola inválida" }, { status: 403 });
  }

  const { data: matricula, error: matriculaError } = await supabase
    .from("matriculas")
    .select("id, escola_id, aluno_id")
    .eq("escola_id", escolaId)
    .eq("id", matriculaId)
    .single();

  if (matriculaError || !matricula?.aluno_id) {
    return NextResponse.json({ ok: false, error: "Matrícula não encontrada." }, { status: 404 });
  }

  const deprecationPayload = {
    deprecated: true,
    sunset_date: SUNSET_DATE,
    replacement_endpoint: REPLACEMENT_ENDPOINT,
  } as const;

  const proto = request.headers.get("x-forwarded-proto") ?? "http";
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const baseUrl = host ? `${proto}://${host}` : process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const canonicalRes = await fetch(`${baseUrl}${REPLACEMENT_ENDPOINT}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: request.headers.get("cookie") ?? "",
    },
    body: JSON.stringify({
      alunoId: matricula.aluno_id,
      escolaId,
      tipoDocumento: "declaracao_frequencia",
    }),
    cache: "no-store",
  });

  const canonicalJson = await canonicalRes.json().catch(() => ({}));

  recordAuditServer({
    escolaId,
    portal: "secretaria",
    acao: "LEGACY_ENDPOINT_USED",
    entity: "api_legacy",
    entityId: matriculaId,
    details: {
      endpoint: "/api/secretaria/matriculas/[matriculaId]/declaracao",
      replacement_endpoint: REPLACEMENT_ENDPOINT,
      matricula_id: matriculaId,
      aluno_id: matricula.aluno_id,
      canonical_status: canonicalRes.status,
      deprecated: true,
      sunset_date: SUNSET_DATE,
    },
  }).catch(() => null);

  const responsePayload = {
    ok: canonicalRes.ok && Boolean((canonicalJson as any)?.ok),
    ...(canonicalJson as Record<string, unknown>),
    ...(canonicalJson && (canonicalJson as any).docId
      ? { print_url: `/secretaria/documentos/${(canonicalJson as any).docId}/frequencia/print` }
      : {}),
    ...deprecationPayload,
  };

  const response = NextResponse.json(responsePayload, { status: canonicalRes.ok ? 200 : canonicalRes.status || 502 });
  response.headers.set("Deprecation", "true");
  response.headers.set("Sunset", `${SUNSET_DATE}T23:59:59Z`);
  response.headers.set("Link", `<${REPLACEMENT_ENDPOINT}>; rel=\"successor-version\"`);
  response.headers.set("X-Deprecated-Endpoint", "true");
  response.headers.set("X-Replacement-Endpoint", REPLACEMENT_ENDPOINT);
  response.headers.set("Warning", `299 - \"Deprecated endpoint. Use ${REPLACEMENT_ENDPOINT} until ${SUNSET_DATE}.\"`);

  return response;
}
