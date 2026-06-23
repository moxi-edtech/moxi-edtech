import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendMail } from "@/lib/mailer";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
  }

  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Configuração do servidor inválida." }, { status: 500 });
  }

  try {
    const cooldownHours = 24;

    // 1. Buscar etapas não concluídas cujo prazo já expirou
    const { data: steps, error: stepsError } = await admin
      .from("onboarding_steps")
      .select(`
        id,
        onboarding_id,
        step_code,
        title,
        status,
        owner_type,
        deadline_at,
        onboarding_requests:onboarding_id (
          id,
          escola_id,
          escola_nome,
          escola_email,
          director_nome,
          tracking_token,
          financeiro
        )
      `)
      .neq("status", "concluido")
      .not("deadline_at", "is", null)
      .lt("deadline_at", new Date().toISOString());

    if (stepsError) throw stepsError;

    const results = {
      total_overdue: steps?.length || 0,
      notifications_sent: 0,
      logs_created: 0,
      errors: [] as string[],
    };

    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://app.klasse.ao").replace(/\/$/, "");

    for (const step of (steps || [])) {
      const request = (step as any).onboarding_requests;
      if (!request) continue;

      const cooldownSince = new Date(Date.now() - cooldownHours * 60 * 60 * 1000).toISOString();
      const { data: existingAlert } = await admin
        .from("audit_logs")
        .select("id")
        .eq("acao", "SLA_OVERDUE_ALERT_SENT")
        .eq("entity", "onboarding_steps")
        .eq("entity_id", step.id)
        .gte("created_at", cooldownSince)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingAlert?.id) {
        continue;
      }

      const escolaNome = request.escola_nome;
      const trackingToken = request.tracking_token;
      const stepTitle = step.title;
      const ownerType = step.owner_type;

      let emailDestino = "";
      let logRecipient = "";

      if (ownerType === "escola") {
        emailDestino = request.escola_email;
        logRecipient = `Escola (${escolaNome})`;
      } else if (ownerType === "parceiro") {
        const influencerCodigo = request.financeiro?.influencer_codigo;
        if (influencerCodigo) {
          const { data: affiliate } = await admin
            .from("afiliados")
            .select("email")
            .eq("codigo", influencerCodigo.toUpperCase())
            .maybeSingle();

          if (affiliate?.email) {
            emailDestino = affiliate.email;
            logRecipient = `Parceiro (${influencerCodigo})`;
          }
        }
      } else {
        emailDestino = process.env.RESEND_FROM_EMAIL || "suporte@klasse.ao";
        logRecipient = "KLASSE Super Admin";
      }

      if (!emailDestino) {
        results.errors.push(`Nenhum email destino encontrado para etapa ${stepTitle} da escola ${escolaNome} (Owner: ${ownerType}).`);
        continue;
      }

      const subject = `⚠️ Onboarding Atrasado · ${escolaNome} · Etapa: ${stepTitle}`;
      const trackingUrl = `${baseUrl}/onboarding/acompanhar/${trackingToken}`;
      const partnerUrl = `${baseUrl}/influencers/${request.financeiro?.influencer_codigo || ""}`;

      const html = `
        <div style="font-family: sans-serif; line-height: 1.6; color: #0f172a; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
          <h2 style="color: #ef4444; margin-top: 0;">Alerta de SLA Excedido!</h2>
          <p>Olá,</p>
          <p>Este é um aviso automático informando que o processo de onboarding do centro <strong>${escolaNome}</strong> tem uma etapa pendente de atenção imediata.</p>
          
          <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 12px; margin: 18px 0; border-radius: 4px;">
            <p style="margin: 0; font-weight: bold; color: #991b1b;">Etapa Atrasada:</p>
            <p style="margin: 4px 0 0 0; font-size: 15px; color: #7f1d1d;">${stepTitle} (Responsável: ${ownerType.toUpperCase()})</p>
            <p style="margin: 4px 0 0 0; font-size: 13px; color: #7f1d1d;"><strong>Prazo Limite:</strong> ${new Date(step.deadline_at!).toLocaleDateString("pt-PT")} às ${new Date(step.deadline_at!).toLocaleTimeString("pt-PT")}</p>
          </div>

          <p>Por favor, realize a ação necessária ou faça o follow-up para desbloquear o onboarding:</p>
          
          <div style="margin: 20px 0; text-align: center;">
            <a href="${ownerType === "parceiro" ? partnerUrl : trackingUrl}" style="background-color: #0f172a; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; display: inline-block;">
              Aceder ao Portal do Onboarding
            </a>
          </div>

          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="font-size: 12px; color: #64748b; margin: 0;">Esta mensagem foi enviada para ${emailDestino} devido ao status operacional do onboarding.</p>
        </div>
      `;

      // Enviar e-mail
      const mailRes = await sendMail({
        to: emailDestino,
        subject,
        html,
      });

      if (mailRes.ok) {
        results.notifications_sent++;

        // Registrar no log de auditoria
          const { error: logError } = await admin
            .from("audit_logs")
            .insert({
              escola_id: request.escola_id ?? null,
              portal: "cron",
              acao: "SLA_OVERDUE_ALERT_SENT",
              tabela: "onboarding_steps",
            entity: "onboarding_steps",
            entity_id: step.id,
            details: {
              step_code: step.step_code,
              step_title: stepTitle,
              owner_type: ownerType,
              deadline_at: step.deadline_at,
              email_sent_to: emailDestino,
              recipient: logRecipient,
            },
          });

        if (logError) {
          results.errors.push(`Erro ao criar audit_log para etapa ${step.id}: ${logError.message}`);
        } else {
          results.logs_created++;
        }
      } else {
        results.errors.push(`Erro ao enviar e-mail para ${emailDestino}: ${mailRes.error}`);
      }
    }

    return NextResponse.json({ ok: true, results });

  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
