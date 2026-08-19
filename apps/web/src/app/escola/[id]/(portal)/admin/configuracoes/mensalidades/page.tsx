"use client";

import { useParams, usePathname } from "next/navigation";
import ConfigSystemShell from "@/components/escola/settings/ConfigSystemShell";
import { buildConfigMenuItems } from "../_shared/menuItems";
import PrecosClient from "@/app/escola/[id]/(portal)/financeiro/configuracoes/precos/PrecosClient";
import { ModalShell } from "@/components/ui/ModalShell";
import { useEffect, useState, useMemo } from "react";
import { useToast } from "@/components/feedback/FeedbackSystem";
import { useEscolaId } from "@/hooks/useEscolaId";
import { buildContextualPortalHref } from "@/lib/navigation";
import {
  getServicoCategoria,
  SERVICOS_ESCOLA_PADRAO,
} from "@/lib/secretaria/servicos-catalogo-padrao";
import { Search, Filter, Plus, Save, RefreshCw, CheckCircle2, Layers, Banknote, FileText, Check } from "lucide-react";

type ServicoItem = {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  valor_base: number;
  ativo: boolean;
  pode_bloquear_por_debito?: boolean;
  exige_pagamento_antes_de_liberar?: boolean;
  aceita_pagamento_pendente?: boolean;
  exige_aprovacao?: boolean;
};

const DEFAULT_SERVICO: ServicoItem = {
  id: "",
  codigo: "",
  nome: "",
  descricao: "",
  valor_base: 0,
  ativo: true,
  pode_bloquear_por_debito: false,
  exige_pagamento_antes_de_liberar: false,
  aceita_pagamento_pendente: false,
  exige_aprovacao: false,
};

type CatalogType = "documento" | "servico";
type TabView = "propinas" | "catalogo";
type FilterPricing = "todos" | "com_preco" | "gratuito" | "sem_preco";

function formatarKwanza(valor: number): string {
  return new Intl.NumberFormat("pt-AO", { style: "currency", currency: "AOA", maximumFractionDigits: 0 })
    .format(valor)
    .replace("AOA", "Kz");
}

export default function MensalidadesEmolumentosPage() {
  const params = useParams() as { id?: string };
  const escolaId = params?.id;
  const { escolaSlug } = useEscolaId();
  const escolaParam = escolaSlug || escolaId;
  const pathname = usePathname();
  const base = buildContextualPortalHref(escolaParam, "/admin/configuracoes", pathname);
  const { error, success } = useToast();
  const isStandalone = pathname?.includes("/admin/configuracoes/mensalidades");

  const [activeTab, setActiveTab] = useState<TabView>("propinas");
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogSaving, setCatalogSaving] = useState(false);
  const [catalogItems, setCatalogItems] = useState<ServicoItem[]>([]);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogForm, setCatalogForm] = useState<ServicoItem>(DEFAULT_SERVICO);
  const [catalogType, setCatalogType] = useState<CatalogType>("servico");
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});
  const [priceSavingId, setPriceSavingId] = useState<string | null>(null);
  const [togglingItemId, setTogglingItemId] = useState<string | null>(null);
  const [batchSaving, setBatchSaving] = useState(false);
  const [installingDefaults, setInstallingDefaults] = useState(false);

  // Search & Filter state for catalog
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"todas" | CatalogType>("todas");
  const [pricingFilter, setPricingFilter] = useState<FilterPricing>("todos");

  const buildPriceDrafts = (items: ServicoItem[]) =>
    items.reduce<Record<string, string>>((acc, item) => {
      acc[item.id] = String(Number(item.valor_base ?? 0));
      return acc;
    }, {});

  useEffect(() => {
    if (!escolaParam) return;
    void loadCatalog();
  }, [escolaParam]);

  const loadCatalog = async () => {
    if (!escolaParam) return;
    setCatalogLoading(true);
    setCatalogError(null);
    try {
      const res = await fetch(`/api/escola/${escolaParam}/admin/servicos`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Falha ao carregar serviços");
      const items: ServicoItem[] = Array.isArray(json.items) ? json.items : [];
      setCatalogItems(items);
      setPriceDrafts(buildPriceDrafts(items));
    } catch (err) {
      setCatalogItems([]);
      setPriceDrafts({});
      setCatalogError(err instanceof Error ? err.message : "Erro ao carregar serviços");
    } finally {
      setCatalogLoading(false);
    }
  };

  const normalizeCodigo = (value: string) => value.replace(/\s+/g, "_").toUpperCase();
  const ensureDocumentoPrefix = (value: string) => {
    if (!value) return "DOC_";
    return value.startsWith("DOC_") ? value : `DOC_${value}`;
  };
  const inferCatalogType = (codigo: string): CatalogType =>
    getServicoCategoria(codigo) === "documento" ? "documento" : "servico";

  const sortedItems = useMemo(() => {
    return [...catalogItems].sort((a, b) => {
      const categoryOrder = inferCatalogType(a.codigo).localeCompare(inferCatalogType(b.codigo));
      if (categoryOrder !== 0) return categoryOrder;
      return a.nome.localeCompare(b.nome, "pt");
    });
  }, [catalogItems]);

  const filteredItems = useMemo(() => {
    return sortedItems.filter((item) => {
      const itemType = inferCatalogType(item.codigo);
      if (categoryFilter !== "todas" && itemType !== categoryFilter) return false;

      const valor = Number(priceDrafts[item.id] ?? item.valor_base ?? 0);
      if (pricingFilter === "com_preco" && valor <= 0) return false;
      if (pricingFilter === "gratuito" && valor !== 0) return false;
      if (pricingFilter === "sem_preco" && valor > 0) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = item.nome.toLowerCase().includes(q);
        const matchesCode = item.codigo.toLowerCase().includes(q);
        const matchesDesc = (item.descricao || "").toLowerCase().includes(q);
        if (!matchesName && !matchesCode && !matchesDesc) return false;
      }

      return true;
    });
  }, [sortedItems, categoryFilter, pricingFilter, searchQuery, priceDrafts]);

  const documentos = useMemo(
    () => filteredItems.filter((item) => inferCatalogType(item.codigo) === "documento"),
    [filteredItems]
  );
  const emolumentos = useMemo(
    () => filteredItems.filter((item) => inferCatalogType(item.codigo) === "servico"),
    [filteredItems]
  );

  const dirtyItemIds = useMemo(() => {
    return catalogItems.filter((item) => {
      const draft = priceDrafts[item.id];
      if (draft === undefined) return false;
      return Number(draft || 0) !== Number(item.valor_base ?? 0);
    }).map((item) => item.id);
  }, [catalogItems, priceDrafts]);

  const configuredCount = catalogItems.filter((item) => item.ativo && Number(item.valor_base ?? 0) > 0).length;
  const pendingCount = catalogItems.filter((item) => item.ativo && Number(item.valor_base ?? 0) <= 0).length;
  const inactiveCount = catalogItems.filter((item) => !item.ativo).length;
  const missingDefaultCount = SERVICOS_ESCOLA_PADRAO.filter(
    (defaultItem) => !catalogItems.some((item) => item.codigo === defaultItem.codigo)
  ).length;

  const buildServicoPayload = (item: ServicoItem, patch: Partial<ServicoItem> = {}) => ({
    id: item.id || null,
    codigo: patch.codigo ?? item.codigo,
    nome: patch.nome ?? item.nome,
    descricao: patch.descricao ?? item.descricao,
    valor_base: Number(patch.valor_base ?? item.valor_base ?? 0),
    ativo: patch.ativo ?? item.ativo,
    pode_bloquear_por_debito: Boolean(
      patch.pode_bloquear_por_debito ?? item.pode_bloquear_por_debito
    ),
    exige_pagamento_antes_de_liberar: Boolean(
      patch.exige_pagamento_antes_de_liberar ?? item.exige_pagamento_antes_de_liberar
    ),
    aceita_pagamento_pendente: Boolean(
      patch.aceita_pagamento_pendente ?? item.aceita_pagamento_pendente
    ),
    exige_aprovacao: Boolean(patch.exige_aprovacao ?? item.exige_aprovacao),
  });

  const upsertCatalogItem = (item: ServicoItem) => {
    setCatalogItems((prev) => {
      const index = prev.findIndex((entry) => entry.id === item.id);
      if (index >= 0) {
        const next = [...prev];
        next[index] = item;
        return next;
      }
      return [item, ...prev];
    });
    setPriceDrafts((prev) => ({ ...prev, [item.id]: String(Number(item.valor_base ?? 0)) }));
  };

  const handleInstallDefaults = async () => {
    if (!escolaParam) return;
    setInstallingDefaults(true);
    try {
      const res = await fetch(`/api/escola/${escolaParam}/admin/servicos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "install_defaults" }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Falha ao preparar catálogo");
      const items: ServicoItem[] = Array.isArray(json.items) ? json.items : [];
      setCatalogItems(items);
      setPriceDrafts(buildPriceDrafts(items));
      success(
        json.inserted > 0
          ? `${json.inserted} serviço(s) pré-configurado(s) com sucesso.`
          : "Catálogo padrão já se encontrava completo."
      );
    } catch (err) {
      error(err instanceof Error ? err.message : "Erro ao preparar catálogo");
    } finally {
      setInstallingDefaults(false);
    }
  };

  const handleSavePrice = async (item: ServicoItem, valorOverride?: number) => {
    if (!escolaParam) return;
    const raw = priceDrafts[item.id] ?? "0";
    const valor = Math.max(0, Number((valorOverride ?? raw) || 0));
    if (!Number.isFinite(valor)) {
      error("Preço inválido.");
      return;
    }
    setPriceSavingId(item.id);
    try {
      const res = await fetch(`/api/escola/${escolaParam}/admin/servicos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildServicoPayload(item, { valor_base: valor })),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok || !json?.item) {
        throw new Error(json?.error || "Falha ao guardar preço");
      }
      upsertCatalogItem(json.item);
      success(valor === 0 ? "Serviço marcado como gratuito." : "Preço atualizado com sucesso.");
    } catch (err) {
      error(err instanceof Error ? err.message : "Erro ao guardar preço");
    } finally {
      setPriceSavingId(null);
    }
  };

  const handleSaveAllDirtyPrices = async () => {
    if (!escolaParam || dirtyItemIds.length === 0) return;
    setBatchSaving(true);
    try {
      let savedCount = 0;
      for (const id of dirtyItemIds) {
        const item = catalogItems.find((entry) => entry.id === id);
        if (!item) continue;
        const raw = priceDrafts[id] ?? "0";
        const valor = Math.max(0, Number(raw || 0));
        const res = await fetch(`/api/escola/${escolaParam}/admin/servicos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildServicoPayload(item, { valor_base: valor })),
        });
        const json = await res.json().catch(() => ({}));
        if (res.ok && json?.ok && json?.item) {
          upsertCatalogItem(json.item);
          savedCount++;
        }
      }
      success(`${savedCount} preço(s) atualizado(s) com sucesso.`);
    } catch (err) {
      error(err instanceof Error ? err.message : "Erro ao guardar preços em lote.");
    } finally {
      setBatchSaving(false);
    }
  };

  const handleToggleServico = async (item: ServicoItem) => {
    if (!escolaParam) return;
    setTogglingItemId(item.id);
    try {
      const res = await fetch(`/api/escola/${escolaParam}/admin/servicos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildServicoPayload(item, { ativo: !item.ativo })),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok || !json?.item) {
        throw new Error(json?.error || "Falha ao atualizar estado do serviço");
      }
      upsertCatalogItem(json.item);
      success(json.item.ativo ? "Serviço ativado e incluído no catálogo ativo." : "Serviço desativado; não será considerado em alertas de catálogo.");
    } catch (err) {
      error(err instanceof Error ? err.message : "Erro ao atualizar estado do serviço");
    } finally {
      setTogglingItemId(null);
    }
  };

  const handleSaveServico = async () => {
    if (!escolaParam) return;
    if (!catalogForm.codigo.trim() || !catalogForm.nome.trim()) {
      error("Código e nome são obrigatórios.");
      return;
    }
    if (catalogType === "documento" && !catalogForm.codigo.startsWith("DOC_")) {
      error("Documentos devem usar o prefixo DOC_.");
      return;
    }
    setCatalogSaving(true);
    try {
      const res = await fetch(`/api/escola/${escolaParam}/admin/servicos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildServicoPayload(catalogForm)),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok || !json?.item) {
        throw new Error(json?.error || "Falha ao guardar serviço");
      }

      upsertCatalogItem(json.item);
      setCatalogForm(DEFAULT_SERVICO);
      setCatalogOpen(false);
      success("Serviço guardado com sucesso.");
    } catch (err) {
      error(err instanceof Error ? err.message : "Erro ao guardar serviço");
    } finally {
      setCatalogSaving(false);
    }
  };

  const renderServicoRows = (items: ServicoItem[], emptyLabel: string) => (
    <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {items.length === 0 ? (
        <div className="bg-slate-50 px-4 py-8 text-center text-xs font-medium text-slate-500">
          {emptyLabel}
        </div>
      ) : (
        items.map((item) => {
          const value = priceDrafts[item.id] ?? String(Number(item.valor_base ?? 0));
          const dirty = Number(value || 0) !== Number(item.valor_base ?? 0);
          const currentNum = Number(value || 0);
          const status = !item.ativo ? "Desativado" : currentNum > 0 ? "Configurado" : "Pendente";

          return (
            <div
              key={item.id}
              className={`grid gap-3 px-4 py-3.5 transition-colors md:grid-cols-[1fr_160px_180px] md:items-center ${
                dirty ? "bg-amber-50/40" : "bg-white hover:bg-slate-50/60"
              }`}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-slate-900">{item.nome}</p>
                  <span className={`rounded px-2 py-0.5 text-[10px] font-semibold border ${
                    status === "Configurado"
                      ? "border-slate-200 bg-slate-100 text-slate-700"
                      : status === "Pendente"
                        ? "border-amber-200 bg-amber-50 text-amber-800"
                        : "border-slate-200 bg-white text-slate-400"
                  }`}>
                    {status}
                  </span>
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 border border-slate-200">
                    {currentNum > 0 ? formatarKwanza(currentNum) : "Sem preço"}
                  </span>
                  {dirty && (
                    <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                      Modificado
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-slate-500 font-mono text-[11px]">{item.codigo}</p>
                {item.descricao && (
                  <p className="mt-1 text-xs text-slate-600 line-clamp-1">{item.descricao}</p>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setCatalogForm(item);
                    setCatalogType(inferCatalogType(item.codigo));
                    setCatalogOpen(true);
                  }}
                  className="mt-1 text-xs font-medium text-slate-600 hover:text-slate-900 hover:underline"
                >
                  Editar detalhes
                </button>
                {inferCatalogType(item.codigo) === "servico" && (
                  <button
                    type="button"
                    onClick={() => void handleToggleServico(item)}
                    disabled={togglingItemId === item.id}
                    className="ml-3 mt-1 text-xs font-medium text-slate-500 hover:text-slate-900 hover:underline disabled:opacity-50"
                  >
                    {togglingItemId === item.id ? "A atualizar..." : item.ativo ? "Desativar serviço" : "Ativar serviço"}
                  </button>
                )}
              </div>

              <label className="block">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Preço Base (Kz)
                </span>
                <div
                  className={`mt-1 flex items-center rounded-lg border bg-white px-3 py-1.5 transition-all ${
                    dirty
                      ? "border-amber-400 ring-2 ring-amber-400/20"
                      : "border-slate-200 focus-within:border-slate-400"
                  }`}
                >
                  <input
                    type="number"
                    min={0}
                    value={value}
                    onChange={(event) =>
                      setPriceDrafts((prev) => ({ ...prev, [item.id]: event.target.value }))
                    }
                    className="w-full bg-transparent text-sm font-semibold text-slate-900 outline-none"
                  />
                  <span className="ml-1 text-xs font-medium text-slate-400">Kz</span>
                </div>
              </label>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleSavePrice(item)}
                  disabled={!dirty || priceSavingId === item.id}
                  className="h-9 rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 transition-colors"
                >
                  {priceSavingId === item.id ? "A guardar..." : "Guardar"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPriceDrafts((prev) => ({ ...prev, [item.id]: "0" }));
                    void handleSavePrice(item, 0);
                  }}
                  disabled={currentNum === 0 || priceSavingId === item.id}
                  className="h-9 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-300 transition-colors"
                >
                  Grátis
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );

  if (!escolaParam) return null;

  return (
    <ConfigSystemShell
      escolaId={escolaParam}
      title="Mensalidades & Emolumentos"
      subtitle="Configure tabelas de propinas, prazos de vencimento e catálogo oficial de cobranças da escola."
      menuItems={buildConfigMenuItems(base)}
      backHref={buildContextualPortalHref(escolaParam, "/admin", pathname)}
      embedded={!isStandalone}
      showInternalMenu={false}
    >
      <div className="space-y-6 font-sans">
        {/* Segmented Navigation Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-3">
          <nav className="flex space-x-1 rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setActiveTab("propinas")}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
                activeTab === "propinas"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Banknote className="h-4 w-4 text-slate-500" />
              Propinas & Matrículas
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("catalogo")}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
                activeTab === "catalogo"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Layers className="h-4 w-4 text-slate-500" />
              Catálogo de Emolumentos & Documentos
              {catalogItems.length > 0 && (
                <span className="ml-1 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                  {catalogItems.length}
                </span>
              )}
            </button>
          </nav>

          {activeTab === "catalogo" && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleInstallDefaults}
                disabled={installingDefaults}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors shadow-sm"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${installingDefaults ? "animate-spin" : ""}`} />
                {installingDefaults ? "A preparar..." : "Carregar Catálogo Padrão"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCatalogForm(DEFAULT_SERVICO);
                  setCatalogType("servico");
                  setCatalogOpen(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors shadow-sm"
              >
                <Plus className="h-3.5 w-3.5" />
                Novo Serviço
              </button>
            </div>
          )}
        </div>

        {/* Tab 1: Propinas & Matrículas */}
        {activeTab === "propinas" && (
          <div className="space-y-6">
            <PrecosClient escolaId={escolaParam} embedded showDueDate={true} />
          </div>
        )}

        {/* Tab 2: Catálogo de Emolumentos */}
        {activeTab === "catalogo" && (
          <div className="space-y-6">
            {/* Filter and Search Bar */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Pesquisar por nome, código ou palavra-chave..."
                    className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-4 py-2 text-xs font-medium text-slate-900 outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 transition-all"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50/70 px-2.5 py-1.5 text-xs text-slate-600">
                    <Filter className="h-3.5 w-3.5 text-slate-400" />
                    <span className="font-semibold text-slate-500">Categoria:</span>
                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value as any)}
                      className="bg-transparent font-medium text-slate-900 outline-none cursor-pointer"
                    >
                      <option value="todas">Todas</option>
                      <option value="documento">Documentos</option>
                      <option value="servico">Emolumentos</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50/70 px-2.5 py-1.5 text-xs text-slate-600">
                    <span className="font-semibold text-slate-500">Preço:</span>
                    <select
                      value={pricingFilter}
                      onChange={(e) => setPricingFilter(e.target.value as any)}
                      className="bg-transparent font-medium text-slate-900 outline-none cursor-pointer"
                    >
                      <option value="todos">Todos</option>
                      <option value="com_preco">Com Preço</option>
                      <option value="gratuito">Gratuitos (0 Kz)</option>
                      <option value="sem_preco">Sem preço</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Status metrics bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
                <div className="flex items-center gap-3">
                  <span>Total: <strong className="text-slate-900">{catalogItems.length}</strong></span>
                  <span>Configurados: <strong className="text-slate-900">{configuredCount}</strong></span>
                  <span>Pendentes: <strong className="text-amber-800">{pendingCount}</strong></span>
                  <span>Desativados: <strong className="text-slate-500">{inactiveCount}</strong></span>
                  {missingDefaultCount > 0 && (
                    <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-medium border border-amber-200/60">
                      {missingDefaultCount} item(s) padrão não configurados
                    </span>
                  )}
                </div>
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="text-slate-500 hover:text-slate-900 underline font-medium"
                  >
                    Limpar pesquisa
                  </button>
                )}
              </div>
            </div>

            {catalogError && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
                {catalogError}
              </div>
            )}

            {/* Documentos and Emolumentos Sections */}
            <div className="grid gap-6 lg:grid-cols-2">
              <section className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-slate-500" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                      Documentos
                    </h3>
                  </div>
                  <span className="text-xs font-semibold text-slate-400">{documentos.length} item(s)</span>
                </div>
                {catalogLoading
                  ? renderServicoRows([], "A carregar documentos...")
                  : renderServicoRows(documentos, "Nenhum documento encontrado.")}
              </section>

              <section className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-slate-500" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                      Emolumentos & Serviços
                    </h3>
                  </div>
                  <span className="text-xs font-semibold text-slate-400">{emolumentos.length} item(s)</span>
                </div>
                {catalogLoading
                  ? renderServicoRows([], "A carregar emolumentos...")
                  : renderServicoRows(emolumentos, "Nenhum emolumento encontrado.")}
              </section>
            </div>

            {/* Floating Unsaved Changes Bar */}
            {dirtyItemIds.length > 0 && (
              <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center justify-between gap-6 rounded-xl border border-slate-800 bg-slate-900 px-5 py-3.5 text-white shadow-2xl animate-in fade-in slide-in-from-bottom-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500/20 text-amber-400">
                    <Save className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white">
                      {dirtyItemIds.length} preço(s) alterado(s)
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Guarde as alterações para aplicar no balcão da secretaria.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPriceDrafts(buildPriceDrafts(catalogItems))}
                    disabled={batchSaving}
                    className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors"
                  >
                    Descartar
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveAllDirtyPrices}
                    disabled={batchSaving}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-white px-4 py-1.5 text-xs font-semibold text-slate-900 hover:bg-slate-100 transition-colors"
                  >
                    {batchSaving ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                    {batchSaving ? "A guardar..." : "Guardar Alterações"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal Shell for Catalog Item Details */}
      <ModalShell
        open={catalogOpen}
        title={catalogForm.id ? "Editar Serviço/Emolumento" : "Novo Serviço/Emolumento"}
        description="Defina os parâmetros do item para cobrança e emissão no balcão."
        onClose={() => setCatalogOpen(false)}
      >
        <div className="space-y-5 font-sans">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-semibold text-slate-600">Tipo de Item:</span>
            {([
              { id: "servico", label: "Emolumento / Serviço" },
              { id: "documento", label: "Documento Oficial" },
            ] as const).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setCatalogType(item.id);
                  if (item.id === "documento") {
                    const codigo = ensureDocumentoPrefix(normalizeCodigo(catalogForm.codigo));
                    setCatalogForm({ ...catalogForm, codigo });
                  }
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  catalogType === item.id
                    ? "bg-slate-900 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {catalogError && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {catalogError}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs font-semibold text-slate-600">Código do Sistema</label>
              <input
                value={catalogForm.codigo}
                onChange={(event) => {
                  const raw = event.target.value;
                  const normalized = normalizeCodigo(raw);
                  const codigo = catalogType === "documento" ? ensureDocumentoPrefix(normalized) : normalized;
                  setCatalogForm({ ...catalogForm, codigo });
                }}
                placeholder={catalogType === "documento" ? "DOC_DECLARACAO" : "SERV_TAXA"}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-mono outline-none focus:border-slate-400"
              />
              {catalogType === "documento" && (
                <p className="mt-1 text-[10px] text-slate-400">
                  Documentos oficiais usam o prefixo <strong>DOC_</strong> por convenção.
                </p>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600">Nome de Exibição</label>
              <input
                value={catalogForm.nome}
                onChange={(event) => {
                  const nome = event.target.value;
                  let codigo = catalogForm.codigo;
                  if (!catalogForm.id && nome.trim()) {
                    const slug = normalizeCodigo(nome.trim());
                    codigo = catalogType === "documento" ? ensureDocumentoPrefix(slug) : slug;
                  }
                  setCatalogForm({ ...catalogForm, nome, codigo });
                }}
                placeholder="Declaração de Frequência"
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium outline-none focus:border-slate-400"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600">Preço Base (Kz)</label>
              <input
                type="number"
                value={catalogForm.valor_base}
                onChange={(event) => setCatalogForm({ ...catalogForm, valor_base: Number(event.target.value) })}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-slate-400"
              />
              <label className="mt-2 flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Number(catalogForm.valor_base ?? 0) === 0}
                  onChange={(event) => {
                    if (event.target.checked) {
                      setCatalogForm({ ...catalogForm, valor_base: 0 });
                    }
                  }}
                  className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                />
                Serviço Isento / Gratuito (0 Kz)
              </label>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600">Status</label>
              <select
                value={catalogForm.ativo ? "ativo" : "inativo"}
                onChange={(event) => setCatalogForm({ ...catalogForm, ativo: event.target.value === "ativo" })}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 cursor-pointer"
              >
                <option value="ativo">Ativo (visível no balcão)</option>
                <option value="inativo">Inativo (oculto)</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-slate-600">Descrição / Observações</label>
              <textarea
                value={catalogForm.descricao ?? ""}
                onChange={(event) => setCatalogForm({ ...catalogForm, descricao: event.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                rows={2}
                placeholder="Descrição resumida do serviço ou finalidade do documento..."
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
            <span className="text-xs text-slate-400">
              {catalogLoading ? "A carregar..." : `${catalogItems.length} item(s) cadastrados no total`}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCatalogOpen(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveServico}
                disabled={catalogSaving}
                className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60 transition-colors shadow-sm"
              >
                {catalogSaving ? "A guardar..." : "Guardar Serviço"}
              </button>
            </div>
          </div>
        </div>
      </ModalShell>
    </ConfigSystemShell>
  );
}
