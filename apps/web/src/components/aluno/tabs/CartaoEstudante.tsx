"use client";

import { useEffect, useState } from "react";
import QRCode from "react-qr-code";
import { User, ShieldCheck, Calendar, GraduationCap, Wallet, WifiOff, Info } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useAlunoPortalScope } from "@/components/aluno/AlunoPortalScope";
import { identityCardCacheKey, pruneIdentityCardCache, readIdentityCardCache, saveIdentityCardCache, type OfflineCardIdentity } from "@/lib/offline/identity-card-cache";

type IdentidadeData = OfflineCardIdentity & {
  bi?: string;
  foto?: string;
  escola_logo?: string;
};

export function CartaoEstudante() {
  const searchParams = useSearchParams();
  const studentId = searchParams?.get("aluno");
  const scope = useAlunoPortalScope();
  // Separar cache por utilizador autenticado, escola e educando.
  // Não disponibilizar fallback offline fora do layout autenticado.
  const cacheKey = identityCardCacheKey({
    userId: scope?.userId ?? "",
    escolaId: scope?.escolaId ?? "",
    studentId: studentId ?? null,
  });
  
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
    const controller = new AbortController();
    setLoading(true);
    setData(null);
    setError(null);
    setIsServedFromCache(false);

    try { pruneIdentityCardCache(localStorage); } catch { /* armazenamento indisponível */ }

    const url = studentId
      ? `/api/aluno/perfil/identidade?studentId=${encodeURIComponent(studentId)}`
      : "/api/aluno/perfil/identidade";

    void fetch(url, { signal: controller.signal })
      .then(async (response) => {
        const json = await response.json();
        if (controller.signal.aborted) return;
        if (response.ok && json.ok) {
          setData(json.identidade);
          if (cacheKey) {
            try { saveIdentityCardCache(localStorage, cacheKey, json.identidade); } catch { /* offline indisponível */ }
          }
        } else {
          setError({
            type: json.error || "UNKNOWN",
            message: json.message || "Falha ao carregar identidade académica.",
          });
        }
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        try {
          const cached = readIdentityCardCache(localStorage, cacheKey);
          if (cached) {
            setData(cached);
            setIsServedFromCache(true);
          } else {
            setError({ type: "FETCH_ERROR", message: "Cartão offline indisponível ou expirado. Liga-te à Internet para atualizar." });
          }
        } catch {
          setError({ type: "FETCH_ERROR", message: "Não foi possível recuperar o cartão offline." });
        }
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });

    return () => controller.abort();
  }, [studentId, cacheKey]);

  if (loading) {
    return (
      <div role="status" aria-label="A carregar cartão do estudante" className="mx-auto flex max-w-sm flex-col items-center gap-4 py-8 motion-safe:animate-pulse"><span className="sr-only">A carregar cartão do estudante</span>
        <div className="h-11 w-full rounded-xl bg-muted" />
        <div className="aspect-[1.5/1] w-full rounded-xl bg-muted" />
      </div>
    );
  }

  if (error?.type === "PENDING_PAYMENT") {
    return (
      <div className="py-8 px-4 max-w-sm mx-auto text-center">
        <div className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="h-11 w-11 rounded-2xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center mx-auto">
            <Wallet size={20} />
          </div>
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-foreground">Emissão pendente de pagamento</h2>
            <p className="text-sm leading-5 text-muted-foreground">
              {error.message}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return <div role="alert" className="rounded-xl border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">{error?.message || "Falha ao carregar identidade."}</div>;

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-md flex-col items-center space-y-4">

      {/* Offline Status Badge */}
      {(isServedFromCache || isOffline) && (
        <div className="flex items-center gap-2 rounded-full bg-amber-50 border border-amber-200/80 px-4 py-1.5 text-xs font-bold text-amber-800 shadow-sm animate-in fade-in duration-300">
          <WifiOff size={14} className="text-amber-600 shrink-0" />
          <span>Offline · Cartão guardado</span>
        </div>
      )}

      {/* Segmented Control Switcher (Cartão vs QR Code) */}
      <div role="group" aria-label="Apresentação da identidade" className="flex w-full max-w-[320px] rounded-xl border border-border bg-muted/40 p-1">
        <button
          type="button"
          onClick={() => setActiveTab("card")}
          aria-pressed={activeTab === "card"}
          className={`min-h-11 flex-1 rounded-xl px-2 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-klasse-gold/20 ${
            activeTab === "card"
              ? "bg-card text-primary ring-1 ring-klasse-gold/30 shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Cartão Estudantil
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("qr")}
          aria-pressed={activeTab === "qr"}
          className={`min-h-11 flex-1 rounded-xl px-2 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-klasse-gold/20 ${
            activeTab === "qr"
              ? "bg-card text-primary ring-1 ring-klasse-gold/30 shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          QR de Validação
        </button>
      </div>

      {/* TAB 1: Visual do Cartão Estudantil */}
      {activeTab === "card" && (
        <div className="w-full max-w-[360px] animate-in fade-in zoom-in-95 duration-300 space-y-6">
          <div className="relative min-h-[215px] w-full rounded-xl border border-border bg-card p-4 text-foreground shadow-sm flex flex-col justify-between">
            

            {/* Header do Cartão */}
            <div className="relative flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-muted p-1">
                  {data.escola_logo ? (
                    <img src={data.escola_logo} alt="Logo" className="h-full w-full object-contain" />
                  ) : (
                    <GraduationCap className="h-5 w-5 text-primary" />
                  )}
                </div>
                <h3 className="min-w-0 break-words text-sm font-semibold text-foreground">
                  {data.escola}
                </h3>
              </div>
              <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground">
                {data.ano_letivo}
              </span>
            </div>

            {/* Corpo do Cartão */}
            <div className="relative my-3 flex items-center gap-3">
              {/* Foto do Aluno */}
              <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded-xl border border-border bg-muted">
                {data.foto ? (
                  <img src={data.foto} alt={data.nome} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
                    <User size={36} />
                  </div>
                )}
              </div>

              {/* Dados Principais */}
              <div className="min-w-0 flex-1 space-y-1">
                <h2 className="break-words text-sm font-semibold leading-tight text-foreground">{data.nome}</h2>
                <p className="text-xs font-medium text-muted-foreground">
                  Proc: <span className="text-foreground font-mono">{data.processo}</span>
                </p>
                
                <div className="pt-2 space-y-0.5">
                  <p className="break-words text-xs font-medium text-primary">
                    {data.curso}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Turma: {data.turma}
                  </p>
                </div>
              </div>
            </div>

            {/* Footer do Cartão */}
            <div className="relative flex flex-wrap items-center justify-between gap-1 border-t border-border pt-2.5 text-xs text-muted-foreground">
              <span className="flex items-center gap-1 text-primary">
                <ShieldCheck size={12} /> Documento Oficial
              </span>
              <span>Validade: {new Date(data.validade).toLocaleDateString("pt-PT")}</span>
            </div>

          </div>

          <p className="text-center text-xs text-muted-foreground">
            Apresente este cartão digital para identificação nas instalações escolares.
          </p>
        </div>
      )}

      {/* TAB 2: QR Code de Validação (Espaçoso e Limpo) */}
      {activeTab === "qr" && (
        <div className="w-full max-w-[340px] animate-in fade-in zoom-in-95 duration-300 space-y-6">
          <div className="flex flex-col items-center space-y-5 rounded-xl border border-border bg-card p-5 text-center shadow-sm sm:p-6">
            
            {/* The QR is a machine-readable document, not a themed surface.
                Its own SVG includes a quiet zone of at least four modules
                (36 units for a 180-unit symbol, even at QR version 1). */}
            <svg viewBox="0 0 252 252" width={252} height={252}
              className="block h-auto w-full max-w-[252px]"
              role="img" aria-label="Código QR de validação do cartão do estudante">
              <rect width={252} height={252} rx={8} fill="#ffffff" />
              <QRCode
                x={36}
                y={36}
                value={data.verification_url}
                size={180}
                bgColor="#ffffff"
                fgColor="#0f172a"
                aria-hidden="true"
              />
            </svg>

            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-foreground">Validação em tempo real</h3>
              <p className="text-sm leading-5 text-muted-foreground">
                Apresenta o código para validar a tua identidade.
              </p>
            </div>

            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald/10 border border-emerald/20 px-3.5 py-1 text-xs font-medium text-emerald dark:text-emerald-300">
              <ShieldCheck size={12} /> Válido até {new Date(data.validade).toLocaleDateString("pt-PT")}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
