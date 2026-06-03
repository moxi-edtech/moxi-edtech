// apps/web/src/app/api/public/admissoes/[escolaSlug]/candidatar/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerRole } from "@/lib/supabaseServerRole";
import { resolveEscolaParam } from "@/lib/tenant/resolveEscolaParam";
import type { Json } from "~types/supabase";

const CandidaturaSchema = z.object({
  // Dados do Candidato (Aluno)
  nome_completo: z.string().trim().min(5, "Nome completo deve ter pelo menos 5 caracteres"),
  tipo_documento: z.string().optional().default("BI"),
  numero_documento: z.string().trim().optional().nullable(),
  email: z.string().email("Email inválido").optional().nullable(),
  telefone: z.string().trim().min(7, "Telefone inválido").optional().nullable(),
  data_nascimento: z.string().optional().nullable(),
  sexo: z.enum(["M", "F", "O", "N"]).optional().nullable(),
  pai_nome: z.string().trim().max(160).optional().nullable(),
  mae_nome: z.string().trim().max(160).optional().nullable(),
  
  // Dados do Encarregado
  responsavel_nome: z.string().trim().min(5, "Nome do responsável deve ter pelo menos 5 caracteres"),
  responsavel_contato: z.string().trim().min(7, "Contato do responsável inválido"),
  
  // Dados Acadêmicos Pretendidos
  curso_id: z.string().uuid("Curso obrigatório"),
  ano_letivo: z.coerce.number().int(),
  turma_preferencial_id: z.string().uuid().optional().nullable(),
  turno: z.string().optional().nullable(),

  // Anti-spam (Honeypot)
  hp_field: z.string().max(0).optional(), // Deve estar vazio

  // Documentos e Metadados
  draftId: z.string().uuid().optional(),
  documentos: z.record(z.string()).optional(),
  campos_extras: z.record(z.unknown()).optional(),
});

function normalizeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function normalizePhone(value: string | null | undefined) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 9) return `244${digits}`;
  if (digits.length > 9 && !digits.startsWith("244")) return `244${digits}`;
  return digits;
}

function normalizeDocument(value: string | null | undefined) {
  const normalized = String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
  return normalized || null;
}

function toJsonObject(record: Record<string, unknown> | undefined): Json {
  const out: { [key: string]: Json | undefined } = {};
  for (const [key, value] of Object.entries(record ?? {})) {
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean" ||
      value === null
    ) {
      out[key] = value;
    }
  }
  return out;
}

type PostgrestLikeError = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

type DisponibilidadePublica = "disponivel" | "ultimas_vagas" | "lista_espera";

function disponibilidadePublica(capacidade: number | null, matriculadosAtivos: number): DisponibilidadePublica {
  if (capacidade === null) return "disponivel";
  const vagas = capacidade - matriculadosAtivos;
  if (vagas <= 0) return "lista_espera";
  if (vagas <= 5) return "ultimas_vagas";
  return "disponivel";
}

function duplicateAdmissionResponse(error: PostgrestLikeError) {
  if (error.code !== "23505") return null;

  const text = `${error.message ?? ""} ${error.details ?? ""} ${error.hint ?? ""}`;
  if (text.includes("ux_candidaturas_doc_normalizado")) {
    return NextResponse.json(
      {
        ok: false,
        code: "ADMISSION_DUPLICATE_DOCUMENT",
        error: "Já existe uma candidatura com este documento para este curso e ano letivo.",
      },
      { status: 409 }
    );
  }

  if (text.includes("ux_candidaturas_resp_phone_nome_normalizado")) {
    return NextResponse.json(
      {
        ok: false,
        code: "ADMISSION_DUPLICATE_GUARDIAN_CONTACT",
        error: "Já existe uma candidatura com este nome e contato do encarregado para este curso e ano letivo.",
      },
      { status: 409 }
    );
  }

  if (text.includes("ux_candidaturas_phone_nome_normalizado")) {
    return NextResponse.json(
      {
        ok: false,
        code: "ADMISSION_DUPLICATE_STUDENT_CONTACT",
        error: "Já existe uma candidatura com este nome e telefone do aluno para este curso e ano letivo.",
      },
      { status: 409 }
    );
  }

  return NextResponse.json(
    {
      ok: false,
      code: "ADMISSION_DUPLICATE",
      error: "Já existe uma candidatura com estes dados para este curso e ano letivo.",
    },
    { status: 409 }
  );
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ escolaSlug: string }> }
) {
  try {
    const { escolaSlug } = await params;
    const body = await req.json();

    // 1. Validate Payload (Allowlist via Zod)
    const validation = CandidaturaSchema.safeParse(body);
    if (!validation.success) {
      // Se for erro no honeypot, retornar sucesso falso para desencorajar bots
      const isHoneypotError = validation.error.issues.some(i => i.path.includes("hp_field"));
      if (isHoneypotError) {
        return NextResponse.json({ ok: true, message: "Inscrição processada." }, { status: 201 });
      }

      return NextResponse.json(
        { ok: false, error: validation.error.issues[0]?.message || "Dados inválidos" },
        { status: 400 }
      );
    }
    const data = validation.data;

    // 2. Resolve School
    const supabase = supabaseServerRole();
    const { escolaId } = await resolveEscolaParam(supabase, escolaSlug);

    if (!escolaId) {
      return NextResponse.json({ ok: false, error: "Escola não encontrada" }, { status: 404 });
    }

    // 3. Security & Integrity Checks (Verify if course/turma belong to this school)
    const [activeAnoRes, courseCheck, turmaCheck] = await Promise.all([
      supabase
        .from("anos_letivos")
        .select("ano")
        .eq("escola_id", escolaId)
        .order("ano", { ascending: false }) // Priorizar o ano mais recente para novas admissões
        .limit(1)
        .maybeSingle(),
      supabase
        .from("cursos")
        .select("id")
        .eq("id", data.curso_id)
        .eq("escola_id", escolaId)
        .maybeSingle(),
      data.turma_preferencial_id
        ? supabase
            .from("turmas")
            .select("id, curso_id, ano_letivo, capacidade_maxima")
            .eq("id", data.turma_preferencial_id)
            .eq("escola_id", escolaId)
            .maybeSingle()
        : Promise.resolve({ data: { id: "ok", curso_id: data.curso_id, ano_letivo: null, capacidade_maxima: null }, error: null }),
    ]);

    if (!courseCheck.data) {
      return NextResponse.json({ ok: false, error: "Curso inválido para esta escola" }, { status: 400 });
    }
    if (!turmaCheck.data) {
      return NextResponse.json({ ok: false, error: "Turma inválida para esta escola" }, { status: 400 });
    }
    if (data.turma_preferencial_id && turmaCheck.data.curso_id !== data.curso_id) {
      return NextResponse.json({ ok: false, error: "Turma inválida para o curso selecionado" }, { status: 400 });
    }

    const turmaAnoLetivo = Number(turmaCheck.data.ano_letivo);
    const activeAnoLetivo = Number(activeAnoRes.data?.ano);
    const anoLetivo = Number.isFinite(turmaAnoLetivo)
      ? turmaAnoLetivo
      : Number.isFinite(activeAnoLetivo)
      ? activeAnoLetivo
      : data.ano_letivo;

    const nomeNormalizado = normalizeName(data.nome_completo);
    const telefoneNormalizado = normalizePhone(data.telefone);
    const responsavelContatoNormalizado = normalizePhone(data.responsavel_contato);
    const documentoNormalizado = normalizeDocument(data.numero_documento);
    let disponibilidade: DisponibilidadePublica = "disponivel";

    if (data.turma_preferencial_id) {
      const { data: ocupacaoReservada, error: ocupacaoError } = await supabase.rpc(
        "admissao_turma_ocupacao_reservada",
        {
          p_escola_id: escolaId,
          p_turma_id: data.turma_preferencial_id,
        }
      );

      if (ocupacaoError) {
        console.error("[Public Admission Occupancy Error]:", ocupacaoError);
        return NextResponse.json({ ok: false, error: "Erro ao validar disponibilidade da turma." }, { status: 500 });
      }

      disponibilidade = disponibilidadePublica(
        turmaCheck.data.capacidade_maxima,
        ocupacaoReservada ?? 0
      );
    }
    const statusInicial = disponibilidade === "lista_espera" ? "lista_espera" : "pendente";

    const dedupeBase = () =>
      supabase
        .from("candidaturas")
        .select("id, protocolo_publico")
        .eq("escola_id", escolaId)
        .eq("ano_letivo", anoLetivo)
        .eq("curso_id", data.curso_id)
        .limit(1);

    let existing: { id: string; protocolo_publico: string | null } | null = null;

    if (documentoNormalizado) {
      const { data: existingByDocument } = await dedupeBase()
        .eq("documento_normalizado", documentoNormalizado)
        .maybeSingle();
      existing = existingByDocument;
    }

    if (!existing && responsavelContatoNormalizado) {
      const { data: existingByGuardianPhone } = await dedupeBase()
        .eq("responsavel_contato_normalizado", responsavelContatoNormalizado)
        .eq("nome_normalizado", nomeNormalizado)
        .maybeSingle();
      existing = existingByGuardianPhone;
    }

    if (!existing && telefoneNormalizado) {
      const { data: existingByStudentPhone } = await dedupeBase()
        .eq("telefone_normalizado", telefoneNormalizado)
        .eq("nome_normalizado", nomeNormalizado)
        .maybeSingle();
      existing = existingByStudentPhone;
    }

    // Fallback legacy para candidaturas antigas sem colunas normalizadas.
    if (!existing && documentoNormalizado) {
      const { data: existingByDocumentJson } = await dedupeBase()
        .contains("dados_candidato", { documento_normalizado: documentoNormalizado })
        .maybeSingle();
      existing = existingByDocumentJson;
    }

    if (!existing && responsavelContatoNormalizado) {
      const { data: existingByGuardianPhoneJson } = await dedupeBase()
        .contains("dados_candidato", { responsavel_contato_normalizado: responsavelContatoNormalizado })
        .contains("dados_candidato", { nome_normalizado: nomeNormalizado })
        .maybeSingle();
      existing = existingByGuardianPhoneJson;
    }

    if (!existing && telefoneNormalizado) {
      const { data: existingByStudentPhoneJson } = await dedupeBase()
        .contains("dados_candidato", { telefone_normalizado: telefoneNormalizado })
        .contains("dados_candidato", { nome_normalizado: nomeNormalizado })
        .maybeSingle();
      existing = existingByStudentPhoneJson;
    }

    // Fallback legado anterior aos normalizados.
    if (!existing) {
      const { data: existingLegacy } = await supabase
      .from("candidaturas")
      .select("id, protocolo_publico")
      .eq("escola_id", escolaId)
      .eq("nome_candidato", data.nome_completo)
      .eq("ano_letivo", anoLetivo)
      .eq("curso_id", data.curso_id)
      .contains("dados_candidato", { responsavel_contato: data.responsavel_contato })
      .maybeSingle();
      existing = existingLegacy;
    }

    if (existing) {
      return NextResponse.json({
        ok: true,
        message: "Já recebemos uma inscrição com estes dados. Nossa secretaria entrará em contato em breve.",
        protocolo: existing.protocolo_publico,
      }, { status: 200 });
    }

    // 6. Insert Candidacy
    const draftId = data.draftId ?? crypto.randomUUID();
    const tempProtocol = draftId.split("-")[0].toUpperCase();
    const dadosCandidato: Record<string, Json> = {
      nome_completo: data.nome_completo,
      nome_normalizado: nomeNormalizado,
      tipo_documento: data.tipo_documento,
      numero_documento: data.numero_documento ?? null,
      documento_normalizado: documentoNormalizado,
      // Fallback para bi_numero para compatibilidade com Portal do Aluno
      // Se não houver número (ex: folha de 25 linhas), usamos o protocolo temporariamente
      bi_numero: data.numero_documento || `TEMP-${tempProtocol}`,
      email: data.email || null,
      telefone: data.telefone || null,
      telefone_normalizado: telefoneNormalizado,
      data_nascimento: data.data_nascimento || null,
      sexo: data.sexo || null,
      pai_nome: data.pai_nome || null,
      mae_nome: data.mae_nome || null,
      responsavel_nome: data.responsavel_nome,
      responsavel_contato: data.responsavel_contato,
      responsavel_contato_normalizado: responsavelContatoNormalizado,
      ano_letivo: anoLetivo,
      documentos: toJsonObject(data.documentos),
      campos_extras: toJsonObject(data.campos_extras),
      draft_id: draftId,
      disponibilidade_submissao: disponibilidade,
    };

    // 6. Insert Candidacy
    const { data: candidatura, error: insertErr } = await supabase
      .from("candidaturas")
      .insert({
        escola_id: escolaId,
        curso_id: data.curso_id,
        ano_letivo: anoLetivo,
        status: statusInicial,
        turma_preferencial_id: data.turma_preferencial_id || null,
        dados_candidato: dadosCandidato,
        nome_candidato: data.nome_completo,
        nome_normalizado: nomeNormalizado,
        documento_normalizado: documentoNormalizado,
        telefone_normalizado: telefoneNormalizado,
        responsavel_contato_normalizado: responsavelContatoNormalizado,
        turno: data.turno || null,
        protocolo_publico: `ADM-${tempProtocol}`,
        source: "PORTAL_PUBLICO",
      })
      .select("id, protocolo_publico")
      .single();

    if (insertErr) {
      console.error("[Public Candidacy Insert Error]:", insertErr);
      const duplicateResponse = duplicateAdmissionResponse(insertErr);
      if (duplicateResponse) return duplicateResponse;
      return NextResponse.json({ ok: false, error: "Erro ao processar sua inscrição. Tente novamente." }, { status: 500 });
    }

    await supabase.from("candidaturas_status_log").insert({
      escola_id: escolaId,
      candidatura_id: candidatura.id,
      from_status: null,
      to_status: statusInicial,
      motivo:
        statusInicial === "lista_espera"
          ? "Candidatura pública em lista de espera por turma lotada"
          : "Candidatura pública submetida",
      metadata: {
        source: "public_form",
        turma_id: data.turma_preferencial_id ?? null,
        disponibilidade,
      },
    });

    // 7. Audit Log
    await supabase.from("audit_logs").insert({
      escola_id: escolaId,
      action: "CANDIDATURA_PUBLICA_CRIADA",
      entity: "candidaturas",
      entity_id: candidatura.id,
      portal: "portal_publico_k12",
      details: { 
        nome: data.nome_completo, 
        curso_id: data.curso_id,
        status: statusInicial,
        disponibilidade,
        source: "public_form"
      }
    });

    // 8. Return generic success
    return NextResponse.json({ 
      ok: true, 
      message: "Inscrição realizada com sucesso! A secretaria entrará em contato em breve.",
      protocolo: candidatura.protocolo_publico,
      status: statusInicial,
    }, { status: 201 });

  } catch (err) {
    console.error("[Public Candidacy Error]:", err);
    return NextResponse.json({ ok: false, error: "Erro interno ao processar requisição" }, { status: 500 });
  }
}
