"use client";

import { FormEvent, useMemo, useState } from "react";
import { Loader2, Plus, X } from "lucide-react";

import { useToast } from "@/components/feedback/FeedbackSystem";
import type { EmissaoPayload, FiscalDoc, TipoDocumento } from "@/components/fiscal/types";

type FiscalEmissaoModalProps = {
  onClose: () => void;
  onCreated?: (doc: FiscalDoc) => void;
};

type ApiResponse = {
  ok?: boolean;
  data?: {
    documento_id?: string;
    numero?: number;
    numero_formatado?: string;
    hash_control?: string;
    key_version?: number;
    pdf_url?: string;
    created_at?: string;
  };
  error?: {
    code?: string;
    message?: string;
  };
};

type ItemState = {
  descricao: string;
  valor: string;
};

function defaultItem(): ItemState {
  return { descricao: "", valor: "" };
}

export function FiscalEmissaoModal({ onClose, onCreated }: FiscalEmissaoModalProps) {
  const currentYear = new Date().getUTCFullYear();
  const [tipoDocumento, setTipoDocumento] = useState<TipoDocumento>("FT");
  const [anoFiscal, setAnoFiscal] = useState<number>(currentYear);
  const [clienteNome, setClienteNome] = useState("");
  const [itens, setItens] = useState<ItemState[]>([defaultItem()]);
  const [loading, setLoading] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const { success, warning, error } = useToast();

  const formInvalid = useMemo(() => {
    if (clienteNome.trim().length < 2) return true;
    if (anoFiscal < 2024) return true;
    if (itens.length === 0) return true;
    return itens.some((item) => item.descricao.trim().length < 2 || Number(item.valor) <= 0);
  }, [anoFiscal, clienteNome, itens]);

  const updateItem = (index: number, patch: Partial<ItemState>) => {
    setItens((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const removeItem = (index: number) => {
    setItens((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading || formInvalid) return;

    const payload: EmissaoPayload = {
      ano_fiscal: anoFiscal,
      tipo_documento: tipoDocumento,
      cliente_nome: clienteNome.trim(),
      itens: itens.map((item) => ({
        descricao: item.descricao.trim(),
        valor: Number(item.valor),
      })),
    };

    setLoading(true);
    try {
      const response = await fetch("/api/fiscal/documentos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = (await response.json().catch(() => ({}))) as ApiResponse;

      if (response.status === 409) {
        const code = json.error?.code ?? "";
        if (code === "CHAVE_FISCAL_INDISPONIVEL" || code === "SERIE_NAO_ENCONTRADA") {
          warning(
            "Atenção: A configuração fiscal para este ano ainda não foi aberta ou a chave expirou. Contacte o Administrador Global."
          );
          return;
        }
        warning("Conflito fiscal", json.error?.message ?? "Não foi possível concluir a emissão.");
        return;
      }

      if (response.status >= 500) {
        error("Erro interno. Tente novamente.");
        return;
      }

      if (response.ok === false || json.ok !== true || json.data === undefined) {
        error("Falha na emissão", json.error?.message ?? "Não foi possível emitir o documento.");
        return;
      }

      const numeroFormatado = json.data.numero_formatado ?? `${tipoDocumento} ${anoFiscal}/----`;
      success(`${numeroFormatado} emitida com sucesso`);

      onCreated?.({
        id: json.data.documento_id ?? crypto.randomUUID(),
        numero: numeroFormatado,
        emitido_em: json.data.created_at ?? new Date().toISOString(),
        cliente_nome: clienteNome.trim(),
        total_aoa: payload.itens.reduce((sum, item) => sum + item.valor, 0),
        hash_control: json.data.hash_control ?? "",
        key_version: String(json.data.key_version ?? "1"),
        status: "EMITIDO",
      });

      onClose();

      if (typeof json.data.pdf_url === "string" && json.data.pdf_url.length > 0) {
        setPdfUrl(json.data.pdf_url);
      }
    } catch {
      error("Erro interno. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
        <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-sora text-lg font-semibold text-slate-900">Nova Emissão Fiscal</h3>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm text-slate-700">
                <span className="font-medium">Tipo de Documento</span>
                <select
                  value={tipoDocumento}
                  onChange={(event) => setTipoDocumento(event.target.value as TipoDocumento)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none focus:border-[#1F6B3B] focus:ring-2 focus:ring-[#1F6B3B]/20"
                >
                  <option value="FT">FT (Factura)</option>
                  <option value="FR">FR (Factura-Recibo)</option>
                </select>
              </label>

              <label className="space-y-1 text-sm text-slate-700">
                <span className="font-medium">Ano Fiscal</span>
                <input
                  type="number"
                  min={2024}
                  value={anoFiscal}
                  onChange={(event) => setAnoFiscal(Number(event.target.value))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none focus:border-[#1F6B3B] focus:ring-2 focus:ring-[#1F6B3B]/20"
                />
              </label>
            </div>

            <label className="block space-y-1 text-sm text-slate-700">
              <span className="font-medium">Cliente</span>
              <input
                type="text"
                value={clienteNome}
                onChange={(event) => setClienteNome(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none focus:border-[#1F6B3B] focus:ring-2 focus:ring-[#1F6B3B]/20"
                placeholder="Nome do cliente"
              />
            </label>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">Itens</span>
                <button
                  type="button"
                  onClick={() => setItens((prev) => [...prev, defaultItem()])}
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  <Plus className="h-3.5 w-3.5" /> Adicionar item
                </button>
              </div>

              <div className="space-y-2">
                {itens.map((item, index) => (
                  <div key={`${index}-${item.descricao}`} className="grid gap-2 sm:grid-cols-[1fr_180px_42px]">
                    <input
                      type="text"
                      value={item.descricao}
                      onChange={(event) => updateItem(index, { descricao: event.target.value })}
                      placeholder="Descrição"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#1F6B3B] focus:ring-2 focus:ring-[#1F6B3B]/20"
                    />
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={item.valor}
                      onChange={(event) => updateItem(index, { valor: event.target.value })}
                      placeholder="Valor AOA"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#1F6B3B] focus:ring-2 focus:ring-[#1F6B3B]/20"
                    />
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="rounded-xl border border-slate-200 text-slate-500 transition hover:bg-red-50 hover:text-red-600"
                      title="Remover item"
                      aria-label="Remover item"
                    >
                      <X className="mx-auto h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={formInvalid || loading}
                className="inline-flex items-center gap-2 rounded-xl bg-[#1F6B3B] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#18542e] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {loading ? "A emitir..." : "Pagar e Emitir Fiscal"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {pdfUrl ? (
        <div className="fixed inset-0 z-50 bg-black/90">
          <button
            type="button"
            onClick={() => setPdfUrl(null)}
            className="absolute right-4 top-4 rounded-xl border border-white/20 bg-black/40 p-2 text-white hover:bg-black/60"
            aria-label="Fechar visualizador PDF"
          >
            <X className="h-5 w-5" />
          </button>
          <iframe title="Fiscal PDF Viewer" src={pdfUrl} className="h-full w-full" />
        </div>
      ) : null}
    </>
  );
}
