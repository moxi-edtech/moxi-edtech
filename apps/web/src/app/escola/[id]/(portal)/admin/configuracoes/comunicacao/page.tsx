"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, QrCode, RefreshCw, Save, Smartphone } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Skeleton, useToast } from "@/components/feedback/FeedbackSystem";
import { useEscolaId } from "@/hooks/useEscolaId";
import { buildContextualPortalHref } from "@/lib/navigation";

type ProviderStatus = "disabled" | "pending_qr" | "connected" | "disconnected" | "error";

type ProviderPayload = {
  id: string;
  display_name: string;
  status: ProviderStatus;
  daily_limit: number;
  monthly_limit: number;
  session_name: string | null;
  config: {
    fallback_phone?: string | null;
  } | null;
};

type Props = {
  params: Promise<{ id: string }>;
};

const STATUS_OPTIONS: ProviderStatus[] = ["disabled", "pending_qr", "connected", "disconnected", "error"];

export default function ComunicacaoConfigPage({ params }: Props) {
  const { id: escolaId } = use(params);
  const { escolaSlug } = useEscolaId();
  const escolaParam = escolaSlug || escolaId;
  const pathname = usePathname();
  const base = buildContextualPortalHref(escolaParam, "/admin/configuracoes", pathname);
  const { error, success } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshingQr, setRefreshingQr] = useState(false);
  const [provider, setProvider] = useState<ProviderPayload | null>(null);
  const [planAllowsWhatsappAuto, setPlanAllowsWhatsappAuto] = useState(false);
  const [experimentalEnabled, setExperimentalEnabled] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrMessage, setQrMessage] = useState<string | null>(null);
  const [qrStatus, setQrStatus] = useState<string | null>(null);
  const [qrRawStatus, setQrRawStatus] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    displayName: "WAHA Experimental",
    status: "disabled" as ProviderStatus,
    fallbackPhone: "",
  });

  const sessionName = useMemo(() => {
    if (provider?.session_name) return provider.session_name;
    return `klasse_school_${String(escolaParam).replace(/-/g, "").toLowerCase()}`;
  }, [provider?.session_name, escolaParam]);

  async function loadConfig() {
    try {
      setLoading(true);
      const res = await fetch(`/api/escola/${escolaParam}/admin/configuracoes/comunicacao`, {
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        error(json?.error || "Falha ao carregar configuração de comunicação.");
        return;
      }

      const nextProvider = (json.data?.provider ?? null) as ProviderPayload | null;
      setProvider(nextProvider);
      setPlanAllowsWhatsappAuto(Boolean(json.data?.planAllowsWhatsappAuto));
      setExperimentalEnabled(Boolean(json.data?.experimentalEnabled));
      setFormData({
        displayName: nextProvider?.display_name || "WAHA Experimental",
        status: nextProvider?.status || "disabled",
        fallbackPhone: nextProvider?.config?.fallback_phone || "",
      });
    } catch (err) {
      console.error(err);
      error("Erro inesperado ao carregar comunicação.");
    } finally {
      setLoading(false);
    }
  }

  async function loadQr() {
    try {
      setRefreshingQr(true);
      const res = await fetch(`/api/escola/${escolaParam}/admin/configuracoes/comunicacao/qr`, {
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setQrDataUrl(null);
        setQrStatus(null);
        setQrRawStatus(null);
        setQrMessage(json?.error || "QR Code indisponível.");
        return;
      }

      setQrDataUrl(json.data?.qrDataUrl ?? null);
      setQrStatus(json.data?.status ?? null);
      setQrRawStatus(json.data?.rawStatus ?? null);
      setQrMessage(json.data?.message ?? null);
    } catch (err) {
      console.error(err);
      setQrDataUrl(null);
      setQrStatus(null);
      setQrRawStatus(null);
      setQrMessage("Erro ao carregar QR Code.");
    } finally {
      setRefreshingQr(false);
    }
  }

  async function saveConfig() {
    try {
      setSaving(true);
      const res = await fetch(`/api/escola/${escolaParam}/admin/configuracoes/comunicacao`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        error(json?.error || "Falha ao salvar configuração WAHA.");
        return;
      }

      setProvider(json.data);
      success("Configuração WAHA salva com sucesso.");
      await loadQr();
    } catch (err) {
      console.error(err);
      error("Erro inesperado ao salvar configuração.");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (!escolaParam) return;
    loadConfig();
  }, [escolaParam]);

  useEffect(() => {
    if (!escolaParam) return;
    loadQr();
  }, [escolaParam]);

  useEffect(() => {
    if (!escolaParam) return;
    if (!qrDataUrl && qrStatus !== "pending_qr") return;

    const timer = window.setInterval(() => {
      loadQr();
    }, 5000);

    return () => window.clearInterval(timer);
  }, [escolaParam, qrDataUrl, qrStatus]);

  const statusBadgeClass =
    formData.status === "connected"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : formData.status === "pending_qr"
        ? "bg-amber-50 text-amber-700 border-amber-200"
        : formData.status === "error" || formData.status === "disconnected"
          ? "bg-red-50 text-red-700 border-red-200"
          : "bg-slate-100 text-slate-600 border-slate-200";

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-6 py-10 space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              href={base}
              className="group inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-600 transition-colors"
            >
              <ArrowLeft className="h-3 w-3 transition-transform group-hover:-translate-x-1" />
              Voltar ao painel
            </Link>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Comunicação</h1>
            <p className="text-sm text-slate-500">
              Configure o canal WAHA da escola e acompanhe o QR Code de pareamento da sessão.
            </p>
          </div>
          <Badge className={`${statusBadgeClass} border text-[10px] font-bold uppercase tracking-widest`}>
            {qrStatus || formData.status}
          </Badge>
        </div>

        {!planAllowsWhatsappAuto && !loading && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="py-4 text-sm text-amber-900">
              O plano actual da escola não libera WhatsApp automático. A configuração fica visível para diagnóstico, mas o uso operacional depende dessa feature.
            </CardContent>
          </Card>
        )}

        {!experimentalEnabled && !loading && (
          <Card className="border-slate-200 bg-slate-100/80">
            <CardContent className="py-4 text-sm text-slate-700">
              O kill switch `WAHA_EXPERIMENTAL_ENABLED` está desligado no servidor. A configuração continua acessível, mas o QR e os envios automáticos podem permanecer indisponíveis.
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5 text-emerald-600" />
                WAHA da Escola
              </CardTitle>
              <CardDescription>
                Visibilidade do provider liberado pelo super admin para esta escola.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {loading ? (
                <div className="space-y-3">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Nome de exibição</label>
                      <input
                        value={formData.displayName}
                        onChange={(e) => setFormData((prev) => ({ ...prev, displayName: e.target.value }))}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-800 outline-none transition focus:border-emerald-300 focus:bg-white"
                        placeholder="WAHA Experimental"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Estado</label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value as ProviderStatus }))}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-800 outline-none transition focus:border-emerald-300 focus:bg-white"
                      >
                        {STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Session name</label>
                    <input
                      value={sessionName}
                      disabled
                      className="w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 font-mono text-xs text-slate-600"
                    />
                    <p className="text-xs text-slate-400">
                      O identificador da sessão é mantido no servidor para evitar conflito entre escolas.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Telefone de fallback</label>
                    <input
                      value={formData.fallbackPhone}
                      onChange={(e) => setFormData((prev) => ({ ...prev, fallbackPhone: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-800 outline-none transition focus:border-emerald-300 focus:bg-white"
                      placeholder="+244..."
                    />
                  </div>

                  <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 md:grid-cols-2">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Limite diário</div>
                      <div className="mt-1 font-semibold text-slate-900">{provider?.daily_limit ?? 50} mensagens</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Limite mensal</div>
                      <div className="mt-1 font-semibold text-slate-900">{provider?.monthly_limit ?? 500} mensagens</div>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button onClick={saveConfig} disabled={saving} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
                      <Save className="h-4 w-4" />
                      {saving ? "Salvando..." : "Salvar configuração"}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5 text-slate-700" />
                QR Code da Sessão
              </CardTitle>
              <CardDescription>
                Use este QR para parear o WhatsApp da escola com a sessão WAHA actual.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-end">
                <Button variant="outline" onClick={loadQr} disabled={refreshingQr} className="gap-2">
                  <RefreshCw className={`h-4 w-4 ${refreshingQr ? "animate-spin" : ""}`} />
                  Atualizar QR
                </Button>
              </div>

              <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-6">
                {loading ? (
                  <div className="flex min-h-[280px] items-center justify-center">
                    <Skeleton className="h-56 w-56 rounded-2xl" />
                  </div>
                ) : qrDataUrl ? (
                  <div className="flex flex-col items-center gap-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qrDataUrl} alt="QR Code WAHA" className="h-64 w-64 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm" />
                    <p className="text-center text-xs text-slate-500">
                      Abra o WhatsApp no telefone da escola e faça o pareamento pelo QR acima.
                    </p>
                    {qrRawStatus && (
                      <p className="rounded-full bg-slate-100 px-3 py-1 font-mono text-[10px] text-slate-500">
                        WAHA: {qrRawStatus}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 text-center">
                    <QrCode className="h-10 w-10 text-slate-300" />
                    <p className="max-w-sm text-sm text-slate-500">
                      {qrMessage || "Nenhum QR pendente no momento. Se a sessão já estiver ligada, o WAHA pode não expor um QR activo."}
                    </p>
                    {qrRawStatus && (
                      <p className="rounded-full bg-white px-3 py-1 font-mono text-[10px] text-slate-500">
                        WAHA: {qrRawStatus}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
