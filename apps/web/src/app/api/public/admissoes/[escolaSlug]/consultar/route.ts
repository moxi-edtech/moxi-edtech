import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerRole } from "@/lib/supabaseServerRole";
import { resolveEscolaParam } from "@/lib/tenant/resolveEscolaParam";
import { buildCredentialsEmail, sendMail } from "@/lib/mailer";
import type { Json } from "~types/supabase";

type CandidaturaStatusRow = {
  id: string;
  protocolo_publico: string;
  status: string | null;
  aluno_id: string | null;
  nome_candidato: string | null;
  created_at: string | null;
  documento_normalizado?: string | null;
  telefone_normalizado?: string | null;
  responsavel_contato_normalizado?: string | null;
  dados_candidato?: Json | null;
  curso_nome?: string | null;
};

const protocoloSchema = z
  .string()
  .trim()
  .regex(/^ADM-[0-9A-Fa-f]{8}$/)
  .transform((value) => value.toUpperCase());

const strongPasswordSchema = z
  .string()
  .min(10)
  .max(128)
  .refine((value) => {
    const groups = [
      /[a-z]/.test(value),
      /[A-Z]/.test(value),
      /\d/.test(value),
      /[^A-Za-z0-9]/.test(value),
    ].filter(Boolean).length;
    return groups >= 3;
  }, "Senha fraca");

const statusChallengeSchema = z
  .object({
    protocolo: protocoloSchema,
    contato: z.string().trim().min(1).max(120),
    action: z.enum(["set_password", "upload_payment", "reupload_document"]).optional(),
    password: strongPasswordSchema.optional(),
    comprovativo_path: z.string().trim().optional(),
    document_id: z.string().trim().optional(),
    document_path: z.string().trim().optional(),
  })
  .strict();

type PublicLookupClient = ReturnType<typeof supabaseServerRole>;

async function lookupByProtocolo(
  supabase: PublicLookupClient,
  escolaId: string,
  protocolo: string
) {
  const { data, error } = await supabase.rpc("admissao_public_lookup_by_protocolo", {
    p_escola_id: escolaId,
    p_protocolo: protocolo,
  });

  if (error) throw error;
  return (data ?? []) as CandidaturaStatusRow[];
}

function getClientIp(req: NextRequest) {
  const forwardedFor = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (
    forwardedFor ||
    req.headers.get("x-real-ip") ||
    req.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

async function enforceRateLimit(
  supabase: PublicLookupClient,
  scope: string,
  key: string,
  limit: number,
  windowSeconds: number,
  blockSeconds: number
) {
  const { data, error } = await supabase.rpc("check_public_rate_limit", {
    p_scope: scope,
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
    p_block_seconds: blockSeconds,
  });

  if (error) throw error;
  const allowed =
    typeof data === "object" &&
    data !== null &&
    !Array.isArray(data) &&
    "allowed" in data &&
    data.allowed === true;

  if (!allowed) {
    return NextResponse.json(
      { ok: false, error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." },
      { status: 429 }
    );
  }

  return null;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" ? value : null;
}

function isSafeAdmissionPath(path: string, escolaId: string, candidaturaId: string) {
  if (path.includes("..") || path.startsWith("/") || path.includes("\\")) return false;
  return path.startsWith(`${escolaId}/${candidaturaId}/`);
}

function normalizeComparable(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
}

function passwordContainsCandidateData(password: string, match: CandidaturaStatusRow) {
  const dados = isRecord(match.dados_candidato) ? match.dados_candidato : {};
  const passwordText = normalizeComparable(password);
  const candidates = [
    match.protocolo_publico,
    match.nome_candidato,
    match.responsavel_contato_normalizado,
    getString(dados, "nome_completo"),
    getString(dados, "numero_documento"),
    getString(dados, "bi_numero"),
    getString(dados, "telefone"),
    getString(dados, "responsavel_contato"),
    getString(dados, "data_nascimento"),
  ]
    .map(normalizeComparable)
    .filter((value) => value.length >= 4);

  return candidates.some((value) => passwordText.includes(value));
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ escolaSlug: string }> }
) {
  try {
    const { escolaSlug } = await params;
    const { searchParams } = new URL(req.url);
    const parsedProtocolo = protocoloSchema.safeParse(searchParams.get("protocolo"));

    if (!parsedProtocolo.success) {
      return NextResponse.json(
        { ok: false, error: "Protocolo inválido" },
        { status: 400 }
      );
    }
    const protocolo = parsedProtocolo.data;

    // 1. Resolve School
    const supabase = supabaseServerRole();
    const { escolaId } = await resolveEscolaParam(supabase, escolaSlug);

    if (!escolaId) {
      return NextResponse.json({ ok: false, error: "Escola não encontrada" }, { status: 404 });
    }

    const rateLimitError = await enforceRateLimit(
      supabase,
      "admissao_status_lookup",
      `${escolaId}:${protocolo}:${getClientIp(req)}`,
      10,
      600,
      600
    );
    if (rateLimitError) return rateLimitError;

    const candidaturas = await lookupByProtocolo(supabase, escolaId, protocolo);
    const match = candidaturas[0];

    if (!match) {
      return NextResponse.json(
        { ok: false, error: "Inscrição não encontrada" },
        { status: 404 }
      );
    }

    // Mascarar o nome para privacidade na porta pública
    const partesNome = (match.nome_candidato || "").split(" ");
    const nomeMascarado = partesNome[0] + (partesNome.length > 1 ? " ***" : "");

    // Extrair e mascarar contatos para o desafio
    const dados = isRecord(match.dados_candidato) ? match.dados_candidato : {};
    
    // Telefone
    const telefoneBruto = match.responsavel_contato_normalizado || getString(dados, "responsavel_contato") || "";
    const telefoneMascarado = telefoneBruto.length > 4 
      ? `****${telefoneBruto.slice(-3)}`
      : null;

    // Email
    const emailBruto = getString(dados, "encarregado_email") || getString(dados, "email") || "";
    const [user, domain] = emailBruto.split("@");
    const emailMascarado = user && domain 
      ? `${user.slice(0, 2)}***@${domain}`
      : null;

    return NextResponse.json({
      ok: true,
      data: {
        protocolo: match.protocolo_publico,
        protocolo_publico: match.protocolo_publico,
        status: match.status,
        nome_candidato_mask: nomeMascarado,
        telefone_mask: telefoneMascarado,
        email_mask: emailMascarado,
        escola_id: escolaId, // Adicionado para o upload seguro
      }
    });

  } catch (err) {
    console.error("[Status Inquiry Error]:", err);
    return NextResponse.json({ ok: false, error: "Erro interno ao processar requisição" }, { status: 500 });
  }
}

/**
 * POST /api/public/admissoes/[escolaSlug]/consultar
 * Valida o desafio de segurança (telefone ou email) e abre o "Cofre".
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ escolaSlug: string }> }
) {
  try {
    const { escolaSlug } = await params;
    const body = await req.json().catch(() => ({}));
    const parsedBody = statusChallengeSchema.safeParse(body);

    if (!parsedBody.success) {
      return NextResponse.json({ ok: false, error: "Dados inválidos" }, { status: 400 });
    }
    const { protocolo, contato, action, password, comprovativo_path, document_id, document_path } = parsedBody.data;

    const supabase = supabaseServerRole();
    const { escolaId } = await resolveEscolaParam(supabase, escolaSlug);

    if (!escolaId) {
      return NextResponse.json({ ok: false, error: "Escola não encontrada" }, { status: 404 });
    }

    const rateLimitError = await enforceRateLimit(
      supabase,
      action === "set_password" ? "admissao_vault_password" : "admissao_vault_challenge",
      `${escolaId}:${protocolo}:${getClientIp(req)}`,
      action === "set_password" ? 3 : 5,
      action === "set_password" ? 1800 : 600,
      action === "set_password" ? 3600 : 1800
    );
    if (rateLimitError) return rateLimitError;

    const candidaturas = await lookupByProtocolo(supabase, escolaId, protocolo);
    const match = candidaturas[0];
    if (!match) return NextResponse.json({ ok: false, error: "Inscrição não encontrada" }, { status: 404 });

    // 2. Validar Desafio (Telefone ou Email)
    const inputNormalizado = contato.trim().toLowerCase();
    const inputPhoneNormalizado = normalizePhone(contato);
    
    const dados = isRecord(match.dados_candidato) ? match.dados_candidato : {};
    
    const telRegistrado = match.responsavel_contato_normalizado || normalizePhone(getString(dados, "responsavel_contato"));
    const emailEncarregado = getString(dados, "encarregado_email")?.toLowerCase();
    const emailAluno = getString(dados, "email")?.toLowerCase();

    const isAuthorized = 
      (inputPhoneNormalizado && inputPhoneNormalizado === telRegistrado) ||
      (inputNormalizado === emailEncarregado) ||
      (inputNormalizado === emailAluno);

    if (!isAuthorized) {
      return NextResponse.json({ ok: false, error: "Dado de contato incorreto" }, { status: 403 });
    }

    // 3. Ações Específicas (Definir Senha)
    if (action === "set_password") {
      if (!password) {
        return NextResponse.json({ ok: false, error: "Senha inválida" }, { status: 400 });
      }
      if (passwordContainsCandidateData(password, match)) {
        return NextResponse.json(
          { ok: false, error: "A senha não pode conter nome, telefone, documento, data de nascimento ou protocolo." },
          { status: 400 }
        );
      }

      if (!match.aluno_id) {
        return NextResponse.json({ ok: false, error: "Aluno ainda não processado pela secretaria" }, { status: 400 });
      }

      // Buscar email do aluno para o job de auth
      const { data: aluno } = await supabase
        .from("alunos")
        .select("email, usuario_auth_id")
        .eq("id", match.aluno_id)
        .maybeSingle();

      if (!aluno || !aluno.usuario_auth_id) {
        return NextResponse.json({ ok: false, error: "Acesso ao portal ainda não gerado pela secretaria" }, { status: 400 });
      }

      // Chamar job de admin para atualizar senha
      const { callAuthAdminJob } = await import("@/lib/auth-admin-job");
      const result = await callAuthAdminJob(req, "activateStudentAccess", {
        aluno_id: match.aluno_id,
        escola_id: escolaId,
        gerar_nova_senha: false,
        senha_manual: password,
        should_reset_existing_password: true
      });

      if (!result.ok) {
        throw new Error(result.error || "Falha ao atualizar senha");
      }

      // Enviar e-mail de confirmação se houver e-mail
      if (aluno.email) {
        try {
          const { data: esc } = await supabase
            .from("escolas")
            .select("nome")
            .eq("id", escolaId)
            .maybeSingle();
            
          const mail = buildCredentialsEmail({
            nome: getString(dados, "nome_completo") || match.nome_candidato,
            email: aluno.email,
            numero_processo_login: result.login,
            escolaNome: esc?.nome,
            loginUrl: process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/login` : null
          });

          await sendMail({
            to: aluno.email,
            subject: mail.subject,
            html: mail.html,
            text: mail.text
          });
        } catch (mailErr) {
          console.error("[Vault Mail Error]:", mailErr);
          // Não bloqueia o sucesso se falhar o e-mail
        }
      }

      return NextResponse.json({ ok: true, message: "Senha atualizada" });
    }

    if (action === "upload_payment") {
      if (match.status !== "aguardando_pagamento") {
        return NextResponse.json(
          { ok: false, error: "Comprovativo só pode ser enviado para candidatura aguardando pagamento." },
          { status: 409 }
        );
      }

      if (!comprovativo_path) {
        return NextResponse.json({ ok: false, error: "Caminho do comprovativo é obrigatório" }, { status: 400 });
      }
      if (!isSafeAdmissionPath(comprovativo_path, escolaId, match.id)) {
        return NextResponse.json({ ok: false, error: "Caminho do comprovativo inválido" }, { status: 400 });
      }

      const current = isRecord(match.dados_candidato) ? match.dados_candidato : {};
      const currentPagamento = isRecord(current.pagamento) ? current.pagamento : {};
      
      const merged: Json = {
        ...current,
        pagamento: {
          ...currentPagamento,
          comprovativo_path,
          uploaded_at: new Date().toISOString(),
          source: "PORTAL_VAULT"
        }
      };

      const { error: updateErr } = await supabase
        .from("candidaturas")
        .update({ 
          dados_candidato: merged,
          status: "aguardando_compensacao" // Transaciona para análise financeira
        })
        .eq("id", match.id)
        .eq("escola_id", escolaId);

      if (updateErr) throw updateErr;

      return NextResponse.json({ ok: true, message: "Comprovativo enviado para análise" });
    }

    if (action === "reupload_document") {
      if (!document_id || !document_path) {
        return NextResponse.json({ ok: false, error: "Dados do documento obrigatórios" }, { status: 400 });
      }

      const { error: reuploadErr } = await supabase.rpc("admissao_reupload_documento_pendente", {
        p_escola_id: escolaId,
        p_candidatura_id: match.id,
        p_document_id: document_id,
        p_document_path: document_path,
      });

      if (reuploadErr) throw reuploadErr;

      return NextResponse.json({ ok: true, message: "Documento atualizado com sucesso" });
    }

    // 4. Gerar links e ações se matriculado ou reservado
    let actions: { 
      pode_mudar_senha: boolean; 
      pode_baixar_comprovativo: boolean; 
      pode_enviar_comprovativo: boolean;
      pode_resolver_pendencia: boolean;
      reserva_expira_at: string | null;
      comprovativo_url: string | null;
      pendencias: any[];
      escola_pagamento: any | null;
    } = {
      pode_mudar_senha: false,
      pode_baixar_comprovativo: false,
      pode_enviar_comprovativo: false,
      pode_resolver_pendencia: false,
      reserva_expira_at: null,
      comprovativo_url: null,
      pendencias: [],
      escola_pagamento: null
    };

    if (match.status === "matriculado") {
      actions.pode_mudar_senha = !!match.aluno_id;
      actions.pode_baixar_comprovativo = true;

      // Buscar o último comprovativo emitido para este aluno
      if (match.aluno_id) {
        const { data: doc } = await supabase
          .from("documentos_emitidos")
          .select("id")
          .eq("aluno_id", match.aluno_id)
          .eq("tipo", "comprovante_matricula")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (doc) {
          actions.comprovativo_url = `/admissoes/${escolaSlug}/consultar/print?docId=${doc.id}`;
        }
      }
    } else if (match.status === "aguardando_pagamento") {
      actions.pode_enviar_comprovativo = true;
      actions.reserva_expira_at = getString(dados, "reserva_expira_at");
      
      // Fallback para expires_at se reserva_expira_at não estiver no JSON (casos legados)
      if (!actions.reserva_expira_at) {
        const { data: cand } = await supabase
          .from("candidaturas")
          .select("expires_at")
          .eq("id", match.id)
          .single();
        actions.reserva_expira_at = cand?.expires_at ?? null;
      }

      // Buscar dados de pagamento da escola
      const { data: escola } = await supabase
        .from("escolas")
        .select("dados_pagamento")
        .eq("id", escolaId)
        .maybeSingle();
      
      actions.escola_pagamento = escola?.dados_pagamento ?? null;
    } else if (match.status === "pendente") {
      actions.pode_resolver_pendencia = true;
      actions.pendencias = Array.isArray(dados.pendencias) ? dados.pendencias : [];
    }

    return NextResponse.json({
      ok: true,
      vault: {
        id: match.id,
        aluno_id: match.aluno_id,
        nome_completo: getString(dados, "nome_completo") || match.nome_candidato,
        status: match.status,
        curso: match.curso_nome,
        ...actions
      }
    });

  } catch (err) {
    console.error("[Vault Error]:", err);
    return NextResponse.json({ ok: false, error: "Erro na validação" }, { status: 500 });
  }
}
