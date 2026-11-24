import { NextResponse } from "next/server";
import { z } from "zod";
import { createHash, randomUUID } from "crypto";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { requireRoleInSchool } from "@/lib/authz";
import type { Database } from "~types/supabase";
import { recordAuditServer } from "@/lib/audit";
import { dispatchAlunoNotificacao } from "@/lib/notificacoes/dispatchAlunoNotificacao";
import { requireFeature } from "@/lib/plan/requireFeature";
import { HttpError } from "@/lib/errors";
import { K12_DOCUMENTOS_ROLE_GROUP } from "@/lib/roles";
import { AcademicYearContextError, resolveAcademicYearContext } from "@/lib/academic-year/context";
import { docPrintUrl } from "@/lib/documentos/printUrl";
import { verificarCertificadoElegivel } from "@/lib/documentos/certificadoElegibilidade";

const payloadSchema = z.object({
  alunoId: z.string().uuid(),
  escolaId: z.string().uuid(),
  tipoDocumento: z.enum([
    "declaracao_frequencia",
    "declaracao_notas",
    "boletim_trimestral",
    "cartao_estudante",
    "ficha_inscricao",
    "comprovante_matricula",
    "historico",
    "certificado",
  ]),
  ano_letivo: z.number().int().optional(), // Ano letivo para documentos finais
  ano_letivo_id: z.string().uuid().optional(),
  // O mesmo contrato da Central também consulta e solicita o serviço.
  // A ausência de action mantém os clientes legados em modo de emissão.
  action: z.enum(["status", "solicitar", "emitir"]).optional(),
});

type TipoDocumento = z.infer<typeof payloadSchema>["tipoDocumento"];

const FINAL_DOCUMENT_TYPES: TipoDocumento[] = ["historico", "certificado", "comprovante_matricula", "declaracao_notas"];
const FINAL_DOC_BACKEND_TYPE: Record<TipoDocumento, string> = {
  boletim_trimestral: "boletim_trimestral",
  historico: "historico",
  certificado: "certificado",
  comprovante_matricula: "comprovante_matricula",
  declaracao_notas: "declaracao_notas",
  declaracao_frequencia: "declaracao_frequencia",
  cartao_estudante: "cartao_estudante",
  ficha_inscricao: "ficha_inscricao",
};

function buildDocumentFingerprint(input: {
  escolaId: string;
  alunoId: string;
  tipoDocumento: TipoDocumento;
  anoLetivoId?: string | null;
  anoLetivo?: number | null;
}) {
  return createHash("sha256")
    .update(JSON.stringify({
      escolaId: input.escolaId,
      alunoId: input.alunoId,
      tipoDocumento: input.tipoDocumento,
      anoLetivoId: input.anoLetivoId ?? null,
      anoLetivo: input.anoLetivo ?? null,
    }))
    .digest("hex");
}

export async function POST(request: Request) {
  try {
    const idempotencyKey = (
      request.headers.get("Idempotency-Key")
      ?? request.headers.get("idempotency-key")
      ?? ""
    ).trim();
    const supabase = await supabaseServerTyped<Database>();
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;

    if (!user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const parsed = payloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.format() }, { status: 400 });
    }

    const { alunoId, escolaId, tipoDocumento, ano_letivo, ano_letivo_id } = parsed.data;
    const action = parsed.data.action ?? "emitir";
    if (action === "emitir" && (idempotencyKey.length < 8 || idempotencyKey.length > 200)) {
      return NextResponse.json({
        ok: false, error: "Idempotency-Key header é obrigatório e deve ter entre 8 e 200 caracteres.",
        code: "IDEMPOTENCY_KEY_REQUIRED",
      }, { status: 400 });
    }

    if (tipoDocumento === "certificado") {
      await requireFeature("doc_qr_code");
    }

    const resolvedEscolaId = await resolveEscolaIdForUser(supabase as any, user.id, escolaId);

    if (!resolvedEscolaId || resolvedEscolaId !== escolaId) {
      return NextResponse.json({ ok: false, error: "Escola inválida" }, { status: 403 });
    }

    const { error: authError } = await requireRoleInSchool({
      supabase,
      escolaId,
      roles: [...K12_DOCUMENTOS_ROLE_GROUP],
    });
    if (authError) return authError;

    // A Central é sempre contextual ao ano letivo selecionado (incluindo
    // ficha e cartão), para não emitir documentos no ano errado.
    let academicContext: Awaited<ReturnType<typeof resolveAcademicYearContext>> | null = null;
    if (!ano_letivo_id) {
      return NextResponse.json(
        { ok: false, error: "ano_letivo_id é obrigatório para este documento.", code: "ACADEMIC_YEAR_REQUIRED" },
        { status: 400 },
      );
    }
    if (ano_letivo_id) {
      academicContext = await resolveAcademicYearContext(supabase, {
        userId: user.id,
        requestedAcademicYearId: ano_letivo_id,
        // Emissão histórica não altera notas, períodos ou matrículas.
        operation: tipoDocumento === "boletim_trimestral" ? "WRITE" : "READ",
      });
      if (academicContext.escolaId !== escolaId) {
        return NextResponse.json({ ok: false, error: "Escola inválida" }, { status: 403 });
      }
    }

    // Reemissão / retry de documento existente: nunca gerar nem cobrar outro.
    // A própria impressão mantém autenticação e autorização por escola.
    const { data: enrollmentForDoc, error: enrollmentError } = await supabase.from("matriculas")
      .select("id").eq("escola_id", escolaId).eq("aluno_id", alunoId)
      .eq("session_id", academicContext!.anoLetivoId)
      .order("created_at", { ascending: false }).order("id", { ascending: false })
      .limit(1).maybeSingle();
    if (enrollmentError) return NextResponse.json({ ok: false, error: "Não foi possível consultar a matrícula. Tente novamente." }, { status: 503 });
    // Validar notas ANTES de apresentar checkout, cobrar ou reutilizar um
    // certificado anterior. Falha fechada: nunca imprimir um diploma sem pauta.
    if (tipoDocumento === "certificado") {
      const anoDoDocumento = Number(academicContext!.anoLetivoLabel.slice(0, 4));
      const elegibilidade = await verificarCertificadoElegivel({
        supabase, escolaId, alunoId, anoLetivo: anoDoDocumento,
      });
      if (!elegibilidade.ok) {
        const reconciliation = new URLSearchParams({
          tipo: "historicos", ano: String(anoDoDocumento),
        });
        if (enrollmentForDoc?.id) reconciliation.set("matricula_id", enrollmentForDoc.id);
        return NextResponse.json({
          ok: false, code: elegibilidade.code, error: elegibilidade.error,
          ...(elegibilidade.code === "CONSULTA_INDISPONIVEL" ? {} : {
            next_action: {
              type: "regularizar_historico",
              label: "Abrir Reconciliação Histórica",
              href: `/escola/${encodeURIComponent(escolaId)}/operacoes/academico/reconciliacao-historica?${reconciliation.toString()}`,
            },
          }),
        }, { status: elegibilidade.code === "CONSULTA_INDISPONIVEL" ? 503 : 409 });
      }
    }
    if (enrollmentForDoc?.id) {
      const { data: alreadyIssued, error: existingError } = await (supabase as any)
        .from("documentos_emitidos")
        .select("id, public_id, hash_validacao, tipo")
        .eq("escola_id", escolaId).eq("aluno_id", alunoId)
        .eq("tipo", tipoDocumento)
        .contains("dados_snapshot", { matricula_id: enrollmentForDoc.id })
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (existingError) return NextResponse.json({ ok: false, error: "Falha ao consultar emissões existentes." }, { status: 503 });
      if (alreadyIssued?.id) {
        // Ler/imprimir um documento existente não cria outro pedido financeiro.
        return NextResponse.json(action === "emitir" ? {
          ok: true, docId: alreadyIssued.id, publicId: alreadyIssued.public_id,
          hash: alreadyIssued.hash_validacao, tipo: alreadyIssued.tipo, idempotent: true,
        } : {
          ok: true, status: "issued", granted: true, docId: alreadyIssued.id,
          publicId: alreadyIssued.public_id, printUrl: docPrintUrl(alreadyIssued.id, tipoDocumento),
          message: "Documento já emitido. Pode imprimir novamente sem pagar.",
        });
      }
    }

    if (action !== "emitir") {
      if (!enrollmentForDoc?.id) {
        return NextResponse.json({
          ok: false, code: "MATRICULA_NAO_ENCONTRADA",
          error: "O aluno não possui matrícula no ano letivo escolhido.",
        }, { status: 409 });
      }
      // Uma consulta é somente leitura; a solicitação pode criar uma intenção,
      // mas apenas a RPC transacional realiza essa operação.
      const { data: access, error: accessError } = await (supabase as any).rpc(
        action === "solicitar" ? "documento_individual_solicitar" : "documento_individual_acesso",
        {
          p_escola_id: escolaId, p_aluno_id: alunoId,
          p_session_id: academicContext!.anoLetivoId, p_tipo: tipoDocumento,
        },
      );
      if (accessError) {
        return NextResponse.json({
          ok: false, error: "Não foi possível consultar o serviço documental.",
        }, { status: 503 });
      }
      if (!access?.ok) {
        const motivos: Record<string,string> = {
          SERVICO_NAO_CONFIGURADO: "Configure o serviço em Emolumentos & Serviços.",
          TAXA_NAO_CONFIGURADA: "O serviço exige pagamento, mas não tem taxa definida. Corrija em Emolumentos & Serviços.",
          MATRICULA_NAO_ENCONTRADA: "A matrícula do ano escolhido não foi encontrada.",
          HISTORICO_INEXISTENTE: "O histórico do ano escolhido não existe.",
          HISTORICO_ABERTO: "Feche o histórico do ano escolhido antes de emitir.",
          NOTAS_INEXISTENTES: "O histórico não tem classificações registadas.",
          NOTAS_INCOMPLETAS: "Regularize as classificações antes de emitir ou cobrar.",
        };
        return NextResponse.json({
          ok: false, code: access?.reason ?? "DOCUMENTO_INDISPONIVEL",
          error: motivos[access?.reason] ?? "Documento indisponível.",
        }, { status: 409 });
      }
      return NextResponse.json({
        ok: true, status: access.status, granted: access.granted === true,
        valor: Number(access.valor ?? 0),
        matriculaId: access.matricula_id,
        pedidoId: access.pedido_id ?? null,
        pagamentoIntentId: access.pagamento_intent_id ?? null,
        servicoCodigo: access.servico_codigo,
        pagamentoObrigatorio: access.pagamento_obrigatorio === true,
      });
    }

    // O servidor valida o serviço exato, matrícula/ano e liquidação no ledger.
    // Nunca confiar em status ou valor enviados pelo cliente.
    const { data: access, error: accessError } = await (supabase as any)
      .rpc("documento_individual_acesso", {
        p_escola_id: escolaId,
        p_aluno_id: alunoId,
        p_session_id: academicContext!.anoLetivoId,
        p_tipo: tipoDocumento,
      });
    if (accessError) {
      return NextResponse.json({ ok: false, error: "Falha ao validar pagamento." }, { status: 503 });
    }
    if (access?.granted !== true) {
      return NextResponse.json({
        ok: false, code: "DOCUMENT_PAYMENT_REQUIRED",
        error: "Documento não emitido. Registe ou valide a taxa deste serviço, ou confirme a elegibilidade.",
      }, { status: 409 });
    }

    // Se for um documento final, usa a nova RPC baseada no histórico
    if (FINAL_DOCUMENT_TYPES.includes(tipoDocumento)) {
      const anoLetivoNumero = academicContext
        ? Number(academicContext.anoLetivoLabel.slice(0, 4))
        : ano_letivo;
      if (!anoLetivoNumero) {
        return NextResponse.json({ ok: false, error: "O ano letivo é obrigatório para este tipo de documento." }, { status: 400 });
      }

      const { data: result, error: rpcError } = await (supabase as any)
        .rpc("emitir_documento_final_individual", {
          p_escola_id: escolaId,
          p_aluno_id: alunoId,
          p_ano_letivo: anoLetivoNumero,
          p_session_id: academicContext!.anoLetivoId,
          p_tipo_documento: FINAL_DOC_BACKEND_TYPE[tipoDocumento],
          p_idempotency_key: idempotencyKey,
        });

      if (rpcError) {
        const reused = String(rpcError.message ?? "").includes("IDEMPOTENCY_KEY_REUSED");
        return NextResponse.json(
          {
            ok: false,
            error: reused
              ? "Esta Idempotency-Key já foi usada para outra emissão."
              : rpcError.message,
            code: reused ? "IDEMPOTENCY_KEY_REUSED" : (rpcError.code ?? null),
          },
          { status: reused ? 409 : 400 },
        );
      }

      const finalResult = (result ?? {}) as Record<string, unknown>;
      const replay = finalResult.idempotent === true;
      if (!replay) {
        recordAuditServer({
          escolaId,
          portal: "secretaria",
          acao: "DOCUMENTO_FINAL_EMITIDO",
          entity: "documentos_emitidos",
          entityId: typeof finalResult.docId === "string" ? finalResult.docId : null,
          details: { alunoId, tipoDocumento, ano_letivo: anoLetivoNumero, ano_letivo_id: academicContext?.anoLetivoId ?? null },
        }).catch(() => null);

        await dispatchAlunoNotificacao({
          escolaId,
          key: "DOCUMENTO_EMITIDO",
          alunoIds: [alunoId],
          params: { actionUrl: "/aluno/documentos" },
          actorId: user.id,
          actorRole: "secretaria",
          agrupamentoTTLHoras: 12,
        });
      }
      return NextResponse.json(finalResult);
    }

    // Lógica para documentos baseados na matrícula ativa
    const idempotencyFingerprint = buildDocumentFingerprint({
      escolaId,
      alunoId,
      tipoDocumento,
      anoLetivoId: academicContext?.anoLetivoId ?? ano_letivo_id ?? null,
      anoLetivo: ano_letivo ?? null,
    });

    const { data: existingDocument } = await (supabase as any)
      .from("documentos_emitidos")
      .select("id, public_id, hash_validacao, tipo, idempotency_fingerprint")
      .eq("escola_id", escolaId)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (existingDocument) {
      if (existingDocument.idempotency_fingerprint !== idempotencyFingerprint) {
        return NextResponse.json(
          {
            ok: false,
            error: "Esta Idempotency-Key já foi usada para outra emissão.",
            code: "IDEMPOTENCY_KEY_REUSED",
          },
          { status: 409 },
        );
      }

      return NextResponse.json({
        ok: true,
        docId: existingDocument.id,
        publicId: existingDocument.public_id,
        hash: existingDocument.hash_validacao,
        tipo: existingDocument.tipo,
        idempotent: true,
      });
    }

    if (tipoDocumento === "boletim_trimestral" && !academicContext) {
      return NextResponse.json({ ok: false, error: "O ano letivo é obrigatório para este tipo de documento." }, { status: 400 });
    }

    const estadosHistoricos = academicContext?.mode === "HISTORICAL_READ" && tipoDocumento === "declaracao_frequencia";
    let matriculaQuery = supabase
      .from("matriculas")
      .select(`
        id, aluno_id, turma_id, ano_letivo, status,
        alunos ( 
          id, nome, nome_completo, bi_numero,
          pai_nome, mae_nome, data_nascimento,
          naturalidade, provincia, endereco,
          encarregado_nome, encarregado_telefone
        ),
        turmas ( 
          id, nome, turno, 
          classes ( nome ), 
          cursos ( nome ) 
        )
      `)
      .eq("escola_id", escolaId)
      .eq("aluno_id", alunoId)
      .in("status", estadosHistoricos
        ? ["ativa", "ativo", "matriculado", "concluido", "reprovado", "transferido", "trancado"]
        : ["ativa", "ativo", "matriculado"])
      .order("created_at", { ascending: false })
      .limit(1);

    if (academicContext) {
      matriculaQuery = matriculaQuery.eq("session_id", academicContext.anoLetivoId);
    } else if (tipoDocumento === "boletim_trimestral" && ano_letivo) {
      matriculaQuery = matriculaQuery.eq("ano_letivo", ano_letivo);
    }

    const { data: matricula, error: matriculaError } = await matriculaQuery.maybeSingle();

    if (matriculaError || !matricula) {
      return NextResponse.json({ ok: false, error: "Matrícula não encontrada no ano letivo selecionado" }, { status: 404 });
    }

    const aluno = (matricula as any).alunos || {};
    const turma = (matricula as any).turmas || {};

    // Fetch mensalidades for financial schedule
    const { data: mensalidades } = await supabase
      .from("mensalidades")
      .select("mes_referencia, ano_referencia, valor, data_vencimento, status")
      .eq("matricula_id", matricula.id)
      .order("data_vencimento", { ascending: true });

    const hashBase = `${randomUUID()}-${matricula.id}-${Date.now()}`;
    const hashValidacao = createHash("sha256").update(hashBase).digest("hex");

    const { data: numeroSequencial, error: numeroError } = await supabase
      .rpc("next_documento_numero", { p_escola_id: escolaId });
    if (numeroError) {
      return NextResponse.json({ ok: false, error: numeroError.message }, { status: 400 });
    }

    const snapshot = {
      aluno_id: alunoId,
      origem_emissao: "documentos_emissao_individual",
      servico_pedido_id: access?.pedido_id ?? null,
      pagamento_intent_id: access?.pagamento_intent_id ?? null,
      aluno_nome: aluno.nome_completo || aluno.nome || "",
      aluno_bi: aluno.bi_numero || null,
      aluno_pai: aluno.pai_nome || null,
      aluno_mae: aluno.mae_nome || null,
      aluno_nascimento: aluno.data_nascimento || null,
      aluno_naturalidade: aluno.naturalidade || null,
      aluno_provincia: aluno.provincia || null,
      aluno_endereco: aluno.endereco || null,
      encarregado_nome: aluno.encarregado_nome || null,
      encarregado_telefone: aluno.encarregado_telefone || null,
      matricula_id: matricula.id,
      turma_id: turma.id || null,
      turma_nome: turma.nome || null,
      turma_turno: turma.turno || null,
      classe_nome: turma.classes?.nome || null,
      curso_nome: turma.cursos?.nome || null,
      ano_letivo: matricula.ano_letivo || null,
      tipo_documento: tipoDocumento,
      numero_sequencial: numeroSequencial ?? null,
      hash_validacao: hashValidacao,
      mensalidades: (mensalidades || []).map(m => ({
        mes: m.mes_referencia,
        ano: m.ano_referencia,
        valor: m.valor,
        vencimento: m.data_vencimento,
        status: m.status
      })),
      valor_total_anual: (mensalidades || []).reduce((acc, m) => acc + Number(m.valor), 0)
    };

    const insertPayload: any = {
      escola_id: escolaId,
      aluno_id: alunoId,
      numero_sequencial: numeroSequencial ?? null,
      tipo: tipoDocumento,
      dados_snapshot: snapshot,
      created_by: user.id,
      hash_validacao: hashValidacao,
      idempotency_key: idempotencyKey,
      idempotency_fingerprint: idempotencyFingerprint,
    };

    const { data: doc, error: docError } = await supabase
      .from("documentos_emitidos")
      .insert(insertPayload)
      .select("id, public_id")
      .single();

    if (docError || !doc) {
      // Concorrência: duas requisições com a mesma chave podem chegar até o
      // INSERT. O índice único deixa apenas uma vencer; a outra devolve o mesmo
      // documento em vez de fabricar uma segunda emissão.
      if (docError?.code === "23505") {
        // Duas janelas, chaves diferentes, mesmo aluno/documento/ano.
        const { data: issuedDoc } = await (supabase as any)
          .from("documentos_emitidos")
          .select("id, public_id, hash_validacao, tipo")
          .eq("escola_id", escolaId).eq("aluno_id", alunoId)
          .eq("tipo", tipoDocumento)
          .contains("dados_snapshot", { matricula_id: matricula.id })
          .order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (issuedDoc?.id) {
          return NextResponse.json({
            ok: true, docId: issuedDoc.id, publicId: issuedDoc.public_id,
            hash: issuedDoc.hash_validacao, tipo: issuedDoc.tipo, idempotent: true,
          });
        }
        const { data: replayDoc } = await (supabase as any)
          .from("documentos_emitidos")
          .select("id, public_id, hash_validacao, tipo, idempotency_fingerprint")
          .eq("escola_id", escolaId)
          .eq("idempotency_key", idempotencyKey)
          .maybeSingle();

        if (replayDoc?.id) {
          if (replayDoc.idempotency_fingerprint !== idempotencyFingerprint) {
            return NextResponse.json(
              {
                ok: false,
                error: "Esta Idempotency-Key já foi usada para outra emissão.",
                code: "IDEMPOTENCY_KEY_REUSED",
              },
              { status: 409 },
            );
          }

          return NextResponse.json({
            ok: true,
            docId: replayDoc.id,
            publicId: replayDoc.public_id,
            hash: replayDoc.hash_validacao,
            tipo: replayDoc.tipo,
            idempotent: true,
          });
        }
      }

      return NextResponse.json({ ok: false, error: docError?.message || "Falha ao emitir" }, { status: 400 });
    }

    recordAuditServer({
      escolaId,
      portal: "secretaria",
      acao: "DOCUMENTO_EMITIDO",
      entity: "documentos_emitidos",
      entityId: doc.id,
      details: { alunoId, tipoDocumento, ano_letivo_id: academicContext?.anoLetivoId ?? null },
    }).catch(() => null);

    await dispatchAlunoNotificacao({
      escolaId,
      key: "DOCUMENTO_EMITIDO",
      alunoIds: [alunoId],
      params: { actionUrl: "/aluno/documentos" },
      actorId: user.id,
      actorRole: "secretaria",
      agrupamentoTTLHoras: 12,
    });

    return NextResponse.json({
      ok: true,
      docId: doc.id,
      publicId: doc.public_id,
      hash: hashValidacao,
      tipo: tipoDocumento,
      idempotent: false,
    });
  } catch (err) {
    if (err instanceof AcademicYearContextError) {
      return NextResponse.json({ ok: false, error: err.message, code: err.code }, { status: err.status });
    }
    if (err instanceof HttpError) {
      return NextResponse.json(
        {
          ok: false,
          error: err.message,
          error_code: err.code,
          upgrade_required: err.status === 403 && err.code === "PLAN_FEATURE_REQUIRED",
        },
        { status: err.status }
      );
    }
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
