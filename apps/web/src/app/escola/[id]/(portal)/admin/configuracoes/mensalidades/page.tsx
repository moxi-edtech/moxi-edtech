"use client";

import { useParams, usePathname } from "next/navigation";
import ConfigSystemShell from "@/components/escola/settings/ConfigSystemShell";
import { buildConfigMenuItems } from "../_shared/menuItems";
import PrecosClient from "@/app/escola/[id]/(portal)/financeiro/configuracoes/precos/PrecosClient";
import { ModalShell } from "@/components/ui/ModalShell";
import { useEffect, useState } from "react";
import { useToast } from "@/components/feedback/FeedbackSystem";
import { useEscolaId } from "@/hooks/useEscolaId";
import { buildContextualPortalHref } from "@/lib/navigation";
import {
  getServicoCategoria,
  SERVICOS_ESCOLA_PADRAO,
} from "@/lib/secretaria/servicos-catalogo-padrao";

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

export default function MensalidadesEmolumentosPage() {
  const params = useParams() as { id?: string };
  const escolaId = params?.id;
  const { escolaSlug } = useEscolaId();
  const escolaParam = escolaSlug || escolaId;
  const pathname = usePathname();
  const base = buildContextualPortalHref(escolaParam, "/admin/configuracoes", pathname);
  const { error, success } = useToast();
  const isStandalone = pathname?.includes("/admin/configuracoes/mensalidades");

  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogSaving, setCatalogSaving] = useState(false);
  const [catalogItems, setCatalogItems] = useState<ServicoItem[]>([]);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogForm, setCatalogForm] = useState<ServicoItem>(DEFAULT_SERVICO);
  const [catalogType, setCatalogType] = useState<CatalogType>("servico");
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});
  const [priceSavingId, setPriceSavingId] = useState<string | null>(null);
  const [installingDefaults, setInstallingDefaults] = useState(false);
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

  const sortedItems = [...catalogItems].sort((a, b) => {
    const categoryOrder = inferCatalogType(a.codigo).localeCompare(inferCatalogType(b.codigo));
    if (categoryOrder !== 0) return categoryOrder;
    return a.nome.localeCompare(b.nome, "pt");
  });
  const documentos = sortedItems.filter((item) => inferCatalogType(item.codigo) === "documento");
  const emolumentos = sortedItems.filter((item) => inferCatalogType(item.codigo) === "servico");
  const configuredCount = catalogItems.filter((item) => Number(item.valor_base ?? 0) > 0).length;
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
          ? `${json.inserted} serviço(s) pré-configurado(s).`
          : "Catálogo padrão já estava completo."
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
      success(valor === 0 ? "Serviço marcado como gratuito." : "Preço actualizado.");
    } catch (err) {
      error(err instanceof Error ? err.message : "Erro ao guardar preço");
    } finally {
      setPriceSavingId(null);
    }
  };

  const handleSaveServico = async () => {
    if (!escolaParam) return;
    if (!catalogForm.codigo.trim() || !catalogForm.nome.trim()) {
      error("Código e nome são obrigatórios.");
      return;
    }
    if (catalogType === "documento" && !catalogForm.codigo.startsWith("DOC_")) {
      error("Documentos devem usar prefixo DOC_.");
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
        throw new Error(json?.error || "Falha ao salvar serviço");
      }

      upsertCatalogItem(json.item);
      setCatalogForm(DEFAULT_SERVICO);
      success("Serviço salvo com sucesso.");
    } catch (err) {
      error(err instanceof Error ? err.message : "Erro ao salvar serviço");
    } finally {
      setCatalogSaving(false);
    }
  };

  const renderServicoRows = (items: ServicoItem[], emptyLabel: string) => (
    <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
      {items.length === 0 ? (
        <div className="bg-slate-50 px-4 py-5 text-sm text-slate-500">{emptyLabel}</div>
      ) : (
        items.map((item) => {
          const value = priceDrafts[item.id] ?? String(Number(item.valor_base ?? 0));
          const dirty = Number(value || 0) !== Number(item.valor_base ?? 0);
          return (
            <div key={item.id} className="grid gap-3 bg-white px-4 py-4 md:grid-cols-[1fr_160px_180px] md:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-slate-900">{item.nome}</p>
                  {Number(item.valor_base ?? 0) === 0 ? (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                      Gratuito
                    </span>
                  ) : null}
                  {!item.ativo ? (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                      Inativo
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-slate-500">{item.descricao || item.codigo}</p>
                <button
                  type="button"
                  onClick={() => {
                    setCatalogForm(item);
                    setCatalogType(inferCatalogType(item.codigo));
                    setCatalogOpen(true);
                  }}
                  className="mt-2 text-xs font-semibold text-klasse-gold hover:underline"
                >
                  Editar detalhes
                </button>
              </div>
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Preço</span>
                <div className="mt-1 flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <input
                    type="number"
                    min={0}
                    value={value}
                    onChange={(event) =>
                      setPriceDrafts((prev) => ({ ...prev, [item.id]: event.target.value }))
                    }
                    className="w-full bg-transparent text-sm font-semibold text-slate-900 outline-none"
                  />
                  <span className="ml-2 text-xs font-semibold text-slate-400">Kz</span>
                </div>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleSavePrice(item)}
                  disabled={!dirty || priceSavingId === item.id}
                  className="h-10 rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
                >
                  {priceSavingId === item.id ? "A guardar..." : "Guardar"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPriceDrafts((prev) => ({ ...prev, [item.id]: "0" }));
                    void handleSavePrice(item, 0);
                  }}
                  disabled={Number(item.valor_base ?? 0) === 0 || priceSavingId === item.id}
                  className="h-10 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400"
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
      subtitle="Configure valores de mensalidades, matrículas e catálogo de serviços."
      menuItems={buildConfigMenuItems(base)}
      backHref={buildContextualPortalHref(escolaParam, "/admin", pathname)}
      embedded={!isStandalone}
      showInternalMenu={false}
    >
      <div className="space-y-6">
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-6 py-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Tabela de Preços</h3>
              <p className="text-xs text-slate-500">Defina propinas e matrículas por curso/classe.</p>
            </div>
          </div>
          <div className="p-6">
            <PrecosClient escolaId={escolaParam} embedded showDueDate={false} />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Catálogo de Serviços & Documentos</h3>
              <p className="text-xs text-slate-500">
                Serviços pré-configurados para a escola informar apenas os preços.
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold text-slate-500">
                <span className="rounded-full bg-slate-100 px-2.5 py-1">{catalogItems.length} serviço(s)</span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1">{configuredCount} com preço</span>
                {missingDefaultCount > 0 ? (
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700">
                    {missingDefaultCount} padrão em falta
                  </span>
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleInstallDefaults}
                disabled={installingDefaults}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                {installingDefaults ? "A preparar..." : "Pré-configurar serviços"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCatalogForm(DEFAULT_SERVICO);
                  setCatalogType("servico");
                  setCatalogOpen(true);
                }}
                className="rounded-lg bg-klasse-gold px-4 py-2 text-xs font-semibold text-white hover:brightness-95"
              >
                Novo serviço
              </button>
            </div>
          </div>

          {catalogError ? (
            <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {catalogError}
            </div>
          ) : null}

          <div className="mt-5 grid gap-5 xl:grid-cols-2">
            <section>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">Documentos</h4>
                <span className="text-xs text-slate-400">{documentos.length} item(s)</span>
              </div>
              {catalogLoading
                ? renderServicoRows([], "A carregar documentos...")
                : renderServicoRows(documentos, "Nenhum documento configurado.")}
            </section>
            <section>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">Emolumentos</h4>
                <span className="text-xs text-slate-400">{emolumentos.length} item(s)</span>
              </div>
              {catalogLoading
                ? renderServicoRows([], "A carregar emolumentos...")
                : renderServicoRows(emolumentos, "Nenhum emolumento configurado.")}
            </section>
          </div>
        </div>
      </div>

      <ModalShell
        open={catalogOpen}
        title="Catálogo de Serviços"
        description="Defina o que pode ser cobrado ou emitido no balcão."
        onClose={() => setCatalogOpen(false)}
      >
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-semibold text-slate-600">Tipo de item</span>
            {([
              { id: "servico", label: "Serviço" },
              { id: "documento", label: "Documento" },
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
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                  catalogType === item.id
                    ? "bg-klasse-gold text-white"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {catalogError && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              {catalogError}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs font-semibold text-slate-600">Código</label>
              <input
                value={catalogForm.codigo}
                onChange={(event) => {
                  const raw = event.target.value;
                  const normalized = normalizeCodigo(raw);
                  const codigo = catalogType === "documento" ? ensureDocumentoPrefix(normalized) : normalized;
                  setCatalogForm({ ...catalogForm, codigo });
                }}
                placeholder={catalogType === "documento" ? "DOC_DECLARACAO" : "SERVICO_AVULSO"}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              />
              {catalogType === "documento" ? (
                <p className="mt-1 text-[10px] text-slate-400">
                  Recomendado usar prefixo <strong>DOC_</strong> para documentos.
                </p>
              ) : null}
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">Nome</label>
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
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">Preço (Kz)</label>
              <input
                type="number"
                value={catalogForm.valor_base}
                onChange={(event) => setCatalogForm({ ...catalogForm, valor_base: Number(event.target.value) })}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              />
              <label className="mt-2 flex items-center gap-2 text-xs font-semibold text-slate-600">
                <input
                  type="checkbox"
                  checked={Number(catalogForm.valor_base ?? 0) === 0}
                  onChange={(event) => {
                    if (event.target.checked) {
                      setCatalogForm({ ...catalogForm, valor_base: 0 });
                    }
                  }}
                  className="h-4 w-4 rounded border-slate-300 text-klasse-gold"
                />
                Serviço gratuito
              </label>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">Status</label>
              <select
                value={catalogForm.ativo ? "ativo" : "inativo"}
                onChange={(event) => setCatalogForm({ ...catalogForm, ativo: event.target.value === "ativo" })}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-slate-600">Descrição</label>
              <textarea
                value={catalogForm.descricao ?? ""}
                onChange={(event) => setCatalogForm({ ...catalogForm, descricao: event.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                rows={2}
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-xs text-slate-400">
              {catalogLoading ? "Carregando catálogo..." : `${catalogItems.length} item(s) cadastrados`}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCatalogOpen(false)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={handleSaveServico}
                disabled={catalogSaving}
                className="rounded-lg bg-klasse-gold px-3 py-2 text-xs font-semibold text-white hover:brightness-95 disabled:opacity-60"
              >
                {catalogSaving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      </ModalShell>
    </ConfigSystemShell>
  );
}
