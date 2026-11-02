import { createHash, randomUUID } from 'node:crypto';

export type AppyPayConfig = {
  schoolId: string;
  environment: 'production' | 'sandbox';
  clientId: string;
  clientSecret: string;
  paymentMethod: string;
};
export class PaymentError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}
export function configForSchool(raw: string | undefined, schoolId: string): AppyPayConfig {
  let config: AppyPayConfig;
  try { config = JSON.parse(raw ?? 'null'); } catch { throw new PaymentError(503, 'AppyPay não configurada'); }
  if (!config || typeof config.schoolId !== 'string' || !/^[a-f0-9-]{36}$/i.test(config.schoolId) || config.schoolId !== schoolId) throw new PaymentError(403, 'AppyPay não disponível para esta escola');
  if (!['production', 'sandbox'].includes(config.environment) || !config.clientId || !config.clientSecret ||
      !/^REF_[a-f0-9-]{36}$/i.test(config.paymentMethod)) throw new PaymentError(503, 'Configuração AppyPay incompleta');
  return config;
}
export type Charge = {
  id: string; merchantTransactionId?: string; amount?: number; currency?: string;
  reference?: { referenceNumber: string; entity: string; dueDate: string };
  responseStatus: {
    successful: boolean; status: string; code: number; source?: string;
    reference?: { referenceNumber: string; entity: string; dueDate: string };
  };
};
// GET /charges/{id} returns a payment envelope in the actual sandbox API.
// Require correlated event evidence as well as payment status; status alone is not proof.
export function lookupCharge(payload: unknown): Charge {
  const envelope = payload as { payment?: {
    id: string; type: string; status: string; merchantTransactionId?: string; amount?: number; currency?: string;
    reference?: Charge['reference'];
    transactionEvents: { transactionId: string; type: string; createdDate: string; responseStatus: Charge['responseStatus'] }[];
  } };
  if (!envelope?.payment) return payload as Charge;
  const p = envelope.payment;
  if (p.type !== 'Charge' || typeof p.id !== 'string' || typeof p.status !== 'string' ||
      !Array.isArray(p.transactionEvents) || !p.transactionEvents.length || p.transactionEvents.some(e =>
        e.transactionId !== p.id || e.type !== 'Charge' || !Number.isFinite(Date.parse(e.createdDate)))) {
    throw new PaymentError(502, 'Histórico AppyPay inválido');
  }
  const events = [...p.transactionEvents].sort((a, b) => Date.parse(b.createdDate) - Date.parse(a.createdDate));
  if (events.length > 1 && Date.parse(events[0].createdDate) === Date.parse(events[1].createdDate)) {
    throw new PaymentError(502, 'Histórico AppyPay ambíguo');
  }
  const evidence = events[0].responseStatus;
  if (!evidence || typeof evidence.code !== 'number' || typeof evidence.successful !== 'boolean') {
    throw new PaymentError(502, 'Histórico AppyPay inválido');
  }
  return { id: p.id, merchantTransactionId: p.merchantTransactionId, amount: p.amount, currency: p.currency,
    reference: p.reference, responseStatus: { ...evidence, status: p.status } };
}
const endpoints = {
  production: { api: 'https://gwy-api.appypay.co.ao/v2.0', token: 'https://login.microsoftonline.com/appypay.co.ao/oauth2/token', resource: 'bee57785-7a19-4f1c-9c8d-aa03f2f0e333' },
  sandbox: { api: 'https://gwy-api-tst.appypay.co.ao/v2.0', token: 'https://login.microsoftonline.com/appypaydev.onmicrosoft.com/oauth2/token', resource: '2aed7612-de64-46b5-9e59-1f48f8902d14' },
} as const;
export class AppyPayClient {
  private token?: { value: string; until: number };
  constructor(private readonly config: AppyPayConfig, private readonly http: typeof fetch = fetch) {}
  private async send(url: string, init: RequestInit): Promise<Response> {
    try { return await this.http(url, { ...init, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15_000) }); }
    catch { throw new PaymentError(502, 'AppyPay indisponível; confirme o estado antes de tentar novamente'); }
  }
  async authenticate(): Promise<string> {
    if (this.token && this.token.until > Date.now()) return this.token.value;
    const endpoint = endpoints[this.config.environment];
    const response = await this.send(endpoint.token, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: this.config.clientId, client_secret: this.config.clientSecret, resource: endpoint.resource }) });
    if (!response.ok) throw new PaymentError(503, 'Não foi possível autenticar na AppyPay');
    const data = await response.json();
    if (typeof data.access_token !== 'string' || !Number.isFinite(Number(data.expires_in)) || Number(data.expires_in) <= 60) throw new PaymentError(502, 'Resposta de autenticação inválida');
    this.token = { value: data.access_token, until: Date.now() + (Number(data.expires_in) - 60) * 1000 };
    return this.token.value;
  }
  private async request(path: string, init: RequestInit = {}, lookup = false): Promise<Charge> {
    const token = await this.authenticate();
    const response = await this.send(endpoints[this.config.environment].api + path, { ...init,
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' } });
    if (!response.ok) throw new PaymentError(502, `AppyPay devolveu HTTP ${response.status}`);
    const raw = await response.json();
    const data = lookup ? lookupCharge(raw) : raw;
    if (!data || typeof data.id !== 'string' || !data.responseStatus || typeof data.responseStatus.code !== 'number') throw new PaymentError(502, 'Resposta AppyPay inválida');
    return data;
  }
  createReference(input: { amount: number; merchantId: string; reference: string; expiresAt: string; description?: string }) {
    if (!Number.isFinite(input.amount) || input.amount <= 0 || !/^[a-z0-9]{1,15}$/i.test(input.merchantId) ||
        !/^\d{9}$/.test(input.reference) || Date.parse(input.expiresAt) <= Date.now()) throw new PaymentError(400, 'Cobrança inválida');
    return this.request('/charges', { method: 'POST', body: JSON.stringify({ amount: input.amount, currency: 'AOA',
      description: input.description ?? 'Pagamento KLASSE', merchantTransactionId: input.merchantId, paymentMethod: this.config.paymentMethod,
      paymentInfo: { referenceNumber: input.reference, dueDate: input.expiresAt } }) });
  }
  async simulateReference(entity: string, referenceNumber: string) {
    if (this.config.environment !== 'sandbox') throw new PaymentError(403, 'Simulação apenas em homologação');
    if (!/^\d{3,10}$/.test(entity) || !/^\d{9}$/.test(referenceNumber)) throw new PaymentError(400, 'Referência inválida');
    const token = await this.authenticate();
    const response = await this.send(endpoints.sandbox.api + '/mocks/referenceProcessing', { method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ entity, referenceNumber }) });
    // The real simulator may return an empty successful body. Never retry this POST.
    if (!response.ok) throw new PaymentError(502, 'Simulação requer verificação');
  }
  getCharge(id: string) {
    if (!/^[a-f0-9-]{36}$/i.test(id)) throw new PaymentError(400, 'Identificador inválido');
    return this.request(`/charges/${encodeURIComponent(id)}`, {}, true);
  }
}
export type Reference = {
  kind?: 'monthly' | 'service'; intent_id?: string; id: string; school_id: string; provider_id: string; obligation_id: string; provider_reference_id: string;
  reference: string; entity: string; amount: number; currency: string; expires_at: string; status: string;
  provider_payload: { merchant_id?: string };
};
export function newReference(schoolId: string, providerId: string, obligationId: string, amount: number): Reference {
  const id = randomUUID();
  const merchantId = createHash('sha256').update(id).digest('hex').slice(0, 15);
  const reference = String(100000000 + (parseInt(createHash('sha256').update(id).digest('hex').slice(0, 12), 16) % 900000000));
  return { id, school_id: schoolId, provider_id: providerId, obligation_id: obligationId, provider_reference_id: merchantId,
    reference, entity: '', amount, currency: 'AOA', expires_at: new Date(Date.now() + 86400000).toISOString(), status: 'pending', provider_payload: { merchant_id: merchantId } };
}
export function sameAmount(a: unknown, b: unknown) {
  return Number.isFinite(Number(a)) && Number.isFinite(Number(b)) && Math.round(Number(a) * 100) === Math.round(Number(b) * 100);
}
export function verifiedCharge(charge: Charge, reference: Reference): 'paid' | 'pending' | 'failed' {
  if (charge.id !== reference.provider_reference_id || charge.merchantTransactionId !== reference.provider_payload.merchant_id ||
      !sameAmount(charge.amount, reference.amount) || (charge.currency !== undefined && charge.currency !== 'AOA') ||
      charge.responseStatus.source !== 'REF') throw new PaymentError(409, 'Cobrança não corresponde à referência local');
  // 101 means accepted for processing; only 100 is a completed payment.
  if (charge.responseStatus.successful === true && charge.responseStatus.status === 'Success' && charge.responseStatus.code === 100) return 'paid';
  if (charge.responseStatus.code === 101 || ['Pending', 'Processing'].includes(charge.responseStatus.status)) return 'pending';
  return 'failed';
}
export function publicReference(reference: Reference) {
  return { id: reference.id, entity: reference.entity, reference: reference.reference, amount: reference.amount,
    currency: reference.currency, expires_at: reference.expires_at, status: reference.status };
}
