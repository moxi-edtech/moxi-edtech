import { NextRequest, NextResponse } from "next/server";
import { supabaseServerRole } from "@/lib/supabaseServerRole";
import { resolveEscolaParam } from "@/lib/tenant/resolveEscolaParam";
import { buildCredentialsEmail, sendMail } from "@/lib/mailer";

type CandidaturaStatusRow = {
  id: string;
  status: string | null;
  aluno_id: string | null;
  nome_candidato: string | null;
  created_at: string | null;
  documento_normalizado?: string | null;
  telefone_normalizado?: string | null;
  responsavel_contato_normalizado?: string | null;
  dados_candidato?: any | null;
  curso?: { nome?: string | null } | null;
};

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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ escolaSlug: string }> }
) {
  try {
    const { escolaSlug } = await params;
    const { searchParams } = new URL(req.url);
    const protocolo = searchParams.get("protocolo")?.toUpperCase();

    if (!protocolo) {
      return NextResponse.json(
        { ok: false, error: "Protocolo é obrigatório" },
        { status: 400 }
      );
    }

    // 1. Resolve School
    const supabase = supabaseServerRole();
    const { escolaId } = await resolveEscolaParam(supabase, escolaSlug);

    if (!escolaId) {
      return NextResponse.json({ ok: false, error: "Escola não encontrada" }, { status: 404 });
    }

    // 2. Search Candidacy by Protocol
    const { data: candidaturas, error: searchErr } = await supabase
      .from("candidaturas")
      .select(`
        id, 
        status, 
        nome_candidato, 
        responsavel_contato_normalizado,
        dados_candidato
      `)
      .eq("escola_id", escolaId)
      .filter("id", "ilike", `${protocolo.toLowerCase()}%`)
      .limit(1);

    if (searchErr) {
      console.error("[Status Inquiry Search Error]:", searchErr);
      return NextResponse.json({ ok: false, error: "Erro ao buscar candidatura" }, { status: 500 });
    }

    const match = candidaturas?.[0] as CandidaturaStatusRow | undefined;

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
        protocolo: match.id.split("-")[0].toUpperCase(),
        status: match.status,
        nome_candidato_mask: nomeMascarado,
        telefone_mask: telefoneMascarado,
        email_mask: emailMascarado,
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
    const { protocolo, contato, action, password } = body;
    
    if (!protocolo || !contato) {
      return NextResponse.json({ ok: false, error: "Dados incompletos" }, { status: 400 });
    }

    const supabase = supabaseServerRole();
    const { escolaId } = await resolveEscolaParam(supabase, escolaSlug);

    if (!escolaId) {
      return NextResponse.json({ ok: false, error: "Escola não encontrada" }, { status: 404 });
    }

    // 1. Buscar candidatura e contatos registrados
    const { data: candidaturas } = await supabase
      .from("candidaturas")
      .select(`
        id, 
        status, 
        aluno_id,
        nome_candidato,
        responsavel_contato_normalizado,
        dados_candidato,
        curso:cursos(nome)
      `)
      .eq("escola_id", escolaId)
      .filter("id", "ilike", `${protocolo.toLowerCase()}%`)
      .limit(1);

    const match = candidaturas?.[0] as CandidaturaStatusRow | undefined;
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
      if (!password || password.length < 6) {
        return NextResponse.json({ ok: false, error: "Senha inválida" }, { status: 400 });
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
      const result = await callAuthAdminJob(req as any, "activateStudentAccess", {
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

    // 4. Gerar links e ações se matriculado
    let actions: { pode_mudar_senha: boolean; pode_baixar_comprovativo: boolean; comprovativo_url: string | null } = {
      pode_mudar_senha: false,
      pode_baixar_comprovativo: false,
      comprovativo_url: null
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
    }

    return NextResponse.json({
      ok: true,
      vault: {
        id: match.id,
        aluno_id: match.aluno_id,
        nome_completo: getString(dados, "nome_completo") || match.nome_candidato,
        status: match.status,
        curso: match.curso?.nome,
        ...actions
      }
    });

  } catch (err) {
    console.error("[Vault Error]:", err);
    return NextResponse.json({ ok: false, error: "Erro na validação" }, { status: 500 });
  }
}
