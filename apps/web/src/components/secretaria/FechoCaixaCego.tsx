"use client";

import React, { useMemo, useState } from "react";
import {
  Lock,
  Banknote,
  CreditCard,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Calculator,
  Wallet,
} from "lucide-react";

const KWANZA_NOTES = [
  { value: 5000, label: "5.000 Kz", color: "text-foreground bg-muted" },
  { value: 2000, label: "2.000 Kz", color: "text-foreground bg-muted" },
  { value: 1000, label: "1.000 Kz", color: "text-rose-700 bg-rose-50" },
  { value: 500, label: "500 Kz", color: "text-amber-700 bg-amber-50" },
  { value: 200, label: "200 Kz", color: "text-cyan-700 bg-cyan-50" },
  { value: 100, label: "100 Kz", color: "text-foreground bg-muted" },
];

const kwanza = new Intl.NumberFormat("pt-AO", {
  style: "currency",
  currency: "AOA",
  maximumFractionDigits: 0,
});

type ResultadoFecho = {
  sistema: { numerario: number; tpa: number; transferencia: number; mcx: number };
  diferenca_total: number;
  status: "MATCH" | "DIVERGENT";
};

interface FechoCaixaCegoProps {
  onConfirm: (data: {
    numerario_declarado: number;
    tpa_declarado: number;
    transferencia_declarada: number;
    mcx_declarado: number;
    detalhe_notas: Record<string, number>;
  }) => Promise<ResultadoFecho>;
  onClose: () => void;
}

export default function FechoCaixaCego({ onConfirm, onClose }: FechoCaixaCegoProps) {
  const [step, setStep] = useState<"contagem" | "conferencia">("contagem");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [counts, setCounts] = useState<Record<number, string>>({});
  const [tpaTotal, setTpaTotal] = useState<string>("");
  const [transferTotal, setTransferTotal] = useState<string>("");
  const [mcxTotal, setMcxTotal] = useState<string>("");

  const [resultado, setResultado] = useState<ResultadoFecho | null>(null);

  const totalNumerario = useMemo(() => {
    return Object.entries(counts).reduce((acc, [val, qtd]) => {
      const quantity = parseInt(qtd) || 0;
      return acc + Number(val) * quantity;
    }, 0);
  }, [counts]);

  const handleCountChange = (val: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    setCounts((prev) => ({ ...prev, [val]: value }));
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    const declaracao = {
      numerario_declarado: totalNumerario,
      tpa_declarado: Number(tpaTotal) || 0,
      transferencia_declarada: Number(transferTotal) || 0,
      mcx_declarado: Number(mcxTotal) || 0,
      detalhe_notas: Object.fromEntries(
        Object.entries(counts).map(([k, v]) => [k, Number(v) || 0])
      ),
    };

    try {
      const response = await onConfirm(declaracao);
      setResultado(response);
      setStep("conferencia");
    } catch (error) {
      console.error("Erro no fecho", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-background/90 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
      <div className="bg-card w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="bg-background p-6 flex justify-between items-center text-white shrink-0 border-b border-border">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Lock className="w-4 h-4 text-[#E3B23C]" />
              <span className="text-[10px] font-bold text-[#E3B23C] uppercase tracking-widest">
                Procedimento de Auditoria
              </span>
            </div>
            <h2 className="text-xl font-bold text-white">Fecho de Caixa Cego</h2>
            <p className="text-muted-foreground text-xs mt-1">Declare os valores físicos antes de ver o sistema.</p>
          </div>

          {step === "contagem" && (
            <div className="text-right bg-background p-3 rounded-xl border border-border">
              <div className="text-[10px] text-muted-foreground uppercase font-bold">Total Físico (Cash)</div>
              <div className="text-2xl font-mono font-bold text-[#1F6B3B]">
                {kwanza.format(totalNumerario)}
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-muted">
          {step === "contagem" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 space-y-8">
              <section className="bg-card p-5 rounded-2xl border border-border shadow-sm">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2 mb-4 pb-2 border-b border-border">
                  <Banknote className="w-4 h-4 text-muted-foreground" />
                  1. Contagem de Numerário (Cédulas)
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {KWANZA_NOTES.map((note) => {
                    const qtd = Number(counts[note.value] || 0);
                    const subtotal = qtd * note.value;

                    return (
                      <div
                        key={note.value}
                        className={`p-3 rounded-xl border transition-all ${
                          qtd > 0
                            ? "bg-card border-[#1F6B3B]/30 shadow-sm ring-1 ring-[#1F6B3B]/10"
                            : "bg-muted border-border"
                        }`}
                      >
                        <div className="flex justify-between items-center mb-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${note.color}`}>
                            {note.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            inputMode="numeric"
                            placeholder="0"
                            className="w-full bg-card border border-border rounded-lg py-1.5 px-2 text-center font-bold text-foreground focus:ring-2 focus:ring-[#E3B23C] focus:border-[#E3B23C] outline-none text-lg"
                            value={counts[note.value] || ""}
                            onChange={(e) => handleCountChange(note.value, e.target.value)}
                          />
                          <span className="text-[10px] font-bold text-muted-foreground uppercase">un</span>
                        </div>
                        <div
                          className={`text-right text-xs font-mono font-bold mt-2 ${
                            subtotal > 0 ? "text-foreground" : "text-muted-foreground"
                          }`}
                        >
                          {kwanza.format(subtotal)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="bg-card p-5 rounded-2xl border border-border shadow-sm">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2 mb-4 pb-2 border-b border-border">
                  <CreditCard className="w-4 h-4 text-muted-foreground" />
                  2. Valores Digitais (Soma dos Comprovativos)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-foreground uppercase">Soma dos Talões TPA</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-[#E3B23C]">
                        <CreditCard className="h-5 w-5" />
                      </div>
                      <input
                        type="number"
                        value={tpaTotal}
                        onChange={(e) => setTpaTotal(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-border bg-muted font-mono text-lg font-bold text-foreground focus:bg-card focus:border-[#E3B23C] focus:ring-2 focus:ring-[#E3B23C]/20 outline-none transition-all placeholder:text-muted-foreground"
                        placeholder="0"
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground">
                        KZ
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground">Some o valor impresso em todos os papéis do TPA.</p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-foreground uppercase">Soma Transferências</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-[#E3B23C]">
                        <Wallet className="h-5 w-5" />
                      </div>
                      <input
                        type="number"
                        value={transferTotal}
                        onChange={(e) => setTransferTotal(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-border bg-muted font-mono text-lg font-bold text-foreground focus:bg-card focus:border-[#E3B23C] focus:ring-2 focus:ring-[#E3B23C]/20 outline-none transition-all placeholder:text-muted-foreground"
                        placeholder="0"
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground">
                        KZ
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground">Some o valor dos bordereaux físicos recebidos.</p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-foreground uppercase">Soma MCX/KIWK</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-[#E3B23C]">
                        <Wallet className="h-5 w-5" />
                      </div>
                      <input
                        type="number"
                        value={mcxTotal}
                        onChange={(e) => setMcxTotal(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-border bg-muted font-mono text-lg font-bold text-foreground focus:bg-card focus:border-[#E3B23C] focus:ring-2 focus:ring-[#E3B23C]/20 outline-none transition-all placeholder:text-muted-foreground"
                        placeholder="0"
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground">
                        KZ
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground">Some o valor dos pagamentos MCX/KIWK.</p>
                  </div>
                </div>
              </section>
            </div>
          )}

          {step === "conferencia" && resultado && (
            <div className="animate-in zoom-in-95 duration-300 flex flex-col items-center justify-center py-8">
              <div className="mb-6 relative">
                <div
                  className={`w-24 h-24 rounded-full flex items-center justify-center ${
                    resultado.diferenca_total === 0
                      ? "bg-[#1F6B3B]/10 text-[#1F6B3B]"
                      : "bg-rose-500/10 text-rose-600"
                  }`}
                >
                  {resultado.diferenca_total === 0 ? (
                    <CheckCircle2 className="w-12 h-12" />
                  ) : (
                    <AlertTriangle className="w-12 h-12" />
                  )}
                </div>
                {resultado.diferenca_total === 0 && (
                  <div className="absolute -bottom-2 -right-2 bg-[#E3B23C] text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-sm">
                    PERFEITO
                  </div>
                )}
              </div>

              <h3 className="text-2xl font-bold text-foreground mb-2">
                {resultado.diferenca_total === 0 ? "Caixa Batido com Sucesso!" : "Divergência Detectada"}
              </h3>
              <p className="text-muted-foreground text-sm mb-8 text-center max-w-md">
                O relatório de fecho foi gerado e enviado para a administração.
              </p>

              <div className="w-full bg-card rounded-xl border border-border overflow-hidden shadow-sm mb-6">
                <div className="grid grid-cols-3 bg-muted p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider border-b border-border">
                  <div>Canal</div>
                  <div className="text-right">Declarado</div>
                  <div className="text-right">Sistema</div>
                </div>
                <div className="divide-y divide-border">
                  <div className="grid grid-cols-3 p-4 text-sm">
                    <span className="font-bold text-foreground">Numerário</span>
                    <span className="text-right font-mono text-muted-foreground">{kwanza.format(totalNumerario)}</span>
                    <span className="text-right font-mono text-muted-foreground">
                      {kwanza.format(resultado.sistema.numerario)}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 p-4 text-sm">
                    <span className="font-bold text-foreground">TPA</span>
                    <span className="text-right font-mono text-muted-foreground">
                      {kwanza.format(Number(tpaTotal) || 0)}
                    </span>
                    <span className="text-right font-mono text-muted-foreground">{kwanza.format(resultado.sistema.tpa)}</span>
                  </div>
                  <div className="grid grid-cols-3 p-4 text-sm">
                    <span className="font-bold text-foreground">Transferência</span>
                    <span className="text-right font-mono text-muted-foreground">
                      {kwanza.format(Number(transferTotal) || 0)}
                    </span>
                    <span className="text-right font-mono text-muted-foreground">
                      {kwanza.format(resultado.sistema.transferencia)}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 p-4 text-sm">
                    <span className="font-bold text-foreground">MCX</span>
                    <span className="text-right font-mono text-muted-foreground">
                      {kwanza.format(Number(mcxTotal) || 0)}
                    </span>
                    <span className="text-right font-mono text-muted-foreground">{kwanza.format(resultado.sistema.mcx)}</span>
                  </div>
                  <div className="grid grid-cols-3 p-4 bg-muted/50">
                    <span className="font-bold text-foreground">Resultado Final</span>
                    <div className="col-span-2 text-right">
                      <span
                        className={`text-base font-black font-mono px-3 py-1 rounded-lg ${
                          resultado.diferenca_total === 0
                            ? "bg-[#1F6B3B]/10 text-[#1F6B3B]"
                            : "bg-rose-500/10 text-rose-600"
                        }`}
                      >
                        {resultado.diferenca_total > 0 ? "+" : ""}
                        {kwanza.format(resultado.diferenca_total)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 bg-card border-t border-border shrink-0 flex justify-between items-center gap-4">
          {step === "contagem" ? (
            <>
              <button
                onClick={onClose}
                className="px-6 py-3 rounded-xl border border-border text-muted-foreground text-sm font-bold hover:bg-muted hover:text-foreground transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex-1 bg-[#E3B23C] text-white px-6 py-3 rounded-xl text-sm font-bold hover:brightness-105 shadow-md shadow-orange-900/10 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed transition-all"
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Calculator className="w-5 h-5" />}
                {isSubmitting ? "Validando..." : "Conferir Caixa"}
              </button>
            </>
          ) : (
            <button
              onClick={onClose}
              className="w-full bg-[#1F6B3B] text-white px-6 py-4 rounded-xl text-sm font-bold hover:brightness-110 shadow-lg flex items-center justify-center gap-2 transition-all"
            >
              Concluir e Sair <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
