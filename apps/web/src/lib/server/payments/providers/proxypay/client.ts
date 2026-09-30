import "server-only";
import type { ProxyPayConfig, ProxyPayPayment, ProxyPayReference } from "./types";

const ACCEPT = "application/vnd.proxypay.v2+json";

export class ProxyPayClient {
  private readonly baseUrl: string;
  constructor(private readonly config: ProxyPayConfig) {
    this.baseUrl = config.environment === "production"
      ? "https://api.proxypay.co.ao"
      : "https://api.sandbox.proxypay.co.ao";
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          Accept: ACCEPT,
          Authorization: `Token ${this.config.apiKey}`,
          "Content-Type": "application/json",
          ...(init.headers ?? {}),
        },
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`ProxyPay HTTP ${response.status}`);
      const text = await response.text();
      return (text ? JSON.parse(text) : undefined) as T;
    } finally {
      clearTimeout(timer);
    }
  }

  async createReference(input: { amount: number; expiresAt: string; customFields: Record<string, string> }) {
    const id = await this.request<string | number>("/reference_ids", { method: "POST", body: "" });
    await this.request<void>(`/references/${id}`, {
      method: "PUT",
      body: JSON.stringify({ amount: input.amount.toFixed(2), end_datetime: input.expiresAt, custom_fields: input.customFields }),
    });
    return { id: String(id), amount: input.amount.toFixed(2), expiresAt: input.expiresAt };
  }

  async getPayments(limit = 100) {
    return this.request<ProxyPayPayment[]>(`/payments?n=${Math.min(Math.max(limit, 1), 100)}`, { method: "GET" });
  }

  async acknowledgePayment(id: string | number) {
    await this.request<void>(`/payments/${encodeURIComponent(String(id))}`, { method: "DELETE" });
  }

  async deleteReference(id: string | number) {
    await this.request<void>(`/references/${encodeURIComponent(String(id))}`, { method: "DELETE" });
  }
}

export type { ProxyPayReference };
