import { Resend } from "resend";

type SendArgs = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

type ResendConfig = {
  apiKey: string;
  from: string;
};

let resendClient: Resend | null = null;

function getResendConfig(): ResendConfig | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  const from = process.env.RESEND_FROM_EMAIL || "KLASSE Formação <suporte@klasse.ao>";
  return { apiKey, from };
}

function getResendClient(apiKey: string) {
  if (!resendClient) {
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

function htmlToText(html: string) {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(s: string) {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string)
  );
}

export async function sendMail({
  to,
  subject,
  html,
  text,
}: SendArgs): Promise<{ ok: true } | { ok: false; error: string }> {
  const config = getResendConfig();
  if (!config) {
    return { ok: false, error: "Resend not configured (set RESEND_API_KEY)." };
  }

  try {
    const resend = getResendClient(config.apiKey);
    const resolvedText = text || htmlToText(html);

    const { error } = await resend.emails.send({
      from: config.from,
      to: [to],
      subject,
      html,
      text: resolvedText,
    });

    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export function buildFormacaoCredentialsEmail(args: {
  nome: string;
  email: string;
  senha_temp?: string;
  escolaNome: string;
  cursoNome: string;
  cohortNome: string;
}) {
  const { nome, email, senha_temp, escolaNome, cursoNome, cohortNome } = args;
  const loginUrl = process.env.NEXT_PUBLIC_APP_URL || "https://formacao.klasse.ao";

  const subject = `KLASSE • Acesso à plataforma: ${escolaNome}`;
  const text = [
    `Olá, ${nome}.`,
    `Sua matrícula no curso "${cursoNome}" (${cohortNome}) foi confirmada em ${escolaNome}.`,
    `Abaixo estão suas credenciais de acesso ao Portal do Formando:`,
    `E-mail: ${email}`,
    `Senha temporária: ${senha_temp}`,
    `Acesse: ${loginUrl}`,
    `Por segurança, altere sua senha após o primeiro acesso.`,
  ]
    .filter(Boolean)
    .join("\n");

  const html = `
  <div style="font-family:Inter,system-ui,-apple-system,sans-serif; line-height:1.6; color:#0f172a; max-width:600px; margin:0 auto; padding:20px;">
    <h2 style="margin:0 0 12px 0; font-size:20px; color:#C8902A;">Portal do Formando KLASSE</h2>
    <p style="margin:0 0 8px 0;">Olá, <strong>${escapeHtml(nome)}</strong>.</p>
    <p style="margin:0 0 16px 0;">A sua matrícula no curso <strong>${escapeHtml(cursoNome)}</strong> (${escapeHtml(cohortNome)}) foi confirmada com sucesso pelo centro <strong>${escapeHtml(escolaNome)}</strong>.</p>
    
    <div style="background-color:#f8fafc; border-left:4px solid #C8902A; padding:16px; margin-bottom:20px; border-radius:4px;">
      <p style="margin:0 0 8px 0; font-size:14px; color:#64748b; text-transform:uppercase; letter-spacing:1px; font-weight:bold;">Suas credenciais de acesso</p>
      <p style="margin:0 0 4px 0;">Utilizador (E-mail): <strong>${escapeHtml(email)}</strong></p>
      ${
        senha_temp
          ? `<p style="margin:0 0 0 0;">Senha Temporária: <strong style="background:#e2e8f0; padding:2px 6px; border-radius:4px; font-family:monospace;">${escapeHtml(senha_temp)}</strong></p>`
          : `<p style="margin:0 0 0 0; font-size:13px; color:#64748b;">Senha: <em>Aquela que definiu durante o registo online.</em></p>`
      }
    </div>

    <p style="margin:0 0 24px 0;">
      <a href="${escapeHtml(loginUrl)}" style="display:inline-block; background-color:#C8902A; color:#ffffff; text-decoration:none; padding:12px 24px; border-radius:8px; font-weight:600; text-align:center;">
        Aceder à Plataforma
      </a>
    </p>

    ${
      senha_temp
        ? `<p style="margin:16px 0 0 0; font-size:13px; color:#475569;">⚠️ Por motivos de segurança, o sistema solicitará a alteração desta senha no seu primeiro login.</p>`
        : ""
    }

    <hr style="margin:32px 0; border:none; border-top:1px solid #e2e8f0;" />
    
    <p style="margin:0; font-size:12px; color:#94a3b8; text-align:center;">
      Este e-mail foi enviado automaticamente para ${escapeHtml(email)} pelo sistema KLASSE.
    </p>
  </div>
  `;

  return { subject, html, text };
}
