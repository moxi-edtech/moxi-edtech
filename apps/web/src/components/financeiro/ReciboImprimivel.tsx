"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "react-qr-code";
import { Eye } from "lucide-react";

const formatKz = (valor: number) =>
  new Intl.NumberFormat("pt-AO", { style: "currency", currency: "AOA" }).format(
    valor || 0
  );

type ReciboImprimivelProps = {
  escolaNome: string;
  alunoNome: string;
  valor: number;
  data: string;
  urlValidacao: string | null;
};

type ReciboPayload = {
  doc_id: string;
  url_validacao: string | null;
};

export function ReciboImprimivel({
  escolaNome,
  alunoNome,
  valor,
  data,
  urlValidacao,
}: ReciboImprimivelProps) {
  const dataFormatada = useMemo(() => {
    if (!data) return "—";
    const parsed = new Date(data);
    if (Number.isNaN(parsed.getTime())) return data;
    return parsed.toLocaleDateString("pt-PT");
  }, [data]);

  return (
    <div className="hidden print:block print:p-10">
      <div className="w-[210mm] min-h-[297mm] bg-white text-slate-900 text-sm">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-400">Recibo</p>
            <h1 className="text-2xl font-semibold text-slate-900">{escolaNome}</h1>
            <p className="mt-1 text-slate-500">Comprovativo oficial de pagamento</p>
          </div>
          <div className="flex flex-col items-center gap-2 text-xs text-slate-500">
            {urlValidacao ? (
              <QRCode value={urlValidacao} size={96} className="h-24 w-24" />
            ) : (
              <div className="h-24 w-24 rounded-xl border border-dashed border-slate-200 flex items-center justify-center text-[11px] text-slate-400">
                QR indisponível
              </div>
            )}
            <span>Validar Autenticidade</span>
          </div>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wider text-slate-400">Aluno</p>
            <p className="text-lg font-semibold text-slate-900">{alunoNome}</p>
          </div>
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wider text-slate-400">Data</p>
            <p className="text-lg font-semibold text-slate-900">{dataFormatada}</p>
          </div>
        </div>

        <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-6">
          <p className="text-xs uppercase tracking-wider text-slate-400">Valor Recebido</p>
          <p className="mt-2 text-3xl font-semibold text-klasse-gold">
            {formatKz(valor)}
          </p>
        </div>

        <div className="mt-12 space-y-2 text-slate-500">
          <p>
            Confirmamos o recebimento do valor acima referente à mensalidade do aluno.
          </p>
          <p className="text-xs">
            Este recibo possui autenticidade verificada via QR Code.
          </p>
        </div>

        <div className="mt-16 flex items-center justify-between text-xs text-slate-400">
          <span>Emitido eletronicamente pela secretaria.</span>
          {urlValidacao ? <span>{urlValidacao}</span> : <span>URL não configurada</span>}
        </div>
      </div>
    </div>
  );
}

export function ReciboPrintButton({
  mensalidadeId,
  escolaNome,
  alunoNome,
  valor,
  dataPagamento,
}: {
  mensalidadeId: string;
  escolaNome: string;
  alunoNome: string;
  valor: number;
  dataPagamento: string;
}) {
  const [loading, setLoading] = useState(false);
  const [recibo, setRecibo] = useState<ReciboPayload | null>(null);
  const [printRequested, setPrintRequested] = useState(false);

  useEffect(() => {
    if (!printRequested || !recibo) return;
    const id = window.setTimeout(() => {
      window.print();
      setPrintRequested(false);
    }, 300);

    return () => window.clearTimeout(id);
  }, [printRequested, recibo]);

  async function handlePrint() {
    setLoading(true);
    try {
      const res = await fetch("/api/financeiro/recibos/emitir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensalidadeId }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Falha ao emitir recibo");
      }

      setRecibo({
        doc_id: json.doc_id,
        url_validacao: json.url_validacao ?? null,
      });
      setPrintRequested(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      alert(`Erro ao imprimir recibo: ${message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-end">
      <button
        type="button"
        onClick={handlePrint}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-xl bg-klasse-gold px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:brightness-95 focus:outline-none focus:ring-4 focus:ring-klasse-gold/20 disabled:opacity-60"
      >
        <Eye className="h-4 w-4" />
        <span>{loading ? "Emitindo..." : "Recibo"}</span>
      </button>

      {recibo ? (
        <ReciboImprimivel
          escolaNome={escolaNome}
          alunoNome={alunoNome}
          valor={valor}
          data={dataPagamento}
          urlValidacao={recibo.url_validacao}
        />
      ) : null}
    </div>
  );
}
