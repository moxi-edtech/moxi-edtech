"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { Printer, Loader2, Check } from "lucide-react";
import { useToast } from "@/components/feedback/FeedbackSystem";
import { ReciboPagamentoDuasVias } from "@/components/financeiro/ReciboPagamentoCompacto";

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
  referenciasDetalhadas?: string[];
  metodo?: string;
  numero?: string | null;
  publicId?: string;
  logoUrl?: string | null;
  emitidoEm?: string | null;
  banco?: string | null;
  titularConta?: string | null;
  iban?: string | null;
  kwikChave?: string | null;
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
  referenciasDetalhadas = [],
  metodo = "—",
  numero = null,
  publicId = "—",
  logoUrl = null,
  emitidoEm = null,
  banco = null,
  titularConta = null,
  iban = null,
  kwikChave = null,
}: ReciboImprimivelProps) {
  const dataFormatada = useMemo(() => {
    if (!data) return "—";
    const parsed = new Date(data);
    if (Number.isNaN(parsed.getTime())) return data;
    return parsed.toLocaleDateString("pt-PT");
  }, [data]);

  return (
    <div className="hidden print:block">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: A4;
            margin: 10mm;
          }
          body {
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact;
          }
        }
      ` }} />
      <div className="w-full max-w-none bg-white text-slate-900">

        <ReciboPagamentoDuasVias
          escolaNome={escolaNome}
          alunoNome={alunoNome}
          alunoBi={alunoBi}
          classeNome={classeNome}
          cursoNome={cursoNome}
          turmaNome={turmaNome}
          referencia={referencia}
          referenciasDetalhadas={referenciasDetalhadas}
          metodo={metodo}
          valorPago={valor}
          dataPagamento={dataFormatada}
          numero={numero}
          publicId={publicId}
          urlValidacao={urlValidacao}
          logoUrl={logoUrl}
          emitidoEm={emitidoEm ?? dataFormatada}
          banco={banco}
          titularConta={titularConta}
          iban={iban}
          kwikChave={kwikChave}
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
  logoUrl = null,
  banco = null,
  titularConta = null,
  iban = null,
  kwikChave = null,
}: {
  mensalidadeId: string;
  escolaNome: string;
  alunoNome: string;
  valor: number;
  dataPagamento: string;
  logoUrl?: string | null;
  banco?: string | null;
  titularConta?: string | null;
  iban?: string | null;
  kwikChave?: string | null;
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
    } catch (_err) {
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
              className="flex flex-col items-center gap-4 rounded-3xl bg-white p-8 text-center shadow-2xl border border-slate-100"
            >
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-klasse-gold/10 animate-ping" />
                <div className="relative rounded-full bg-klasse-gold p-4 text-white">
                  <Printer className="h-8 w-8" />
                </div>
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">Preparando Recibo</h3>
                <p className="text-slate-500">Organizando o layout para impressão...</p>
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
          publicId={recibo.doc_id}
          logoUrl={logoUrl}
          banco={banco}
          titularConta={titularConta}
          iban={iban}
          kwikChave={kwikChave}
        />
      ) : null}
    </div>
  );
}
