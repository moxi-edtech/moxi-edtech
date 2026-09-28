import { NextResponse } from "next/server";
import { createKlasseIntegrationClient, readBearerToken } from "@/lib/integrations/klasse-chatgpt/client";
import { allowedRolesByTool, isKlasseToolName, isWriteToolName, toolSchemas } from "@/lib/integrations/klasse-chatgpt/schemas";
import { runKlasseTool } from "@/lib/integrations/klasse-chatgpt/tools";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { requireRoleInSchool } from "@/lib/authz";

/**
 * O PostgrestError do supabase-js não herda de Error: é um objecto simples com
 * `message`, `code`, `details` e `hint`. Sem isto, `error instanceof Error` é
 * falso, a mensagem perde-se e todo o erro de domínio cai no 500 genérico.
 */
const readErrorMessage = (error: unknown): string => {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message ?? "");
  }
  return error instanceof Error ? error.message : "";
};

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function POST(request: Request, context: { params: Promise<{ tool: string }> }) {
  const { tool } = await context.params;
  if (!isKlasseToolName(tool)) return NextResponse.json({ ok: false, error: "Ferramenta desconhecida" }, { status: 404 });

  const accessToken = readBearerToken(request);
  if (!accessToken) return NextResponse.json({ ok: false, error: "Bearer token obrigatório" }, { status: 401 });

  const supabase = createKlasseIntegrationClient(accessToken);
  const { data: auth, error: authError } = await supabase.auth.getUser(accessToken);
  if (authError || !auth.user) return NextResponse.json({ ok: false, error: "Sessão inválida ou expirada" }, { status: 401 });

  // Membership is checked here and repeated by the RPC using auth.uid().
  const escolaId = await resolveEscolaIdForUser(supabase, auth.user.id);
  if (!escolaId) return NextResponse.json({ ok: false, error: "Usuário sem escola ativa" }, { status: 403 });
  const { error: roleError } = await requireRoleInSchool({
    supabase,
    escolaId,
    roles: allowedRolesByTool[tool],
  });
  if (roleError) return roleError;

  const parsed = toolSchemas[tool].safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Parâmetros inválidos", details: parsed.error.flatten() }, { status: 400 });

  try {
    const data = await runKlasseTool(supabase, tool, parsed.data);

    // As ferramentas de escrita devolvem um envelope { ok }. Uma recusa de
    // domínio (AUTH:/DATA:) chega como ok:false e não como excepção — é assim
    // que o registo de auditoria sobrevive, porque um RAISE obrigaria ao
    // rollback da transacção inteira e levá-lo-ia consigo.
    if (isWriteToolName(tool) && data && typeof data === "object" && (data as { ok?: unknown }).ok === false) {
      const motivo = String((data as { erro?: unknown }).erro ?? "Operação recusada");
      const status = /^AUTH:/i.test(motivo) ? 403 : 409;
      return NextResponse.json({ ok: false, tool, error: motivo.replace(/^(AUTH|DATA):\s*/i, "") }, { status });
    }

    return NextResponse.json({ ok: true, tool, data }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch (error) {
    const message = readErrorMessage(error);
    if (/^AUTH:|permission|policy|forbidden|autoriz/i.test(message)) {
      return NextResponse.json({ ok: false, error: "Sem permissão para esta operação" }, { status: 403 });
    }
    if (/^DATA:/i.test(message)) {
      return NextResponse.json({ ok: false, error: message.replace(/^DATA:\s*/i, "") }, { status: 409 });
    }
    return NextResponse.json({ ok: false, error: "Operação não disponível" }, { status: 500 });
  }
}
