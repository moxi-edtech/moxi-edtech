"use client";

import { useEffect, useState } from "react";
import QRCode from "react-qr-code";
import { User, ShieldCheck, Calendar, GraduationCap, Wallet, WifiOff, Info } from "lucide-react";
import { useSearchParams } from "next/navigation";

type IdentidadeData = {
  nome: string;
  processo: string;
  bi: string;
  foto?: string;
  escola: string;
  escola_logo?: string;
  sigla?: string;
  curso: string;
  turma: string;
  ano_letivo: number;
  validade: string;
  verification_url: string;
};

const STORAGE_KEY = "klasse_id_card_cache_";

export function CartaoEstudante() {
  const searchParams = useSearchParams();
  const studentId = searchParams?.get("aluno");
  
  const [data, setData] = useState<IdentidadeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isServedFromCache, setIsServedFromCache] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [error, setError] = useState<{ type: string; message: string } | null>(null);
  const [activeTab, setActiveTab] = useState<"card" | "qr">("card");

  useEffect(() => {
    const handleOnlineStatus = () => setIsOffline(!navigator.onLine);
    window.addEventListener("online", handleOnlineStatus);
    window.addEventListener("offline", handleOnlineStatus);
    setIsOffline(!navigator.onLine);

    return () => {
      window.removeEventListener("online", handleOnlineStatus);
      window.removeEventListener("offline", handleOnlineStatus);
    };
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setIsServedFromCache(false);
    
    const cacheKey = `${STORAGE_KEY}${studentId || "default"}`;
    const url = studentId 
      ? `/api/aluno/perfil/identidade?studentId=${studentId}`
      : "/api/aluno/perfil/identidade";

    fetch(url)
      .then(async (r) => {
        const json = await r.json();
        if (r.ok && json.ok) {
          setData(json.identidade);
          try {
            localStorage.setItem(cacheKey, JSON.stringify(json.identidade));
          } catch (e) {
            console.warn("Could not save ID card to localStorage", e);
          }
        } else {
          setError({ 
            type: json.error || "UNKNOWN", 
            message: json.message || "Falha ao carregar identidade acadêmica." 
          });
        }
      })
      .catch(() => {
        try {
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
            const parsed = JSON.parse(cached) as IdentidadeData;
            setData(parsed);
            setIsServedFromCache(true);
          } else {
            setError({ type: "FETCH_ERROR", message: "Dispositivo offline. Nenhum cartão em cache." });
          }
        } catch (e) {
          setError({ type: "FETCH_ERROR", message: "Erro de conexão ao carregar dados." });
        }
      })
      .finally(() => setLoading(false));
  }, [studentId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-6 py-12 animate-pulse max-w-sm mx-auto">
        <div className="w-full h-12 rounded-full bg-slate-200" />
        <div className="w-full aspect-[1.5/1] rounded-[2.5rem] bg-slate-200" />
      </div>
    );
  }

  if (error?.type === "PENDING_PAYMENT") {
    return (
      <div className="py-8 px-4 max-w-sm mx-auto text-center">
        <div className="rounded-3xl bg-white border border-slate-100 p-6 shadow-sm space-y-4">
          <div className="h-11 w-11 rounded-2xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center mx-auto">
            <Wallet size={20} />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-900">Emissão Pendente de Pagamento</h3>
            <p className="text-xs font-medium text-slate-500 leading-relaxed">
              {error.message}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return <div className="text-center py-16 text-slate-400 font-bold text-xs">{error?.message || "Falha ao carregar identidade."}</div>;

  return (
    <div className="flex flex-col items-center space-y-6 py-6 px-2 max-w-md mx-auto">

      {/* Offline Status Badge */}
      {(isServedFromCache || isOffline) && (
        <div className="flex items-center gap-2 rounded-full bg-amber-50 border border-amber-200/80 px-4 py-1.5 text-xs font-bold text-amber-800 shadow-sm animate-in fade-in duration-300">
          <WifiOff size={14} className="text-amber-600 shrink-0" />
          <span>Modo Offline — Cartão Salvo no Dispositivo</span>
        </div>
      )}

      {/* Segmented Control Switcher (Cartão vs QR Code) */}
      <div className="flex w-full max-w-[320px] rounded-2xl bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => setActiveTab("card")}
          className={`flex-1 rounded-xl py-2 text-xs font-black transition-all ${
            activeTab === "card"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-900"
          }`}
        >
          Cartão Estudantil
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("qr")}
          className={`flex-1 rounded-xl py-2 text-xs font-black transition-all ${
            activeTab === "qr"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-900"
          }`}
        >
          QR de Validação
        </button>
      </div>

      {/* TAB 1: Visual do Cartão Estudantil */}
      {activeTab === "card" && (
        <div className="w-full max-w-[360px] animate-in fade-in zoom-in-95 duration-300 space-y-6">
          <div className="relative aspect-[1.58/1] w-full overflow-hidden rounded-[2.5rem] bg-[#0d1711] p-6 text-white shadow-xl ring-1 ring-white/10 flex flex-col justify-between">
            
            {/* Ambient Lighting Ornaments */}
            <div className="absolute -right-12 -top-12 h-44 w-44 rounded-full bg-klasse-gold/10 blur-[50px]" />
            <div className="absolute -left-12 -bottom-12 h-44 w-44 rounded-full bg-emerald-500/10 blur-[50px]" />

            {/* Header do Cartão */}
            <div className="relative flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 backdrop-blur-md p-1">
                  {data.escola_logo ? (
                    <img src={data.escola_logo} alt="Logo" className="h-full w-full object-contain" />
                  ) : (
                    <GraduationCap className="h-5 w-5 text-klasse-gold" />
                  )}
                </div>
                <h3 className="text-xs font-black uppercase tracking-tight text-white truncate max-w-[170px]">
                  {data.escola}
                </h3>
              </div>
              <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[9px] font-black uppercase text-klasse-gold backdrop-blur-sm">
                {data.ano_letivo}
              </span>
            </div>

            {/* Corpo do Cartão */}
            <div className="relative my-auto flex items-center gap-4">
              {/* Foto do Aluno */}
              <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded-2xl bg-slate-800 ring-1 ring-white/20 shadow-lg">
                {data.foto ? (
                  <img src={data.foto} alt={data.nome} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-slate-800 text-white/20">
                    <User size={36} />
                  </div>
                )}
              </div>

              {/* Dados Principais */}
              <div className="min-w-0 flex-1 space-y-1">
                <h2 className="text-sm font-black text-white leading-tight truncate">{data.nome}</h2>
                <p className="text-[10px] font-bold text-slate-400">
                  Proc: <span className="text-emerald-400 font-mono">{data.processo}</span>
                </p>
                
                <div className="pt-2 space-y-0.5">
                  <p className="text-[9px] font-black uppercase text-klasse-gold tracking-tight truncate">
                    {data.curso}
                  </p>
                  <p className="text-[10px] font-medium text-white/80">
                    Turma: {data.turma}
                  </p>
                </div>
              </div>
            </div>

            {/* Footer do Cartão */}
            <div className="relative flex items-center justify-between border-t border-white/10 pt-2.5 text-[9px] font-bold text-slate-400">
              <span className="flex items-center gap-1 text-emerald-400">
                <ShieldCheck size={12} /> Documento Oficial
              </span>
              <span>Validade: {new Date(data.validade).toLocaleDateString("pt-PT")}</span>
            </div>

          </div>

          <p className="text-center text-[11px] font-medium text-slate-400">
            Apresente este cartão digital para identificação nas instalações escolares.
          </p>
        </div>
      )}

      {/* TAB 2: QR Code de Validação (Espaçoso e Limpo) */}
      {activeTab === "qr" && (
        <div className="w-full max-w-[340px] animate-in fade-in zoom-in-95 duration-300 space-y-6">
          <div className="rounded-[2.5rem] bg-white p-8 border border-slate-100 shadow-sm flex flex-col items-center text-center space-y-6">
            
            <div className="rounded-3xl bg-slate-50 p-6 ring-1 ring-slate-100 shadow-inner">
              <QRCode
                value={data.verification_url}
                size={180}
                style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                viewBox={`0 0 256 256`}
                fgColor="#0f172a"
              />
            </div>

            <div className="space-y-1">
              <h4 className="text-sm font-black text-slate-900">Validação em Tempo Real</h4>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                Código para leitura nos leitos de acesso ou conferência de presença.
              </p>
            </div>

            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-100 px-3.5 py-1 text-[10px] font-bold text-emerald-700">
              <ShieldCheck size={12} /> Válido até {new Date(data.validade).toLocaleDateString("pt-PT")}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
