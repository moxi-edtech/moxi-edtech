"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye } from "lucide-react";
import { useToast } from "@/components/feedback/FeedbackSystem";
import ReciboPagamentoCompacto from "@/components/financeiro/ReciboPagamentoCompacto";

type ReciboImprimivelProps = {
  escolaNome: string;
  alunoNome: string;
  valor: number;
  data: string;
  urlValidacao: string | null;
  alunoBi?: string;
  classeNome?: string;
  cursoNome?: string;
  turmaNome?: string;
  referencia?: string;
  metodo?: string;
  numero?: string | null;
  publicId?: string;
  logoUrl?: string | null;
  emitidoEm?: string | null;
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
  alunoBi = "—",
  classeNome = "—",
  cursoNome = "",
  turmaNome = "—",
  referencia = "Mensalidade",
  metodo = "—",
  numero = null,
  publicId = "—",
  logoUrl = null,
  emitidoEm = null,
}: ReciboImprimivelProps) {
  const dataFormatada = useMemo(() => {
    if (!data) return "—";
    const parsed = new Date(data);
    if (Number.isNaN(parsed.getTime())) return data;
    return parsed.toLocaleDateString("pt-PT");
  }, [data]);

  return (
    <div className="hidden print:block">
      <div className="w-full max-w-none bg-white text-slate-900">
        <ReciboPagamentoCompacto
          escolaNome={escolaNome}
          alunoNome={alunoNome}
          alunoBi={alunoBi}
          classeNome={classeNome}
          cursoNome={cursoNome}
          turmaNome={turmaNome}
          referencia={referencia}
          metodo={metodo}
          valorPago={valor}
          dataPagamento={dataFormatada}
          numero={numero}
          publicId={publicId}
          urlValidacao={urlValidacao}
          logoUrl={logoUrl}
          emitidoEm={emitidoEm ?? dataFormatada}
        />
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
  const { error } = useToast();
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
    } catch (_err) {
      error("Erro na emissão", "Não conseguimos gerar o recibo para impressão no momento. Por favor, tente novamente.");
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
          publicId={recibo.doc_id}
        />
      ) : null}
    </div>
  );
}
