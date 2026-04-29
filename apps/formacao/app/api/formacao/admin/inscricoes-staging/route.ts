import { NextResponse } from "next/server";
import { requireFormacaoRoles } from "@/lib/route-auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { callAuthAdminJob } from "@/lib/auth-admin-job";
import { sendMail, buildFormacaoCredentialsEmail } from "@/lib/mailer";
import type { FormacaoSupabaseClient } from "@/lib/db-types";

export const dynamic = "force-dynamic";

const allowedRoles = ["formacao_admin", "formacao_secretaria", "super_admin", "global_admin"];

function generateTemporaryPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const size = 12;
  let value = "";
  for (let i = 0; i < size; i += 1) {
    const idx = Math.floor(Math.random() * alphabet.length);
    value += alphabet[idx];
  }
  return value;
}

export async function GET() {
  const auth = await requireFormacaoRoles(allowedRoles);
  if (!auth.ok) return auth.response;

  const s = (await supabaseServer()) as FormacaoSupabaseClient;

  const { data, error } = await s
    .from("formacao_inscricoes_staging")
    .select(`
      *,
      cohort:formacao_cohorts (
        nome,
        curso_nome,
        data_inicio
      )
    `)
    .eq("escola_id", auth.escolaId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

  const now = Date.now();
  const prioritized = (data ?? [])
    .map((item) => {
      const typed = item as {
        created_at?: string;
        valor_cobrado?: number | null;
        cohort?: { data_inicio?: string | null } | null;
      } & Record<string, unknown>;

      const createdAtMs = typed.created_at ? new Date(typed.created_at).getTime() : now;
      const ageHours = Math.max(0, (now - createdAtMs) / (1000 * 60 * 60));

      const cohortStartMs = typed.cohort?.data_inicio ? new Date(String(typed.cohort.data_inicio)).getTime() : null;
      const daysToStart = cohortStartMs ? (cohortStartMs - now) / (1000 * 60 * 60 * 24) : null;

      const value = Number(typed.valor_cobrado ?? 0);

      let score = 0;
      const reasons: string[] = [];

      if (daysToStart !== null) {
        if (daysToStart <= 3) {
          score += 55;
          reasons.push("Turma inicia em até 3 dias");
        } else if (daysToStart <= 7) {
          score += 35;
          reasons.push("Turma inicia em até 7 dias");
        } else if (daysToStart <= 14) {
          score += 20;
          reasons.push("Turma inicia em até 14 dias");
        }
      }

      if (value >= 500000) {
        score += 30;
        reasons.push("Valor elevado");
      } else if (value >= 200000) {
        score += 20;
        reasons.push("Valor relevante");
      } else if (value > 0) {
        score += 10;
        reasons.push("Valor informado");
      }

      if (ageHours >= 72) {
        score += 25;
        reasons.push("Ticket com +72h");
      } else if (ageHours >= 24) {
        score += 15;
        reasons.push("Ticket com +24h");
      } else if (ageHours >= 8) {
        score += 8;
        reasons.push("Ticket com +8h");
      }

      const level = score >= 70 ? "alta" : score >= 35 ? "media" : "baixa";
      const email = String((typed as { email?: string | null }).email ?? "").trim();
      const telefone = String((typed as { telefone?: string | null }).telefone ?? "").trim();
      const comprovativo = String((typed as { comprovativo_url?: string | null }).comprovativo_url ?? "").trim();

      let recommendation = "Aprovar";
      let recommendationReason = "Dados mínimos presentes para avançar com matrícula.";

      if (!comprovativo) {
        recommendation = "Pedir comprovativo";
        recommendationReason = "Inscrição sem comprovativo anexado.";
      } else if (!email && !telefone) {
        recommendation = "Pedir contacto";
        recommendationReason = "Falta email e telefone para comunicação operacional.";
      } else if (level === "alta" && ageHours >= 24) {
        recommendation = "Priorizar aprovação";
        recommendationReason = "Ticket antigo e com urgência alta.";
      } else if (daysToStart !== null && daysToStart <= 3) {
        recommendation = "Aprovar hoje";
        recommendationReason = "Turma inicia em até 3 dias.";
      } else if (value >= 500000) {
        recommendation = "Validar e aprovar";
        recommendationReason = "Valor elevado, reduzir risco de atraso no ciclo financeiro.";
      }

      return {
        ...typed,
        priority_score: score,
        priority_level: level,
        priority_reasons: reasons,
        operational_recommendation: recommendation,
        operational_recommendation_reason: recommendationReason,
      };
    })
    .sort((a, b) => {
      const scoreDiff = Number(b.priority_score ?? 0) - Number(a.priority_score ?? 0);
      if (scoreDiff !== 0) return scoreDiff;
      const aCreated = a.created_at ? new Date(String(a.created_at)).getTime() : 0;
      const bCreated = b.created_at ? new Date(String(b.created_at)).getTime() : 0;
      return bCreated - aCreated;
    });

  return NextResponse.json({ ok: true, items: prioritized });
}

export async function PATCH(request: Request) {
  const auth = await requireFormacaoRoles(allowedRoles);
  if (!auth.ok) return auth.response;

  const body = await request.json();
  const { id, action, reason } = body;

  if (!id || !["APROVAR", "REJEITAR"].includes(action)) {
    return NextResponse.json({ ok: false, error: "Parâmetros inválidos" }, { status: 400 });
  }

  const s = (await supabaseServer()) as FormacaoSupabaseClient;

  if (action === "REJEITAR") {
    const { error } = await s
      .from("formacao_inscricoes_staging")
      .update({ status: "REJEITADA" })
      .eq("id", id)
      .eq("escola_id", auth.escolaId);

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  // Se for APROVAR:
  const { data: staging, error: fetchErr } = await s
    .from("formacao_inscricoes_staging")
    .select("*")
    .eq("id", id)
    .eq("escola_id", auth.escolaId)
    .single();

  if (fetchErr || !staging) return NextResponse.json({ ok: false, error: "Inscrição não encontrada" }, { status: 404 });

  if (!staging.email) {
    return NextResponse.json({ ok: false, error: "Inscrição sem email não pode ser aprovada automaticamente" }, { status: 400 });
  }

  try {
    let generatedPassword: string | null = null;
    let createdNewUser = false;

    // 1. Verificar se o usuário já existe no Auth
    const authUserData = (await callAuthAdminJob(request, "findUserByEmail", {
      email: staging.email,
    })) as { user?: { id?: string | null } | null } | null;
    
    if (!authUserData?.user?.id) {
      // 2. Criar usuário se não existir
      generatedPassword = generateTemporaryPassword();
      await callAuthAdminJob(request, "createUser", {
        email: staging.email,
        password: generatedPassword,
        email_confirm: true,
        user_metadata: {
          nome: staging.nome_completo,
          role: "formando",
          escola_id: auth.escolaId,
          tenant_type: "formacao",
        },
      });
      createdNewUser = true;
    }

    // 3. Atualizar Status para APROVADA (Isso dispara o Postgres Trigger tr_formacao_promote_staging)
    const { error: updateErr } = await s
      .from("formacao_inscricoes_staging")
      .update({ status: "APROVADA" })
      .eq("id", id);

    if (updateErr) throw updateErr;

    // 4. Se um novo usuário foi criado, enviar email de credenciais
    if (createdNewUser && generatedPassword) {
      try {
        const { data: cohortData } = await s
          .from("formacao_cohorts")
          .select("nome, curso_nome")
          .eq("id", staging.cohort_id)
          .single();
          
        const { data: escolaData } = await s
          .from("escolas")
          .select("nome")
          .eq("id", auth.escolaId)
          .single();

        if (cohortData && escolaData) {
          const emailContent = buildFormacaoCredentialsEmail({
            nome: staging.nome_completo,
            email: staging.email,
            senha_temp: generatedPassword,
            escolaNome: escolaData.nome,
            cursoNome: cohortData.curso_nome,
            cohortNome: cohortData.nome,
          });

          await sendMail({
            to: staging.email,
            subject: emailContent.subject,
            html: emailContent.html,
            text: emailContent.text,
          });
        }
      } catch (mailErr) {
        console.error("Erro ao enviar email de aprovação:", mailErr);
      }
    }

    return NextResponse.json({ 
      ok: true, 
      message: "Inscrição aprovada com sucesso. Usuário criado e matrícula oficial realizada." 
    });

  } catch (err: unknown) {
    console.error("Approval Flow Error:", err);
    const message = err instanceof Error ? err.message : "Falha ao aprovar inscrição";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
