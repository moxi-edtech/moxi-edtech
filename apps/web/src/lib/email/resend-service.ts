import { Resend } from "resend";

export class ResendEmailService {
  private resend: Resend;
  private from: string;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error("Resend API key not configured");
    }
    this.resend = new Resend(apiKey);
    this.from = process.env.RESEND_FROM_EMAIL || "Klasse <no-reply@klasse.ao>";
  }

  async enviarEmail(params: { to: string | string[]; subject: string; html: string; text?: string }) {
    const toList = Array.isArray(params.to) ? params.to : [params.to];
    const text = params.text || this.htmlToText(params.html);
    const { error, data } = await this.resend.emails.send({
      from: this.from,
      to: toList,
      subject: params.subject,
      html: params.html,
      text,
    });
    if (error) return { success: false, error: error.message };
    return { success: true, emailId: data?.id };
  }

  private htmlToText(html: string) {
    return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  }
}

export const emailService = (() => {
  try {
    return new ResendEmailService();
  } catch (e) {
    return null;
  }
})();
