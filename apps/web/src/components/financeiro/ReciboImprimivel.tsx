"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import QRCode from "react-qr-code";
import { Printer, Loader2, Check } from "lucide-react";
import { useToast } from "@/components/feedback/FeedbackSystem";

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

  const renderVia = (tipo: "Secretaria" | "Aluno") => (
    <div className="flex flex-col h-[140mm] justify-between py-8">
      <div>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-slate-400">Recibo — Via do {tipo}</p>
            <h1 className="text-xl font-semibold text-slate-900">{escolaNome}</h1>
            <p className="mt-1 text-xs text-slate-500">Comprovativo oficial de pagamento</p>
          </div>
          <div className="flex flex-col items-center gap-1 text-[10px] text-slate-500">
            {urlValidacao ? (
              <QRCode value={urlValidacao} size={64} className="h-16 w-16" />
            ) : (
              <div className="h-16 w-16 rounded-lg border border-dashed border-slate-200 flex items-center justify-center text-[9px] text-slate-400 text-center">
                QR indisponível
              </div>
            )}
            <span>Validar Autenticidade</span>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-slate-400">Aluno</p>
            <p className="text-base font-semibold text-slate-900">{alunoNome}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-slate-400">Data</p>
            <p className="text-base font-semibold text-slate-900">{dataFormatada}</p>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400">Valor Recebido</p>
          <p className="mt-1 text-2xl font-semibold text-klasse-gold">
            {formatKz(valor)}
          </p>
        </div>

        <div className="mt-8 space-y-1 text-slate-500 text-xs">
          <p>
            Confirmamos o recebimento do valor acima referente à mensalidade do aluno.
          </p>
          <p className="text-[10px]">
            Este recibo possui autenticidade verificada via QR Code.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-100 pt-4">
        <span>Emitido eletronicamente pela secretaria.</span>
        {urlValidacao ? <span className="max-w-[150px] truncate">{urlValidacao}</span> : <span>URL não configurada</span>}
      </div>
    </div>
  );

  return (
    <div className="hidden print:block">
      <style dangerouslySetInnerHTML={{ __html: `
        @page {
          size: A4;
          margin: 0;
        }
        @media print {
          body {
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact;
          }
          .print-page {
            width: 210mm;
            height: 297mm;
            padding: 10mm 15mm;
            margin: 0 auto;
            background: white;
            display: flex;
            flex-direction: column;
            box-sizing: border-box;
            page-break-after: always;
          }
          .tear-line {
            border-top: 1px dashed #cbd5e1;
            position: relative;
            margin: 0 -15mm;
          }
          .tear-line::after {
            content: "✂ Cortar aqui";
            position: absolute;
            top: -10px;
            right: 15mm;
            background: white;
            padding: 0 10px;
            font-size: 9px;
            color: #94a3b8;
          }
        }
      `}} />
      <div className="print-page">
        {renderVia("Aluno")}
        <div className="tear-line" />
        {renderVia("Secretaria")}
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
  const [status, setStatus] = useState<"idle" | "loading" | "preparing" | "success">("idle");
  const [recibo, setRecibo] = useState<ReciboPayload | null>(null);

  useEffect(() => {
    if (status !== "preparing" || !recibo) return;
    
    const id = window.setTimeout(() => {
      window.print();
      setStatus("success");
      window.setTimeout(() => setStatus("idle"), 2000);
    }, 800);

    return () => window.clearTimeout(id);
  }, [status, recibo]);

  async function handlePrint() {
    setStatus("loading");
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
      setStatus("preparing");
    } catch (err) {
      setStatus("idle");
      error("Erro na emissão", "Não conseguimos gerar o recibo para impressão no momento.");
    }
  }

  return (
    <div className="flex items-center justify-end">
      <motion.button
        type="button"
        onClick={handlePrint}
        disabled={status !== "idle"}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className={`
          relative inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition-colors
          ${status === "success" 
            ? "bg-green-500 text-white" 
            : "bg-klasse-gold text-white hover:brightness-95"}
          disabled:opacity-80
        `}
      >
        <AnimatePresence mode="wait">
          {status === "loading" ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0, rotate: -180 }}
              animate={{ opacity: 1, rotate: 0 }}
              exit={{ opacity: 0, rotate: 180 }}
            >
              <Loader2 className="h-4 w-4 animate-spin" />
            </motion.div>
          ) : status === "success" ? (
            <motion.div
              key="success"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ opacity: 0 }}
            >
              <Check className="h-4 w-4" />
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Printer className="h-4 w-4" />
            </motion.div>
          )}
        </AnimatePresence>
        
        <span>
          {status === "loading" && "Gerando..."}
          {status === "preparing" && "Pronto!"}
          {status === "success" && "Impresso"}
          {status === "idle" && "Recibo"}
        </span>
      </motion.button>

      {/* Overlay de Preparação Premium */}
      <AnimatePresence>
        {status === "preparing" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-white/60 backdrop-blur-sm no-print"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="flex flex-col items-center gap-4 p-8 rounded-3xl bg-white shadow-2xl border border-slate-100 text-center"
            >
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-klasse-gold/10 animate-ping" />
                <div className="relative bg-klasse-gold text-white p-4 rounded-full">
                  <Printer className="h-8 w-8" />
                </div>
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">Preparando Recibo</h3>
                <p className="text-slate-500">Organizando as duas vias para impressão...</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
