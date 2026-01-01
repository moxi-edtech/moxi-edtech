import twilio from "twilio";

export class TwilioWhatsAppService {
  private client: twilio.Twilio;
  private whatsappNumber: string;
  private smsNumber: string | null;

  constructor() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    this.whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER || "";
    this.smsNumber = process.env.TWILIO_SMS_NUMBER || null;

    if (!accountSid || !authToken || !this.whatsappNumber) {
      throw new Error("Twilio credentials not configured");
    }

    this.client = twilio(accountSid, authToken);
  }

  async enviarMensagem(to: string, body: string, mediaUrl?: string) {
    try {
      const formattedTo = this.formatarNumero(to);
      const payload: any = {
        from: `whatsapp:${this.whatsappNumber}`,
        to: `whatsapp:${formattedTo}`,
        body,
      };
      if (mediaUrl) payload.mediaUrl = [mediaUrl];
      const message = await this.client.messages.create(payload);
      return { success: true, messageId: message.sid };
    } catch (error: any) {
      return { success: false, error: error?.message || "Erro ao enviar WhatsApp", code: error?.code };
    }
  }

  async enviarSMS(to: string, body: string) {
    if (!this.smsNumber) {
      return { success: false, error: "Número SMS não configurado" };
    }
    try {
      const formatted = this.formatarNumero(to);
      const message = await this.client.messages.create({
        from: this.smsNumber,
        to: formatted,
        body,
      });
      return { success: true, messageId: message.sid };
    } catch (error: any) {
      return { success: false, error: error?.message || "Erro ao enviar SMS", code: error?.code };
    }
  }

  async enviar(notificacao: { to: string; body: string; mediaUrl?: string }) {
    const wa = await this.enviarMensagem(notificacao.to, notificacao.body, notificacao.mediaUrl);
    if (wa.success) return wa;

    // Fallback para SMS se erro conhecido de bloqueio (ex.: 63058)
    if (wa.code === 63058) {
      return await this.enviarSMS(notificacao.to, notificacao.body);
    }
    return wa;
  }

  private formatarNumero(numero: string) {
    const digits = (numero || "").replace(/\D/g, "");
    if (digits.startsWith("244")) return `+${digits}`;
    if (digits.startsWith("9")) return `+244${digits}`;
    if (digits.length === 9) return `+244${digits}`;
    return `+${digits}`;
  }
}

export const whatsappService = (() => {
  try {
    return new TwilioWhatsAppService();
  } catch (e) {
    return null;
  }
})();
