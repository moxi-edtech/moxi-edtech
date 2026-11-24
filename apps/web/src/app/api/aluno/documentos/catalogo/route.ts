import { portalDocumentType, DOCUMENT_BLOCK_REASONS } from "@/lib/documentos/portalDocumentPolicy";
import { isBoletimPaid, BOLETIM_SERVICE_CODE } from "@/lib/aluno/boletimAccess";
import { NextResponse } from "next/server";
import { getAlunoContext } from "@/lib/alunoContext";
import { AcademicYearContextError } from "@/lib/academic-year/context";
import { resolveBoletimMatricula } from "@/lib/aluno/resolveBoletimMatricula";
import { resolveSelectedStudentId } from "@/lib/portalAlunoAuth";

export const dynamic = "force-dynamic";

const PORTAL_DOCUMENT_CODES = [
  "DOC_DECLARACAO_FREQUENCIA",
  "DOC_DECLARACAO_NOTAS",
  "DOC_BOLETIM_TRIMESTRAL",
  "DOC_COMPROVANTE_MATRICULA",
  "DOC_CARTAO_ESTUDANTE",
  "DOC_FICHA_INSCRICAO",
  "DOC_HISTORICO_ESCOLAR",
  "DOC_CERTIFICADO_HABILITACOES",
] as const;

export async function GET(request: Request) {
  try {
    const { supabase, ctx } = await getAlunoContext();
    if (!ctx || !ctx.escolaId) {
      return NextResponse.json({ ok: false, error: "Não foi possível identificar o aluno ou encarregado", next_action: { type: "contact_secretaria", label: "Contactar a secretaria", href: "/aluno/avisos" } }, { status: 401 });
    }

    const authorizedIds = ctx.alunoIds;
    const requestedId = new URL(request.url).searchParams.get("studentId");
    if (requestedId && !authorizedIds.includes(requestedId)) return NextResponse.json({ ok: false, error: "Aluno não autorizado" }, { status: 403 });
    const selectedId = resolveSelectedStudentId({ selectedId: requestedId, authorizedIds, fallbackId: ctx.alunoId });
    if (!selectedId) return NextResponse.json({ ok: false, error: "Nenhum educando autorizado encontrado", next_action: { type: "contact_secretaria", label: "Regularizar acesso", href: "/aluno/avisos" } }, { status: 403 });

    const { escolaId } = ctx;
    const { matricula, context } = await resolveBoletimMatricula(supabase, {
      escolaId, alunoId: selectedId, userId: ctx.userId,
      anoLetivoId: new URL(request.url).searchParams.get("ano_letivo_id"),
    });
    if (!matricula?.id) return NextResponse.json({ ok: false, error: "O educando não possui matrícula no ano letivo selecionado", next_action: { type: "contact_secretaria", label: "Contactar a secretaria", href: "/aluno/avisos" } }, { status: 409 });

    // 1. Buscar catálogo de documentos da escola
    const { data: catalogo, error: catError } = await supabase
      .from("servicos_escola")
      .select("id, codigo, nome, descricao, valor_base, exige_pagamento_antes_de_liberar, exige_aprovacao")
      .eq("escola_id", escolaId)
      .eq("ativo", true)
      .in("codigo", [...PORTAL_DOCUMENT_CODES])
      .order("nome", { ascending: true });

    if (catError) throw catError;
    const { data: policy, error: policyError } = await (supabase as any).rpc('aluno_documento_acesso', {
      p_escola_id: escolaId, p_aluno_id: selectedId, p_matricula_id: matricula.id,
      p_session_id: context.anoLetivoId, p_tipo: null,
    });
    if (policyError || !policy) return NextResponse.json({ ok: false, error: 'Não foi possível verificar os documentos.' }, { status: 503 });

    // 2. Buscar pedidos e intenções
    const { data: pedidos, error: pedError } = await supabase
      .from("servico_pedidos")
      .select("id, status, servico_codigo, valor_cobrado, contexto, reason_detail, created_at, pagamento_intents(id, status, meta, created_at)")
      .eq("aluno_id", selectedId)
      .eq("escola_id", escolaId)
      .eq("matricula_id", matricula.id)
      .order("created_at", { ascending: false });

    if (pedError) throw pedError;

    // 3. Dados de pagamento da escola
    let dados_pagamento: any = null;
    const { data: escola } = await supabase.from('escolas').select('dados_pagamento').eq('id', escolaId).maybeSingle();
    if (escola?.dados_pagamento) {
      const raw = escola.dados_pagamento as Record<string, unknown>;
      dados_pagamento = {
        banco: typeof raw.banco === "string" ? raw.banco : null,
        iban: typeof raw.iban === "string" ? raw.iban : null,
        titular_conta: typeof raw.titular_conta === "string" ? raw.titular_conta : null,
        kwik_chave: typeof raw.kwik_chave === "string" ? raw.kwik_chave : null,
      };
    }

    // Pedidos pagos são associados à matrícula; uma intenção isolada "settled"
    // não desbloqueia notas sem a concessão do serviço.
    const boletimPago = isBoletimPaid((pedidos ?? []).map((pedido) => ({
      servico_codigo: pedido.servico_codigo,
      valor_cobrado: pedido.valor_cobrado,
      status: pedido.status,
      contexto: pedido.contexto,
      pagamento_intents: (pedido.pagamento_intents ?? []).map((intent) => ({ status: intent.status })),
    })));
    const pedidoBoletimPago = (pedidos ?? []).find((order) =>
      isBoletimPaid([order]));
    const docs = catalogo.map((item) => {
      const pedidosServico = (pedidos ?? []).filter((pedido) => pedido.servico_codigo === item.codigo);
      const pedido = pedidosServico.find((order) => order.status === "granted" && (
        item.codigo !== BOLETIM_SERVICE_CODE ||
        (Number(order.valor_cobrado) > 0 && (order.pagamento_intents ?? []).some((intent) => intent.status === "settled"))
      )) ?? pedidosServico[0];
      const intents = [...(pedido?.pagamento_intents ?? [])].sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
      const intent = intents[0] ?? null;
      let status = pedido?.status || "available";
      if (intent?.status === "pending" && status !== "granted") status = "pending";
      else if (intent?.status === "failed" || pedido?.status === "canceled") status = "rejected";
      else if (intent?.status === "settled" && status !== "granted") status = "pending";
      if (item.codigo === BOLETIM_SERVICE_CODE && boletimPago) status = "granted";
      if (item.codigo === BOLETIM_SERVICE_CODE && status === "granted" && !boletimPago) {
        status = "pending";
      }
      const tipo = portalDocumentType(item.codigo);
      const decision = tipo ? policy[tipo] : null;
      if (tipo) {
        if (!decision?.ok) status = 'available';
        else if (decision.granted === true) status = 'granted';
        else if (decision.status === 'approval') status = decision.pedido_id ? 'blocked' : 'available';
        else if (decision.status === 'verification') status = 'pending';
        else if (decision.status === 'pending_payment') status = decision.pagamento_intent_id ? 'pending_payment' : 'available';
      }
      const chosenPedido = tipo ? pedidosServico.find(order => order.id === decision?.pedido_id) : pedido;
      const chosenIntent = tipo ? (chosenPedido?.pagamento_intents ?? []).find(order => order.id === decision?.pagamento_intent_id) : intent;
      if (tipo && decision?.ok && !decision.granted && chosenIntent?.status === 'failed') status = 'rejected';
      const metadata = chosenIntent?.meta && typeof chosenIntent.meta === "object" && !Array.isArray(chosenIntent.meta)
        ? chosenIntent.meta : null;
      return {
        ...item,
        pedido_id: tipo ? decision?.pedido_id ?? null : pedido?.id ?? null,
        pagamento_intent_id: tipo ? decision?.pagamento_intent_id ?? null : intent?.id ?? null,
        indisponivel_motivo: tipo && !decision?.ok ? DOCUMENT_BLOCK_REASONS[decision?.reason] ?? 'Documento indisponível.' : null,
        status,
        valor: item.codigo === BOLETIM_SERVICE_CODE && boletimPago
          ? pedidoBoletimPago?.valor_cobrado ?? item.valor_base
          : tipo ? chosenPedido?.valor_cobrado ?? decision?.valor ?? item.valor_base : pedido?.valor_cobrado ?? item.valor_base,
        // Uma taxa de 0 Kz não significa automaticamente gratuidade:
        // há escolas com pagamento obrigatório ainda sem preço configurado.
        pagamento_configurado: tipo ? decision?.ok === true : Number(pedido?.valor_cobrado ?? item.valor_base) > 0 ||
          (!item.exige_pagamento_antes_de_liberar && item.codigo !== BOLETIM_SERVICE_CODE) ||
          (item.codigo === BOLETIM_SERVICE_CODE && boletimPago) ||
          (status === "granted" && item.codigo !== BOLETIM_SERVICE_CODE),
        reject_reason: typeof metadata?.reject_reason === "string" ? metadata.reject_reason : chosenPedido?.reason_detail ?? null,
        next_action: status === "granted"
          ? { type: "download", label: "Descarregar", href: "/aluno/documentos" }
          : status === "pending" || status === "blocked"
            ? { type: "refresh_status", label: "Actualizar estado", href: "/aluno/documentos" }
            : status === "rejected"
              ? { type: "resubmit", label: "Reenviar comprovativo", href: "/aluno/documentos" }
              : { type: "request", label: "Solicitar serviço", href: "/aluno/documentos" },
      };
    });

    return NextResponse.json({ ok: true, documentos: docs, dados_pagamento, boletim_pago: boletimPago });
  } catch (error: unknown) {
    if (error instanceof AcademicYearContextError) {
      return NextResponse.json({ ok: false, error: error.message, code: error.code }, { status: error.status });
    }
    console.error("[DocsCatalogo] Error:", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ ok: false, error: "Falha ao carregar catálogo" }, { status: 500 });
  }
}
