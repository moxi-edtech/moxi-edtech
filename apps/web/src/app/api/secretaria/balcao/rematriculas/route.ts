import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRoleInSchool } from "@/lib/authz";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import {
  AcademicYearContextError,
  assertAcademicYearEntity,
  resolveAcademicYearContext,
} from "@/lib/academic-year/context";
import { emitirComprovanteMatricula } from "@/lib/documentos/emitirComprovanteMatricula";
import { recordAuditServer } from "@/lib/audit";
import type { Database } from "~types/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const Body = z.object({
  aluno_id: z.string().uuid(),
  matricula_id: z.string().uuid(),
  ano_letivo_id: z.string().uuid(),
  destino_turma_id: z.string().uuid(),
  metodo: z.enum(["cash", "tpa", "transfer", "mcx", "kiwk"]),
  reference: z.string().trim().min(1).nullable().optional(),
  evidence_url: z.string().trim().min(1).nullable().optional(),
  gateway_ref: z.string().trim().min(1).nullable().optional(),
  notas_lancar_depois: z.boolean().optional(),
});

const SERVICE_CODE = "SERV_REMATRICULA";

function classeNumero(classe: any): number | null {
  const numero = Number(classe?.numero);
  if (Number.isFinite(numero) && numero > 0) return numero;
  const match = String(classe?.nome || "").match(/(\d{1,2})\s*(?:ª|a)?/i);
  return match ? Number(match[1]) : null;
}

function errorResponse(error: unknown) {
  if (error instanceof AcademicYearContextError) {
    return NextResponse.json({ ok: false, error: error.message, code: error.code }, { status: error.status });
  }
  throw error;
}

export async function POST(request: Request) {
  const idempotencyKey = request.headers.get("Idempotency-Key") ?? request.headers.get("idempotency-key");
  if (!idempotencyKey) {
    return NextResponse.json({ ok: false, error: "Idempotency-Key header é obrigatório" }, { status: 400 });
  }

  try {
    const supabase = await supabaseServerTyped<Database>();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const escolaId = await resolveEscolaIdForUser(supabase, user.id);
    if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não identificada" }, { status: 403 });
    const authz = await requireRoleInSchool({
      supabase,
      escolaId,
      roles: ["secretaria", "secretaria_financeiro", "admin_financeiro", "admin", "admin_escola", "staff_admin"],
    });
    if (authz.error) return authz.error;

    const parsed = Body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || "Payload inválido" }, { status: 400 });
    }
    const body = parsed.data;

    let academicContext;
    try {
      academicContext = await resolveAcademicYearContext(supabase as any, {
        userId: user.id,
        requestedAcademicYearId: body.ano_letivo_id,
        operation: "WRITE",
      });
      await assertAcademicYearEntity(supabase as any, {
        table: "turmas",
        entityId: body.destino_turma_id,
        escolaId,
        anoLetivoId: academicContext.anoLetivoId,
      });
    } catch (error) {
      return errorResponse(error);
    }

    const { data: matricula } = await supabase
      .from("matriculas")
      .select("id, aluno_id, turma_id, status, session_id, ano_letivo")
      .eq("escola_id", escolaId)
      .eq("id", body.matricula_id)
      .eq("aluno_id", body.aluno_id)
      .in("status", ["ativo", "ativa", "active", "pendente", "aprovado", "aprovada"])
      .maybeSingle();
    if (!matricula) {
      return NextResponse.json({ ok: false, error: "Matrícula de origem do aluno não encontrada.", code: "REMATRICULA_SOURCE_INVALID" }, { status: 409 });
    }

    const targetAnoLetivoAno = Number(academicContext.anoLetivoLabel.slice(0, 4));
    const { data: matriculaDestino } = await supabase
      .from("matriculas")
      .select("id, turma_id")
      .eq("escola_id", escolaId)
      .eq("aluno_id", body.aluno_id)
      .eq("ano_letivo", targetAnoLetivoAno)
      .in("status", ["ativo", "ativa", "active", "pendente", "aprovado", "aprovada"])
      .limit(1)
      .maybeSingle();
    const { data: reclassificacao } = matriculaDestino
      ? await (supabase as any)
          .from("matricula_reclassificacoes")
          .select("id, tipo, status")
          .eq("escola_id", escolaId)
          .eq("matricula_id", matriculaDestino.id)
          .eq("status", "aguardando_destino")
          .maybeSingle()
      : { data: null };

    const [{ data: turmaOrigem }, { data: turmaDestino }] = await Promise.all([
      matricula.turma_id
        ? supabase.from("turmas").select("id, classe_id, curso_id").eq("escola_id", escolaId).eq("id", matricula.turma_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from("turmas").select("id, classe_id, curso_id").eq("escola_id", escolaId).eq("id", body.destino_turma_id).maybeSingle(),
    ]);
    const classeIds = [turmaOrigem?.classe_id, turmaDestino?.classe_id].filter((id): id is string => Boolean(id));
    const { data: classes } = classeIds.length > 0
      ? await supabase.from("classes").select("id, nome, numero").eq("escola_id", escolaId).in("id", classeIds)
      : { data: [] };
    const classeById = new Map((classes || []).map((classe: any) => [classe.id, classe]));
    const numeroOrigem = classeNumero(classeById.get(turmaOrigem?.classe_id));
    const numeroDestino = classeNumero(classeById.get(turmaDestino?.classe_id));
    // Uma matrícula destino existente já passou pela promoção/reclassificação.
    // O Balcão apenas cobra a reconfirmação ou resolve a decisão de finalista.
    if (!matriculaDestino) {
      const resultado = await supabase
        .from("historico_anos")
        .select("resultado_final")
        .eq("escola_id", escolaId)
        .eq("aluno_id", body.aluno_id)
        .eq("ano_letivo", Number(matricula.ano_letivo))
        .maybeSingle();
      const resultadoFinal = String(resultado.data?.resultado_final || "").toLowerCase();
      const reprovado = ["reprovado", "reprovada", "reprovado_por_faltas"].includes(String(matricula.status).toLowerCase()) || resultadoFinal.includes("reprov");
      const notasPendentes = !reprovado && !resultadoFinal.includes("aprov");
      if (notasPendentes && body.notas_lancar_depois !== true) {
        return NextResponse.json({ ok: false, error: "Confirme que as notas serão lançadas posteriormente antes de rematricular.", code: "REMATRICULA_DECISION_REQUIRED" }, { status: 409 });
      }

      if (numeroOrigem !== null && numeroDestino !== null) {
        if (numeroOrigem === 12 && !reprovado) {
          return NextResponse.json({ ok: false, error: "A 12ª classe não tem uma classe seguinte configurada.", code: "REMATRICULA_PROGRESSION_INVALID" }, { status: 409 });
        }
        const esperado = reprovado ? numeroOrigem : numeroOrigem + 1;
        if (numeroDestino !== esperado) {
          return NextResponse.json({ ok: false, error: reprovado ? "O aluno deve permanecer na classe em que reprovou." : "A turma destino deve ser a classe imediatamente seguinte.", code: "REMATRICULA_PROGRESSION_INVALID" }, { status: 409 });
        }
      }
      if (turmaOrigem?.curso_id && turmaDestino?.curso_id && turmaOrigem.curso_id !== turmaDestino.curso_id) {
        return NextResponse.json({ ok: false, error: "A turma destino pertence a outro curso.", code: "REMATRICULA_PROGRESSION_INVALID" }, { status: 409 });
      }
    }

    const { data: service, error: serviceError } = await (supabase as any)
      .from("servicos_escola")
      .select("id, codigo, nome, valor_base, ativo")
      .eq("escola_id", escolaId)
      .eq("codigo", SERVICE_CODE)
      .maybeSingle();
    if (serviceError) throw serviceError;
    if (!service || !service.ativo || Number(service.valor_base) <= 0) {
      return NextResponse.json({ ok: false, error: "O emolumento de rematrícula ainda não está configurado.", code: "REMATRICULA_PRICE_NOT_CONFIGURED" }, { status: 409 });
    }

    const { data: pedidosExistentes } = await (supabase as any)
      .from("servico_pedidos")
      .select("id, status, contexto")
      .eq("escola_id", escolaId)
      .eq("aluno_id", body.aluno_id)
      .eq("servico_codigo", SERVICE_CODE)
      .in("status", ["pending_payment", "granted"])
      .order("created_at", { ascending: false });
    const pedidoExistente = (pedidosExistentes ?? []).find(
      (pedido: any) => pedido.contexto?.ano_letivo_id === academicContext.anoLetivoId,
    ) ?? (pedidosExistentes ?? []).find(
      (pedido: any) => !pedido.contexto || Object.keys(pedido.contexto).length === 0,
    );
    const pedidoLegado = Boolean(
      pedidoExistente && (!pedidoExistente.contexto || Object.keys(pedidoExistente.contexto).length === 0),
    );
    if (pedidoLegado) {
      return NextResponse.json({ ok: false, error: "Existe um pedido antigo sem ano letivo identificado. Envie para reconciliação antes de criar uma nova taxa.", code: "REMATRICULA_LEGACY_REVIEW_REQUIRED", pedido_id: pedidoExistente.id }, { status: 409 });
    }
    if (pedidoExistente?.status === "granted") {
      const matriculaDestinoId = String((pedidoExistente.contexto as any)?.matricula_destino_id ?? body.matricula_id);
      const comprovante = await emitirComprovanteMatricula({
        supabase,
        escolaId,
        matriculaId: matriculaDestinoId,
        dataHoraEfetivacao: new Date().toISOString(),
        createdBy: user.id,
        audit: { portal: "secretaria", acao: "REMATRICULA_COMPROVANTE_REUTILIZADO" },
      });
      return NextResponse.json({ ok: true, pedido_id: pedidoExistente.id, rematricula: { matricula_id: matriculaDestinoId, ano_letivo_id: academicContext.anoLetivoId }, comprovante });
    }
    if (pedidoExistente?.status === "pending_payment") {
      if (pedidoLegado) {
        return NextResponse.json({ ok: false, error: "Existe um pedido antigo sem ano letivo identificado. Envie para reconciliação antes de criar uma nova taxa.", code: "REMATRICULA_LEGACY_REVIEW_REQUIRED", pedido_id: pedidoExistente.id }, { status: 409 });
      }
      return NextResponse.json({ ok: false, error: "Já existe uma rematrícula em pagamento para este aluno e ano.", code: "PAYMENT_IN_PROGRESS", pedido_id: pedidoExistente.id }, { status: 409 });
    }

    if (matriculaDestino && !reclassificacao && matriculaDestino.turma_id !== body.destino_turma_id) {
      return NextResponse.json(
        { ok: false, error: "A reconfirmação deve manter a turma destino já preparada.", code: "RECONFIRMATION_TURMA_MISMATCH" },
        { status: 409 },
      );
    }

    const { data: pedido, error: pedidoError } = await (supabase as any)
      .from("servico_pedidos")
      .insert({
        escola_id: escolaId,
        aluno_id: body.aluno_id,
        matricula_id: body.matricula_id,
        servico_escola_id: service.id,
        status: "pending_payment",
        servico_codigo: SERVICE_CODE,
        servico_nome: service.nome,
        valor_cobrado: Number(service.valor_base),
        contexto: {
          origem: "rematricula_balcao",
          ano_letivo_id: academicContext.anoLetivoId,
          destino_turma_id: body.destino_turma_id,
          notas_lancar_depois: body.notas_lancar_depois === true,
          idempotency_key: idempotencyKey,
        },
        created_by: user.id,
      })
      .select("id")
      .single();
    if (pedidoError) throw pedidoError;

    const paymentUrl = new URL("/api/secretaria/balcao/pagamentos", request.url);
    const paymentResponse = await fetch(paymentUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
        cookie: request.headers.get("cookie") ?? "",
      },
      body: JSON.stringify({
        aluno_id: body.aluno_id,
        mensalidade_id: null,
        ano_letivo_id: academicContext.anoLetivoId,
        valor: Number(service.valor_base),
        metodo: body.metodo,
        reference: body.reference ?? null,
        evidence_url: body.evidence_url ?? null,
        gateway_ref: body.gateway_ref ?? null,
        meta: {
          origem: "rematricula_balcao",
          servico_codigo: SERVICE_CODE,
          pedido_id: pedido.id,
          rematricula_ano_letivo_id: academicContext.anoLetivoId,
        },
      }),
    });
    const paymentJson = await paymentResponse.json().catch(() => null);
    if (!paymentResponse.ok || !paymentJson?.ok) {
      await (supabase as any).from("servico_pedidos").update({ status: "canceled", reason_code: "PAYMENT_FAILED", reason_detail: paymentJson?.error || "Falha no pagamento" }).eq("id", pedido.id).eq("escola_id", escolaId);
      return NextResponse.json({ ok: false, error: paymentJson?.error || "Falha ao registar o pagamento.", code: "PAYMENT_REQUIRED" }, { status: 400 });
    }

    let matriculaDestinoId = "";
    let finalizacao: any;
    let finalizacaoError: any = null;

    if (matriculaDestino && reclassificacao) {
      const result = await (supabase as any).rpc("finalistas_matricular_novo_ciclo", {
        p_escola_id: escolaId,
        p_reclassificacao_ids: [reclassificacao.id],
        p_turma_destino_id: body.destino_turma_id,
        p_motivo: "Continuidade confirmada e taxa de reconfirmação paga no Balcão",
      });
      finalizacao = result.data;
      finalizacaoError = result.error;
      if (finalizacao?.ok) {
        matriculaDestinoId = String(matriculaDestino.id);
        await (supabase as any)
          .from("servico_pedidos")
          .update({
            status: "granted",
            matricula_id: matriculaDestinoId,
            contexto: {
              ...(pedido.contexto ?? {}),
              matricula_destino_id: matriculaDestinoId,
              destino_turma_id: body.destino_turma_id,
              finalista: true,
              decisao: "matriculado_novo_ciclo",
            },
          })
          .eq("id", pedido.id)
          .eq("escola_id", escolaId);
      }
    } else if (matriculaDestino) {
      matriculaDestinoId = String(matriculaDestino.id);
      const { error } = await (supabase as any)
        .from("servico_pedidos")
        .update({
          status: "granted",
          matricula_id: matriculaDestinoId,
          contexto: {
            ...(pedido.contexto ?? {}),
            matricula_destino_id: matriculaDestinoId,
            destino_turma_id: body.destino_turma_id,
            decisao: "reconfirmacao",
          },
        })
        .eq("id", pedido.id)
        .eq("escola_id", escolaId);
      finalizacaoError = error;
      finalizacao = { ok: !error, matricula_id: matriculaDestinoId, turma_id: body.destino_turma_id };
    } else {
      const result = await (supabase as any).rpc("finalizar_rematricula_balcao", {
        p_escola_id: escolaId,
        p_aluno_id: body.aluno_id,
        p_matricula_origem_id: body.matricula_id,
        p_ano_letivo_id: academicContext.anoLetivoId,
        p_destino_turma_id: body.destino_turma_id,
        p_pedido_id: pedido.id,
      });
      finalizacao = result.data;
      finalizacaoError = result.error;
      matriculaDestinoId = String(finalizacao?.matricula_id ?? "");
    }
    if (finalizacaoError || !finalizacao?.ok) {
      const reason = finalizacaoError?.message || finalizacao?.erro || "Falha ao concluir a matrícula destino";
      await (supabase as any).from("servico_pedidos").update({ status: "pending_payment", reason_code: "REMATRICULA_RECONCILIATION_REQUIRED", reason_detail: reason }).eq("id", pedido.id).eq("escola_id", escolaId);
      return NextResponse.json({ ok: false, error: "Pagamento confirmado, mas a matrícula precisa de reconciliação.", code: "REMATRICULA_RECONCILIATION_REQUIRED", payment: paymentJson.data ?? null, pedido_id: pedido.id }, { status: 409 });
    }
    matriculaDestinoId = String(finalizacao.matricula_id ?? matriculaDestinoId);

    const comprovante = await emitirComprovanteMatricula({
      supabase,
      escolaId,
      matriculaId: matriculaDestinoId,
      dataHoraEfetivacao: new Date().toISOString(),
      createdBy: user.id,
      audit: { portal: "secretaria", acao: "REMATRICULA_COMPROVANTE_EMITIDO" },
    });
    if (!comprovante.ok) {
      return NextResponse.json({ ok: false, error: "Rematrícula e pagamento concluídos, mas o comprovante precisa ser reemitido.", code: "DOCUMENT_PENDING", pedido_id: pedido.id, payment: paymentJson.data ?? null, comprovante }, { status: 202 });
    }

    recordAuditServer({
      escolaId,
      portal: "secretaria",
      acao: "REMATRICULA_BALCAO_CONCLUIDA",
      entity: "matriculas",
      entityId: matriculaDestinoId,
      details: {
        aluno_id: body.aluno_id,
        ano_letivo_id: academicContext.anoLetivoId,
        destino_turma_id: body.destino_turma_id,
        pedido_id: pedido.id,
        pagamento_id: paymentJson.data?.id ?? null,
        documento_id: comprovante.docId,
      },
    }).catch(() => null);

    return NextResponse.json({
      ok: true,
      pedido_id: pedido.id,
      rematricula: { matricula_id: matriculaDestinoId, ano_letivo_id: academicContext.anoLetivoId, turma_id: body.destino_turma_id },
      pagamento: paymentJson.data ?? null,
      comprovante,
    });
  } catch (error) {
    if (error instanceof AcademicYearContextError) return errorResponse(error);
    const message = error instanceof Error ? error.message : String(error);
    console.error("[REMATRICULA-BALCAO]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
