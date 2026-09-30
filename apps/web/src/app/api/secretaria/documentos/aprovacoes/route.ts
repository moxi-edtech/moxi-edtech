import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRoleInSchool } from "@/lib/authz";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { recordAuditServer } from "@/lib/audit";
import { K12_SECRETARIA_OPERACIONAL_ROLE_GROUP } from "@/lib/roles";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DecisionSchema = z.object({
  pedidoId: z.string().uuid(),
  decision: z.enum(["approve", "reject"]),
  motivo: z.string().trim().max(500).optional(),
});

const PORTAL_DOCUMENT_CODES = [
  "DOC_DECLARACAO_NOTAS",
  "DOC_DECLARACAO_FREQUENCIA",
  "DOC_BOLETIM_TRIMESTRAL",
  "DOC_COMPROVANTE_MATRICULA",
  "DOC_CARTAO_ESTUDANTE",
  "DOC_FICHA_INSCRICAO",
  "DOC_HISTORICO_ESCOLAR",
  "DOC_CERTIFICADO_HABILITACOES",
] as const;

async function authorize() {
  const supabase = await supabaseServerTyped<any>();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { supabase, error: NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 }) };
  const escolaId = await resolveEscolaIdForUser(supabase, auth.user.id);
  if (!escolaId) return { supabase, error: NextResponse.json({ ok: false, error: "Escola não identificada" }, { status: 403 }) };
  const authz = await requireRoleInSchool({ supabase, escolaId, roles: [...K12_SECRETARIA_OPERACIONAL_ROLE_GROUP] });
  if (authz.error) return { supabase, error: authz.error };
  return { supabase, user: auth.user, escolaId, error: null };
}

export async function GET() {
  try {
    const authz = await authorize();
    if (authz.error || !authz.escolaId) return authz.error;
    const { data: pedidos, error } = await authz.supabase
      .from("servico_pedidos")
      .select("id, aluno_id, matricula_id, servico_codigo, servico_nome, valor_cobrado, reason_detail, contexto, created_at")
      .eq("escola_id", authz.escolaId)
      .eq("status", "blocked")
      .eq("valor_cobrado", 0)
      .in("servico_codigo", [...PORTAL_DOCUMENT_CODES])
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(50);
    if (error) throw error;

    const alunoIds = [...new Set((pedidos ?? []).map((pedido: any) => pedido.aluno_id).filter(Boolean))];
    const { data: alunos, error: alunosError } = alunoIds.length
      ? await authz.supabase.from("alunos").select("id, nome, nome_completo, numero_processo").eq("escola_id", authz.escolaId).in("id", alunoIds)
      : { data: [], error: null };
    if (alunosError) throw alunosError;
    const alunosById = new Map<string, any>((alunos ?? []).map((aluno: any) => [String(aluno.id), aluno] as [string, any]));

    return NextResponse.json({
      ok: true,
      items: (pedidos ?? []).map((pedido: any) => ({
        ...pedido,
        aluno: alunosById.get(pedido.aluno_id) ?? null,
        proximo_passo: "Revisar o pedido e aprovar ou rejeitar com motivo.",
      })),
    });
  } catch (error) {
    console.error("[SECRETARIA_DOCUMENTOS_APROVACOES_GET]", error);
    return NextResponse.json({ ok: false, error: "Não foi possível carregar as aprovações" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authz = await authorize();
    if (authz.error || !authz.escolaId || !authz.user) return authz.error;
    const parsed = DecisionSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ ok: false, error: "Pedido e decisão são obrigatórios" }, { status: 400 });
    if (parsed.data.decision === "reject" && !parsed.data.motivo) {
      return NextResponse.json({ ok: false, error: "Informe o motivo da rejeição" }, { status: 400 });
    }

    const nextStatus = parsed.data.decision === "approve" ? "granted" : "canceled";
    const update: Record<string, unknown> = { status: nextStatus };
    if (parsed.data.decision === "reject") {
      update.reason_code = "SECRETARIA_DIGITAL_REJECTED";
      update.reason_detail = parsed.data.motivo;
    } else {
      update.reason_code = null;
      update.reason_detail = null;
    }

    const { data: pedido, error } = await authz.supabase
      .from("servico_pedidos")
      .update(update)
      .eq("id", parsed.data.pedidoId)
      .eq("escola_id", authz.escolaId)
      .eq("status", "blocked")
      .eq("valor_cobrado", 0)
      .in("servico_codigo", [...PORTAL_DOCUMENT_CODES])
      .select("id, aluno_id, servico_codigo, servico_nome, status")
      .maybeSingle();
    if (error) throw error;
    if (!pedido) return NextResponse.json({ ok: false, error: "Pedido já tratado ou não encontrado", code: "REQUEST_ALREADY_HANDLED" }, { status: 409 });

    await recordAuditServer({
      escolaId: authz.escolaId,
      portal: "secretaria",
      acao: parsed.data.decision === "approve" ? "DOCUMENTO_GRATUITO_APROVADO" : "DOCUMENTO_GRATUITO_REJEITADO",
      entity: "servico_pedidos",
      entityId: pedido.id,
      details: { aluno_id: pedido.aluno_id, servico_codigo: pedido.servico_codigo, motivo: parsed.data.motivo ?? null },
    });

    return NextResponse.json({ ok: true, item: pedido, message: parsed.data.decision === "approve" ? "Pedido aprovado. O aluno já pode emitir o documento." : "Pedido rejeitado com motivo." });
  } catch (error) {
    console.error("[SECRETARIA_DOCUMENTOS_APROVACOES_POST]", error);
    return NextResponse.json({ ok: false, error: "Não foi possível decidir este pedido" }, { status: 500 });
  }
}
