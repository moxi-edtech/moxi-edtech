"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Building2,
  FileDigit,
  KeyRound,
  Loader2,
  ShieldCheck,
  Wrench,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

import { useToast } from "@/components/feedback/FeedbackSystem";

type FiscalOnboardingProps = {
  empresaId: string | null;
  seriesAtivas: number;
  chavesAtivas: number;
  onSuccess: () => Promise<void> | void;
};

type ApiEnvelope<T = Record<string, unknown>> = {
  ok?: boolean;
  data?: T;
  error?: {
    code?: string;
    message?: string;
  };
};

type EmpresaCreateData = {
  id: string;
};

type SetupDefaultsData = {
  razao_social_default?: string;
  nif_default?: string;
  key_version_default?: number;
  private_key_ref_default?: string;
  public_key_pem_default?: string;
  key_fingerprint_default?: string;
};

type KmsResolveData = {
  public_key_pem?: string;
  key_fingerprint?: string;
};

type FormState = {
  razaoSocial: string;
  nif: string;
  endereco: string;
  certificadoAgtNumero: string;
  keyVersion: string;
  keyFingerprint: string;
  privateKeyRef: string;
  publicKeyPem: string;
};

const CURRENT_YEAR = new Date().getUTCFullYear();
const DEFAULT_KMS_PRIVATE_KEY_REF = "kms://us-east-2/alias/klasse-fiscal-signing";

async function postJson<T>(
  url: string,
  body: Record<string, unknown>
): Promise<{ ok: boolean; status: number; json: ApiEnvelope<T> }> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await response.json().catch(() => ({}))) as ApiEnvelope<T>;
  return { ok: response.ok && json.ok === true, status: response.status, json };
}

export function FiscalOnboarding({
  empresaId,
  seriesAtivas,
  chavesAtivas,
  onSuccess,
}: FiscalOnboardingProps) {
  const [loading, setLoading] = useState(false);
  const [loadingDefaults, setLoadingDefaults] = useState(true);
  const [resolvingKmsKey, setResolvingKmsKey] = useState(false);
  const [showAdvancedKeyFields, setShowAdvancedKeyFields] = useState(false);
  const [form, setForm] = useState<FormState>({
    razaoSocial: "",
    nif: "",
    endereco: "",
    certificadoAgtNumero: "",
    keyVersion: "1",
    keyFingerprint: "",
    privateKeyRef: "",
    publicKeyPem: "",
  });
  const autoResolvedRef = useRef(false);
  const { success, warning, error } = useToast();

  const needsEmpresa = !empresaId;
  const needsSeries = seriesAtivas <= 0;
  const needsKey = chavesAtivas <= 0;

  const requiresEmpresaForm = needsEmpresa;
  const requiresKeyForm = needsKey;

  const nifValid = /^\d{9,20}$/.test(form.nif.trim());
  const keyVersionNumber = Number(form.keyVersion);
  const keyVersionValid = Number.isInteger(keyVersionNumber) && keyVersionNumber > 0;

  const submitDisabled = useMemo(() => {
    if (loading) return true;
    if (!needsEmpresa && !needsSeries && !needsKey) return false;
    if (requiresEmpresaForm) {
      if (form.razaoSocial.trim().length < 2) return true;
      if (!nifValid) return true;
    }
    if (requiresKeyForm) {
      if (!keyVersionValid) return true;
      if (form.privateKeyRef.trim().length === 0) return true;
    }
    return false;
  }, [
    form.privateKeyRef,
    form.razaoSocial,
    keyVersionValid,
    loading,
    needsEmpresa,
    needsKey,
    needsSeries,
    nifValid,
    requiresEmpresaForm,
    requiresKeyForm,
  ]);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const resolveKmsPublicKey = async (): Promise<
    { publicKeyPem: string; keyFingerprint: string } | null
  > => {
    if (!form.privateKeyRef.trim()) {
      warning("Informe a referência KMS (private_key_ref) para buscar a chave pública.");
      return null;
    }
    setResolvingKmsKey(true);
    try {
      const response = await fetch("/api/fiscal/setup/chaves/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ private_key_ref: form.privateKeyRef.trim() }),
      });
      const json = (await response.json().catch(() => ({}))) as ApiEnvelope<KmsResolveData>;
      if (!response.ok || json.ok !== true || !json.data) {
        warning(
          "Não foi possível carregar chave pública da KMS.",
          json.error?.message ?? "Verifique a role IAM e o Key ID/alias."
        );
        return null;
      }

      const resolved = {
        publicKeyPem: json.data?.public_key_pem ?? "",
        keyFingerprint: json.data?.key_fingerprint ?? "",
      };

      setForm((prev) => ({
        ...prev,
        publicKeyPem: resolved.publicKeyPem || prev.publicKeyPem,
        keyFingerprint: resolved.keyFingerprint || prev.keyFingerprint,
      }));
      success("Chave pública carregada da KMS.");
      return resolved.publicKeyPem && resolved.keyFingerprint ? resolved : null;
    } catch {
      warning("Não foi possível carregar chave pública da KMS.");
      return null;
    } finally {
      setResolvingKmsKey(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const loadDefaults = async () => {
      setLoadingDefaults(true);
      try {
        const response = await fetch("/api/fiscal/setup/defaults", {
          method: "GET",
          cache: "no-store",
        });
        const json = (await response.json().catch(() => ({}))) as ApiEnvelope<SetupDefaultsData>;
        if (cancelled || !response.ok || json.ok !== true || !json.data) return;

        setForm((prev) => ({
          ...prev,
          razaoSocial: prev.razaoSocial || json.data?.razao_social_default || "",
          nif: prev.nif || json.data?.nif_default || "",
          keyVersion:
            prev.keyVersion || String(json.data?.key_version_default ?? 1),
          privateKeyRef:
            prev.privateKeyRef ||
            json.data?.private_key_ref_default ||
            DEFAULT_KMS_PRIVATE_KEY_REF,
          publicKeyPem: prev.publicKeyPem || json.data?.public_key_pem_default || "",
          keyFingerprint: prev.keyFingerprint || json.data?.key_fingerprint_default || "",
        }));
      } finally {
        if (!cancelled) setLoadingDefaults(false);
      }
    };
    void loadDefaults();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (autoResolvedRef.current) return;
    if (!needsKey) return;
    if (!form.privateKeyRef.trim()) return;
    if (form.publicKeyPem.trim() && form.keyFingerprint.trim()) return;
    autoResolvedRef.current = true;
    void resolveKmsPublicKey();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsKey, form.privateKeyRef, form.publicKeyPem, form.keyFingerprint]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitDisabled) return;

    setLoading(true);
    try {
      let resolvedEmpresaId = empresaId;

      if (needsEmpresa) {
        const empresaRes = await postJson<EmpresaCreateData>("/api/fiscal/setup/empresa", {
          nome: form.razaoSocial.trim(),
          nif: form.nif.trim(),
          endereco: form.endereco.trim() || undefined,
          certificado_agt_numero: form.certificadoAgtNumero.trim() || undefined,
          metadata: { origem: "fiscal_onboarding_ui" },
        });

        if (!empresaRes.ok || !empresaRes.json.data?.id) {
          if (empresaRes.status === 403) {
            warning(
              "A criação da empresa fiscal requer permissão de Super Admin. Solicite ao Administrador Global."
            );
          } else {
            error(
              "Falha ao criar empresa fiscal",
              empresaRes.json.error?.message ?? "Não foi possível criar a empresa fiscal."
            );
          }
          return;
        }

        resolvedEmpresaId = empresaRes.json.data.id;
      }

      if (!resolvedEmpresaId) {
        error(
          "Configuração fiscal incompleta",
          "Não foi possível resolver a empresa fiscal para continuar."
        );
        return;
      }

      const bindingRes = await postJson("/api/fiscal/setup/bindings", {
        empresa_id: resolvedEmpresaId,
        is_primary: true,
        metadata: { origem: "fiscal_onboarding_ui" },
      });

      if (!bindingRes.ok && bindingRes.status !== 409) {
        error(
          "Falha ao vincular escola",
          bindingRes.json.error?.message ?? "Não foi possível vincular escola à empresa fiscal."
        );
        return;
      }

      if (needsSeries) {
        const seriesPayloads = [
          {
            empresa_id: resolvedEmpresaId,
            tipo_documento: "FT",
            prefixo: String(CURRENT_YEAR),
            origem_documento: "interno",
            ativa: true,
            metadata: { origem: "fiscal_onboarding_ui" },
          },
          {
            empresa_id: resolvedEmpresaId,
            tipo_documento: "FR",
            prefixo: String(CURRENT_YEAR),
            origem_documento: "interno",
            ativa: true,
            metadata: { origem: "fiscal_onboarding_ui" },
          },
        ];

        for (const payload of seriesPayloads) {
          const seriesRes = await postJson("/api/fiscal/setup/series", payload);
          if (!seriesRes.ok && seriesRes.status !== 409) {
            error(
              "Falha ao criar série fiscal",
              seriesRes.json.error?.message ?? "Não foi possível cadastrar série fiscal."
            );
            return;
          }
        }
      }

      if (needsKey) {
        let resolvedPublicKeyPem = form.publicKeyPem.trim();
        let resolvedKeyFingerprint = form.keyFingerprint.trim();

        if (!resolvedPublicKeyPem || resolvedKeyFingerprint.length < 8) {
          const kmsResolved = await resolveKmsPublicKey();
          if (!kmsResolved) {
            error(
              "Falha ao obter chave pública da KMS",
              "Não foi possível completar o setup sem a chave pública. Verifique credenciais AWS/IAM."
            );
            return;
          }
          resolvedPublicKeyPem = kmsResolved.publicKeyPem;
          resolvedKeyFingerprint = kmsResolved.keyFingerprint;
        }

        const chaveRes = await postJson("/api/fiscal/setup/chaves", {
          empresa_id: resolvedEmpresaId,
          key_version: keyVersionNumber,
          public_key_pem: resolvedPublicKeyPem,
          private_key_ref: form.privateKeyRef.trim(),
          key_fingerprint: resolvedKeyFingerprint,
          status: "active",
          metadata: { origem: "fiscal_onboarding_ui" },
        });

        if (!chaveRes.ok && chaveRes.status !== 409) {
          error(
            "Falha ao cadastrar chave fiscal",
            chaveRes.json.error?.message ?? "Não foi possível registrar chave fiscal."
          );
          return;
        }
      }

      success("Onboarding fiscal concluído.");
      await onSuccess();
    } catch {
      error("Erro interno. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <header className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#1F6B3B]/10">
            <ShieldCheck className="h-8 w-8 text-[#1F6B3B]" />
          </div>
          <h2 className="font-sora text-2xl font-semibold text-slate-900">Ativação Fiscal AGT</h2>
          <p className="mt-2 text-sm text-slate-500">
            Complete a configuração da empresa fiscal, séries e chave de assinatura para emissão
            no padrão SAF-T(AO).
          </p>
        </header>

        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
            Empresa:{" "}
            <span className={needsEmpresa ? "font-semibold text-[#E3B23C]" : "font-semibold text-[#1F6B3B]"}>
              {needsEmpresa ? "Pendente" : "OK"}
            </span>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
            Séries:{" "}
            <span className={needsSeries ? "font-semibold text-[#E3B23C]" : "font-semibold text-[#1F6B3B]"}>
              {needsSeries ? "Pendente" : "OK"}
            </span>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
            Chave:{" "}
            <span className={needsKey ? "font-semibold text-[#E3B23C]" : "font-semibold text-[#1F6B3B]"}>
              {needsKey ? "Pendente" : "OK"}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 rounded-xl border border-slate-200 p-4 md:p-5">
          {requiresEmpresaForm ? (
            <div className="space-y-4">
              <h3 className="font-sora text-sm font-semibold text-slate-900">Dados da Empresa Fiscal</h3>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Razão Social da Instituição
                </span>
                <div className="relative">
                  <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={form.razaoSocial}
                    onChange={(event) => setField("razaoSocial", event.target.value)}
                    className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-[#E3B23C] focus:ring-2 focus:ring-[#E3B23C]/30"
                    placeholder="Ex: Colégio Esperança Lda."
                    required
                  />
                </div>
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Número de Identificação Fiscal (NIF)
                </span>
                <div className="relative">
                  <FileDigit className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={form.nif}
                    onChange={(event) => setField("nif", event.target.value)}
                    className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-[#E3B23C] focus:ring-2 focus:ring-[#E3B23C]/30"
                    placeholder="Ex: 5000000000"
                    required
                  />
                </div>
              </label>
            </div>
          ) : null}

          {requiresKeyForm ? (
            <div className="space-y-4 border-t border-slate-200 pt-4">
              <h3 className="font-sora text-sm font-semibold text-slate-900">
                Configuração da Chave Fiscal
              </h3>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Key Version
                </span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={form.keyVersion}
                  onChange={(event) => setField("keyVersion", event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#E3B23C] focus:ring-2 focus:ring-[#E3B23C]/30"
                  required
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Key Fingerprint (sha256:...)
                </span>
                <input
                  type="text"
                  value={form.keyFingerprint}
                  onChange={(event) => setField("keyFingerprint", event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 font-mono text-xs text-slate-900 outline-none focus:border-[#E3B23C] focus:ring-2 focus:ring-[#E3B23C]/30"
                  placeholder="sha256:..."
                  required
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Private Key Ref (KMS)
                </span>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={form.privateKeyRef}
                    onChange={(event) => setField("privateKeyRef", event.target.value)}
                    className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 font-mono text-xs text-slate-900 outline-none focus:border-[#E3B23C] focus:ring-2 focus:ring-[#E3B23C]/30"
                    placeholder="kms://us-east-2/alias/klasse-fiscal-signing"
                    required
                  />
                </div>
              </label>

              <button
                type="button"
                onClick={() => setShowAdvancedKeyFields((prev) => !prev)}
                className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-700"
              >
                {showAdvancedKeyFields ? (
                  <>
                    <ChevronUp className="h-3.5 w-3.5" />
                    Ocultar modo avançado
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3.5 w-3.5" />
                    Mostrar modo avançado
                  </>
                )}
              </button>

              {showAdvancedKeyFields ? (
                <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <label className="block space-y-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Key Fingerprint (sha256:...)
                    </span>
                    <input
                      type="text"
                      value={form.keyFingerprint}
                      onChange={(event) => setField("keyFingerprint", event.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 font-mono text-xs text-slate-900 outline-none focus:border-[#E3B23C] focus:ring-2 focus:ring-[#E3B23C]/30"
                      placeholder="sha256:..."
                    />
                  </label>

                  <label className="block space-y-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Public Key PEM
                    </span>
                    <textarea
                      value={form.publicKeyPem}
                      onChange={(event) => setField("publicKeyPem", event.target.value)}
                      className="min-h-32 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-mono text-xs text-slate-900 outline-none focus:border-[#E3B23C] focus:ring-2 focus:ring-[#E3B23C]/30"
                      placeholder="-----BEGIN PUBLIC KEY-----..."
                    />
                  </label>
                </div>
              ) : null}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={submitDisabled}
            className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1F6B3B] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#18542e] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading || loadingDefaults ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                A configurar...
              </>
            ) : (
              <>
                {needsEmpresa || needsSeries || needsKey ? "Concluir Setup Fiscal" : "Atualizar Estado"}
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </>
            )}
          </button>
        </form>

        {needsKey ? (
          <button
            type="button"
            onClick={() => {
              void resolveKmsPublicKey();
            }}
            disabled={resolvingKmsKey || !form.privateKeyRef.trim()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {resolvingKmsKey ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                A consultar KMS...
              </>
            ) : (
              <>
                <KeyRound className="h-4 w-4" />
                Buscar Chave Pública da KMS
              </>
            )}
          </button>
        ) : null}

        <p className="flex items-center justify-center gap-1.5 text-center text-[11px] font-semibold text-slate-400">
          <Wrench className="h-3.5 w-3.5" />
          As ações executam as rotas reais de setup fiscal e gravam auditoria.
        </p>
      </div>
    </section>
  );
}
