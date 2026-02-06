"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { 
  Wallet, 
  CalendarClock, 
  Percent, 
  AlertTriangle, 
  Landmark, 
  Lock, 
  ExternalLink 
} from "lucide-react";
import ConfigSystemShell from "@/components/escola/settings/ConfigSystemShell";
import { buildConfigMenuItems } from "../_shared/menuItems";
import { ModalShell } from "@/components/ui/ModalShell";

// --- TYPES ---
type FinanceiroConfig = {
  dia_vencimento_padrao: number;
  multa_atraso_percent: number;
  juros_diarios_percent: number;
  bloquear_inadimplentes: boolean;
  moeda: string;
};

type ServicoItem = {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  valor_base: number;
  ativo: boolean;
};

const DEFAULT_CONFIG: FinanceiroConfig = {
  dia_vencimento_padrao: 5,
  multa_atraso_percent: 10, // Comum em Angola
  juros_diarios_percent: 0.5,
  bloquear_inadimplentes: false,
  moeda: "AOA",
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

export default function FinanceiroConfiguracoesPage() {
  const params = useParams() as { id?: string };
  const escolaId = params?.id;
  const base = escolaId ? `/escola/${escolaId}/admin/configuracoes` : "";
  
  const menuItems = buildConfigMenuItems(base);

  // --- STATE ---
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<FinanceiroConfig>(DEFAULT_CONFIG);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogSaving, setCatalogSaving] = useState(false);
  const [catalogItems, setCatalogItems] = useState<ServicoItem[]>([]);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogForm, setCatalogForm] = useState<ServicoItem>(DEFAULT_SERVICO);
  const [catalogType, setCatalogType] = useState<CatalogType>("servico");

  // --- FETCH ---
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!escolaId) return;
      try {
        const res = await fetch(`/api/escola/${escolaId}/admin/configuracoes/financeiro`, {
          cache: "no-store",
        });
        const json = await res.json().catch(() => null);
        
        if (cancelled) return;

        if (!res.ok) {
          if (res.status === 404) {
            setLoading(false);
            return;
          }
          throw new Error(json?.error || "Falha ao carregar financeiro");
        }

        if (json?.data) setConfig(json.data);
      } catch (error) {
        console.error("Erro ao carregar financeiro", error);
        // Mantém default silenciosamente ou avisa
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [escolaId]);

  // --- HANDLERS ---
  const handleSave = async () => {
    if (!escolaId) return;
    setSaving(true);
    
    const promise = fetch(`/api/escola/${escolaId}/admin/configuracoes/financeiro`, {
      method: "POST", // Ou PUT/PATCH dependendo da sua API
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    }).then(async (res) => {
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const detail = json?.error || (res.status === 404
          ? "Endpoint financeiro indisponível."
          : "Falha ao salvar");
        throw new Error(detail);
      }
      
      // Commit do setup step
      await fetch(`/api/escola/${escolaId}/admin/setup/commit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changes: { financeiro: true } }),
      });
    });

    toast.promise(promise, {
      loading: 'Aplicando regras financeiras...',
      success: 'Política financeira atualizada!',
      error: 'Erro ao salvar regras.'
    });

    try { await promise; } finally { setSaving(false); }
  };

  const loadCatalog = async () => {
    if (!escolaId) return;
    setCatalogLoading(true);
    setCatalogError(null);
    try {
      const res = await fetch(`/api/escola/${escolaId}/admin/servicos`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Falha ao carregar serviços");
      }
      setCatalogItems(Array.isArray(json.items) ? json.items : []);
    } catch (error) {
      console.error("Erro ao carregar serviços", error);
      setCatalogItems([]);
      setCatalogError(error instanceof Error ? error.message : "Erro ao carregar serviços");
    } finally {
      setCatalogLoading(false);
    }
  };

  const handleOpenCatalog = () => {
    setCatalogOpen(true);
    setCatalogForm(DEFAULT_SERVICO);
    setCatalogType("servico");
  };

  const normalizeCodigo = (value: string) => value.replace(/\s+/g, "_").toUpperCase();

  const ensureDocumentoPrefix = (value: string) => {
    if (!value) return "DOC_";
    return value.startsWith("DOC_") ? value : `DOC_${value}`;
  };

  const handleSaveServico = async () => {
    if (!escolaId) return;
    if (!catalogForm.codigo.trim() || !catalogForm.nome.trim()) {
      toast.error("Código e nome são obrigatórios.");
      return;
    }
    if (catalogType === "documento" && !catalogForm.codigo.startsWith("DOC_")) {
      toast.error("Documentos devem usar prefixo DOC_.");
      return;
    }
    setCatalogSaving(true);
    try {
      const res = await fetch(`/api/escola/${escolaId}/admin/servicos`, {
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
      toast.success("Serviço salvo com sucesso.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao salvar serviço";
      toast.error(message);
    } finally {
      setCatalogSaving(false);
    }
  };

  useEffect(() => {
    if (!catalogOpen) return;
    void loadCatalog();
  }, [catalogOpen]);

  return (
    <ConfigSystemShell
      escolaId={escolaId ?? ""}
      title="Financeiro · Políticas de Cobrança"
      subtitle="Defina as regras globais de pagamentos, multas e restrições."
      menuItems={menuItems}
      embedded
      backHref={`${base}?tab=financeiro`}
      prevHref={`${base}/turmas`}
      nextHref={`${base}/fluxos`}
      testHref={`${base}/sandbox`}
      onSave={handleSave}
      saveDisabled={saving}
    >
      {loading ? (
         <div className="py-12 text-center text-sm text-slate-500">Carregando dados financeiros...</div>
      ) : (
        <div className="space-y-6">
          
          {/* CARD 1: REGRAS GERAIS */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-6 border-b border-slate-100 pb-4">
              <div className="rounded-lg bg-emerald-100 p-2 text-emerald-700">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Regras de Cobrança</h3>
                <p className="text-xs text-slate-500">Padrões aplicados a todas as mensalidades.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Dia de Vencimento */}
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                  <CalendarClock className="h-3.5 w-3.5 text-slate-400" />
                  Dia de Vencimento Padrão
                </label>
                <select
                  value={config.dia_vencimento_padrao}
                  onChange={(e) => setConfig({ ...config, dia_vencimento_padrao: Number(e.target.value) })}
                  className="w-full rounded-lg border-slate-200 bg-slate-50 text-sm font-medium text-slate-900 focus:border-klasse-gold focus:ring-klasse-gold"
                >
                  {[1, 5, 10, 15, 20, 25, 30].map(d => (
                    <option key={d} value={d}>Dia {d}</option>
                  ))}
                </select>
                <p className="mt-1.5 text-[10px] text-slate-400">
                  Data limite padrão para evitar multas.
                </p>
              </div>

              {/* Multa Fixa */}
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                  <AlertTriangle className="h-3.5 w-3.5 text-slate-400" />
                  Multa por Atraso (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={config.multa_atraso_percent}
                    onChange={(e) => setConfig({ ...config, multa_atraso_percent: Number(e.target.value) })}
                    className="w-full rounded-lg border-slate-200 pl-3 pr-8 text-sm font-semibold text-slate-900 focus:border-klasse-gold focus:ring-klasse-gold"
                  />
                  <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">%</span>
                </div>
                <p className="mt-1.5 text-[10px] text-slate-400">
                  Aplicada uma única vez após o vencimento.
                </p>
              </div>

              {/* Juros Diários */}
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                  <Percent className="h-3.5 w-3.5 text-slate-400" />
                  Juros Diários (Mora)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    value={config.juros_diarios_percent}
                    onChange={(e) => setConfig({ ...config, juros_diarios_percent: Number(e.target.value) })}
                    className="w-full rounded-lg border-slate-200 pl-3 pr-8 text-sm font-semibold text-slate-900 focus:border-klasse-gold focus:ring-klasse-gold"
                  />
                  <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">%</span>
                </div>
                <p className="mt-1.5 text-[10px] text-slate-400">
                  Acumulado a cada dia de atraso.
                </p>
              </div>
            </div>
          </div>

          {/* CARD 2: POLÍTICA DE INADIMPLÊNCIA */}
          <div className="rounded-xl border border-red-100 bg-red-50/30 p-6">
            <div className="flex items-start gap-4">
              <div className="rounded-full bg-red-100 p-2 text-red-600">
                <Lock className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900">Restrição Automática</h3>
                  
                  {/* Toggle Switch */}
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input 
                      type="checkbox" 
                      className="peer sr-only"
                      checked={config.bloquear_inadimplentes}
                      onChange={(e) => setConfig({ ...config, bloquear_inadimplentes: e.target.checked })}
                    />
                    <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-red-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-red-300"></div>
                  </label>
                </div>
                
                <p className="mt-1 text-xs text-slate-600">
                  Se ativado, alunos com mensalidades vencidas há mais de 30 dias terão o acesso ao Portal do Aluno bloqueado automaticamente.
                </p>
                {config.bloquear_inadimplentes && (
                  <div className="mt-3 inline-flex items-center gap-2 rounded-md bg-red-100 px-3 py-1.5 text-xs font-medium text-red-800">
                    <AlertTriangle className="h-3 w-3" />
                    Modo rigoroso ativado. Certifique-se que isso está no contrato.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Catálogo de Serviços e Documentos</h3>
                <p className="text-xs text-slate-500">
                  Cadastre serviços avulsos, declarações e documentos pagos/grátis.
                </p>
              </div>
              <button
                type="button"
                onClick={handleOpenCatalog}
                className="rounded-lg bg-klasse-gold px-4 py-2 text-xs font-semibold text-white hover:brightness-95"
              >
                Gerenciar catálogo
              </button>
            </div>
          </div>

          {/* CARD 3: CTA PARA TABELA DE PREÇOS */}
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-6">
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-white p-2 shadow-sm ring-1 ring-slate-100 text-slate-600">
                <Landmark className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Tabela de Preços & Contas</h3>
                <p className="text-xs text-slate-500">
                  Gerencie o valor das propinas por classe e contas bancárias.
                </p>
              </div>
            </div>
            
            <Link
              href={escolaId ? `/escola/${escolaId}/financeiro/configuracoes` : "#"}
              className="group inline-flex items-center gap-2 rounded-lg bg-white border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:text-slate-900"
            >
              Abrir Gestão Financeira Completa
              <ExternalLink className="h-3 w-3 text-slate-400 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>

        </div>
      )}
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

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setCatalogForm(DEFAULT_SERVICO)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Limpar
            </button>
            <button
              type="button"
              onClick={handleSaveServico}
              disabled={catalogSaving}
              className="rounded-lg bg-klasse-gold px-4 py-2 text-xs font-semibold text-white hover:brightness-95 disabled:opacity-70"
            >
              Salvar serviço
            </button>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-slate-500">Serviços cadastrados</h4>
              <button
                type="button"
                onClick={loadCatalog}
                className="text-[10px] font-semibold text-slate-500 hover:text-slate-700"
              >
                Atualizar
              </button>
            </div>
            {catalogLoading ? (
              <div className="text-sm text-slate-500">Carregando serviços...</div>
            ) : catalogError ? (
              <div className="text-sm text-rose-600">{catalogError}</div>
            ) : catalogItems.length === 0 ? (
              <div className="text-sm text-slate-500">Nenhum serviço cadastrado.</div>
            ) : (
              <div className="space-y-2">
                {catalogItems.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => setCatalogForm(item)}
                    className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 text-left text-sm hover:border-slate-300"
                  >
                    <div>
                      <div className="font-semibold text-slate-900">{item.nome}</div>
                      <div className="text-xs text-slate-500">{item.codigo}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-semibold text-slate-600">{item.valor_base} Kz</div>
                      <div className="text-[10px] text-slate-400">{item.ativo ? "Ativo" : "Inativo"}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </ModalShell>
    </ConfigSystemShell>
  );
}
