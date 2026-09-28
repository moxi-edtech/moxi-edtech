import { NextResponse } from "next/server";
import { createKlasseIntegrationClient, readBearerToken } from "@/lib/integrations/klasse-chatgpt/client";
import { allowedRolesByTool, isKlasseToolName, toolSchemas } from "@/lib/integrations/klasse-chatgpt/schemas";
import { runKlasseTool } from "@/lib/integrations/klasse-chatgpt/tools";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { requireRoleInSchool } from "@/lib/authz";

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
    return NextResponse.json({ ok: true, tool, data }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Consulta não disponível";
    const forbidden = /permission|policy|forbidden|autoriz/i.test(message);
    return NextResponse.json({ ok: false, error: forbidden ? "Sem permissão para esta consulta" : "Consulta não disponível" }, { status: forbidden ? 403 : 500 });
  }
}
