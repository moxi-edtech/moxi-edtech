export type ProxyPayEnvironment = "sandbox" | "production";

export type ProxyPayReference = {
  id: string | number;
  entity_id: string | number;
  number: string | number;
  amount: string;
  end_datetime?: string;
  expiry_date?: string;
  status?: string;
  custom_fields?: Record<string, string>;
};

export type ProxyPayPayment = {
  id: string | number;
  transaction_id?: string | number;
  reference_id: string | number;
  entity_id: string | number;
  amount: string;
  datetime: string;
  custom_fields?: Record<string, string>;
  [key: string]: unknown;
};

export type ProxyPayConfig = {
  apiKey: string;
  environment: ProxyPayEnvironment;
};
