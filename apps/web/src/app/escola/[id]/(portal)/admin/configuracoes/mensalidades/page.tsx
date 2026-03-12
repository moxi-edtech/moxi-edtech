"use client";

import { useParams, usePathname } from "next/navigation";
import ConfigSystemShell from "@/components/escola/settings/ConfigSystemShell";
import { buildConfigMenuItems } from "../_shared/menuItems";
import PrecosClient from "@/app/escola/[id]/(portal)/financeiro/configuracoes/precos/PrecosClient";
import { ModalShell } from "@/components/ui/ModalShell";
import { useEffect, useState } from "react";
import { useToast } from "@/components/feedback/FeedbackSystem";
import { useEscolaId } from "@/hooks/useEscolaId";

type ServicoItem = {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  valor_base: number;
  ativo: boolean;
};

const DEFAULT_SERVICO: ServicoItem = {
  id: "",
  codigo: "",
  nome: "",
  descricao: "",
  valor_base: 0,
  ativo: true,
};

type CatalogType = "documento" | "servico";

export default function MensalidadesEmolumentosPage() {
  const params = useParams() as { id?: string };
  const escolaId = params?.id;
  const { escolaSlug } = useEscolaId();
  const escolaParam = escolaSlug || escolaId;
  const base = escolaParam ? `/escola/${escolaParam}/admin/configuracoes` : "";
  const { error, success } = useToast();
  const pathname = usePathname();
  const isStandalone = pathname?.includes("/admin/configuracoes/mensalidades");

  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogSaving, setCatalogSaving] = useState(false);
  const [catalogItems, setCatalogItems] = useState<ServicoItem[]>([]);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogForm, setCatalogForm] = useState<ServicoItem>(DEFAULT_SERVICO);
  const [catalogType, setCatalogType] = useState<CatalogType>("servico");

  useEffect(() => {
    if (!catalogOpen || !escolaParam) return;
    void loadCatalog();
  }, [catalogOpen, escolaParam]);

  const loadCatalog = async () => {
    if (!escolaParam) return;
    setCatalogLoading(true);
    setCatalogError(null);
    try {
      const res = await fetch(`/api/escola/${escolaParam}/admin/servicos`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Falha ao carregar serviços");
      setCatalogItems(Array.isArray(json.items) ? json.items : []);
    } catch (err) {
      setCatalogItems([]);
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
        body: JSON.stringify({
          id: catalogForm.id || null,
          codigo: catalogForm.codigo,
          nome: catalogForm.nome,
          descricao: catalogForm.descricao,
          valor_base: Number(catalogForm.valor_base ?? 0),
          ativo: Boolean(catalogForm.ativo),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok || !json?.item) {
        throw new Error(json?.error || "Falha ao salvar serviço");
      }

      setCatalogItems((prev) => {
        const index = prev.findIndex((item) => item.id === json.item.id);
        if (index >= 0) {
          const next = [...prev];
          next[index] = json.item;
          return next;
        }
        return [json.item, ...prev];
      });
      setCatalogForm(DEFAULT_SERVICO);
      success("Serviço salvo com sucesso.");
    } catch (err) {
      error(err instanceof Error ? err.message : "Erro ao salvar serviço");
    } finally {
      setCatalogSaving(false);
    }
  };

  if (!escolaParam) return null;

  return (
    <ConfigSystemShell
      escolaId={escolaParam}
      title="Mensalidades & Emolumentos"
      subtitle="Configure valores de mensalidades, matrículas e catálogo de serviços."
      menuItems={buildConfigMenuItems(base)}
      backHref={`/escola/${escolaParam}/admin`}
      embedded={!isStandalone}
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
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Catálogo de Serviços & Documentos</h3>
              <p className="text-xs text-slate-500">
                Cadastre serviços avulsos, declarações e documentos pagos/grátis.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setCatalogForm(DEFAULT_SERVICO);
                setCatalogType("servico");
                setCatalogOpen(true);
              }}
              className="rounded-lg bg-klasse-gold px-4 py-2 text-xs font-semibold text-white hover:brightness-95"
            >
              Gerenciar catálogo
            </button>
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
