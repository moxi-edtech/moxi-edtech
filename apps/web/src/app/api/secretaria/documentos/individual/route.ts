import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { requireRoleInSchool } from "@/lib/authz";
import { K12_SECRETARIA_OPERACIONAL_ROLE_GROUP } from "@/lib/roles";
import { AcademicYearContextError, resolveAcademicYearContext } from "@/lib/academic-year/context";
import { TIPOS_DOCUMENTO_EMITIVEL, docPrintUrl } from "@/lib/documentos/printUrl";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const schema = z.object({
  alunoId: z.string().uuid(),
  escolaId: z.string().uuid(),
  ano_letivo_id: z.string().uuid(),
  tipoDocumento: z.enum(TIPOS_DOCUMENTO_EMITIVEL),
  action: z.enum(["status", "solicitar"]),
});

export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ ok: false, error: "Aluno, documento e ano letivo são obrigatórios." }, { status: 400 });
    const { escolaId, alunoId, ano_letivo_id, tipoDocumento, action } = parsed.data;
    const supabase = await supabaseServerTyped<any>();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    const escola = await resolveEscolaIdForUser(supabase, auth.user.id, escolaId);
    if (escola !== escolaId) return NextResponse.json({ ok: false, error: "Escola inválida" }, { status: 403 });
    const { error: authError } = await requireRoleInSchool({
      supabase, escolaId, roles: [...K12_SECRETARIA_OPERACIONAL_ROLE_GROUP],
    });
    if (authError) return authError;

    const academicContext = await resolveAcademicYearContext(supabase, {
      userId: auth.user.id,
      requestedAcademicYearId: ano_letivo_id,
      operation: tipoDocumento === "boletim_trimestral" ? "WRITE" : "READ",
    });
    if (academicContext.escolaId !== escolaId) {
      return NextResponse.json({ ok: false, error: "Ano letivo de outra escola." }, { status: 403 });
    }

    const { data: matricula, error: matriculaError } = await supabase.from("matriculas")
      .select("id").eq("escola_id", escolaId).eq("aluno_id", alunoId)
      .eq("session_id", academicContext.anoLetivoId)
      .in("status", ["ativa","ativo","matriculado","concluido","reprovado","transferido","trancado"])
      .order("created_at", { ascending: false }).order("id", { ascending: false })
      .limit(1).maybeSingle();
    if (matriculaError) throw matriculaError;
    if (!matricula) return NextResponse.json({
      ok: false, code: "MATRICULA_NAO_ENCONTRADA",
      error: "O aluno não possui matrícula no ano letivo escolhido.",
    }, { status: 409 });

    // Um documento existente é reaberto sem nova solicitação nem cobrança.
    const { data: doc, error: docError } = await supabase.from("documentos_emitidos")
      .select("id, public_id, created_at")
      .eq("escola_id", escolaId).eq("aluno_id", alunoId).eq("tipo", tipoDocumento)
      .contains("dados_snapshot", { matricula_id: matricula.id })
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (docError) throw docError;
    if (doc?.id) return NextResponse.json({
      ok: true, status: "issued", granted: true,
      docId: doc.id, publicId: doc.public_id,
      printUrl: docPrintUrl(doc.id, tipoDocumento),
      message: "Documento já emitido. Pode imprimir novamente sem pagar.",
    });

    const { data: access, error: accessError } = await supabase.rpc(
      action === "solicitar" ? "documento_individual_solicitar" : "documento_individual_acesso",
      { p_escola_id: escolaId, p_aluno_id: alunoId, p_session_id: academicContext.anoLetivoId, p_tipo: tipoDocumento },
    );
    if (accessError) throw accessError;
    if (!access?.ok) return NextResponse.json({
      ok: false, code: access?.reason ?? "DOCUMENTO_INDISPONIVEL",
      error: ({
        SERVICO_NAO_CONFIGURADO: "Configure o serviço documental em Emolumentos & Serviços.",
        TAXA_NAO_CONFIGURADA: "Configure uma taxa positiva para este documento antes de emitir.",
        MATRICULA_NAO_ENCONTRADA: "A matrícula deste ano letivo não foi encontrada.",
      } as Record<string,string>)[access?.reason] ?? "Documento não disponível.",
    }, { status: 409 });

    return NextResponse.json({
      ok: true, status: access.status, granted: access.granted === true,
      valor: Number(access.valor ?? 0),
      matriculaId: access.matricula_id,
      pedidoId: access.pedido_id ?? null,
      pagamentoIntentId: access.pagamento_intent_id ?? null,
      servicoCodigo: access.servico_codigo,
      pagamentoObrigatorio: access.pagamento_obrigatorio === true,
    });
  } catch (error) {
    if (error instanceof AcademicYearContextError) {
      return NextResponse.json({ ok: false, error: error.message, code: error.code }, { status: error.status });
    }
    console.error("[DOCUMENTOS_INDIVIDUAIS]", error);
    return NextResponse.json({ ok: false, error: "Não foi possível verificar a emissão. Tente novamente sem repetir o pagamento." }, { status: 503 });
  }
}
