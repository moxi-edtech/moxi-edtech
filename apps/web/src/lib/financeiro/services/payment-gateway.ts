// apps/web/src/lib/financeiro/services/payment-gateway.ts
// Serviço simples para iniciar pagamentos via MCX (ou simulado).

type InitiateParams = {
  amount: number;
  mobileNumber: string;
  referenceId: string | number;
  description?: string;
};

export type InitiateResult = {
  success: boolean;
  transactionId?: string;
  message?: string;
};

export class PaymentGatewayService {
  private baseUrl?: string;
  private apiKey?: string;
  private merchantId?: string;
  private mock: boolean;

  constructor() {
    this.baseUrl = process.env.MCX_API_URL?.trim();
    this.apiKey = process.env.MCX_API_KEY?.trim();
    this.merchantId = process.env.MCX_MERCHANT_ID?.trim();
    // Se não houver config, roda em modo simulado para desenvolvimento
    this.mock = (process.env.MCX_MOCK ?? "").toLowerCase() === "1" || !this.baseUrl || !this.apiKey;
  }

  async initiateMCX(params: InitiateParams): Promise<InitiateResult> {
    const { amount, mobileNumber, referenceId, description } = params;

    if (!amount || !mobileNumber || !referenceId) {
      return { success: false, message: "Parâmetros inválidos para pagamento" };
    }

    if (this.mock) {
      const fakeId = `mcx_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
      return { success: true, transactionId: fakeId, message: "Simulado" };
    }

    try {
      const payload = {
        merchantId: this.merchantId,
        amount,
        mobileNumber,
        referenceId: String(referenceId),
        description,
      } as Record<string, any>;

      const res = await fetch(`${this.baseUrl}/payments/mcx/initiate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(payload),
        // Importante: tempo de timeout fica a cargo do ambiente (Next runtime)
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        return { success: false, message: text || `Falha HTTP ${res.status}` };
      }

      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        transactionId?: string;
        id?: string;
        message?: string;
      };

      const transactionId = data.transactionId || data.id;
      if (!transactionId) {
        return { success: false, message: data.message || "Resposta sem transactionId" };
      }

      return { success: true, transactionId };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, message };
    }
  }
}
