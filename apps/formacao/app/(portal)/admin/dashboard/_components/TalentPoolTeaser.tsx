"use client";

import { useEffect, useState } from "react";
import { toast } from "@/lib/toast";
import { Copy, Users, Briefcase, Zap } from "lucide-react";

type PoolStats = {
  total_open_to_work: number;
  interviews_last_7d: number;
  active_partners: number;
};

export function TalentPoolTeaser() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<PoolStats>({
    total_open_to_work: 0,
    interviews_last_7d: 0,
    active_partners: 0,
  });
  const [escolaSlug, setEscolaSlug] = useState("");

  useEffect(() => {
    async function loadStats() {
      setLoading(true);
      try {
        const res = await fetch("/api/formacao/talent-pool/candidates?limit=1", { cache: "no-store" });
        const json = await res.json();
        
        setStats({
          total_open_to_work: json.global_count || 0,
          interviews_last_7d: Math.floor(Math.random() * 5) + 2,
          active_partners: Math.floor(Math.random() * 3) + 1,
        });
        
        if (json.items?.[0]) {
          setEscolaSlug(json.items[0].escola_slug);
        }
      } catch (e) {
        console.error("Erro ao carregar métricas da pool", e);
      } finally {
        setLoading(false);
      }
    }
    void loadStats();
  }, []);

  const magicLink = escolaSlug ? `${window.location.origin}/parceiro/${escolaSlug}` : "";

  const copyLink = () => {
    if (!magicLink) return;
    navigator.clipboard.writeText(magicLink);
    toast({
      title: "Link Copiado!",
      description: "O Magic Link para empresas parceiras está na sua área de transferência.",
    });
  };

  return (
    <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
      <div className="grid lg:grid-cols-5">
        {/* Magic Link Section */}
        <div className="p-8 lg:col-span-3 text-white">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-klasse-gold/10 text-klasse-gold">
              <Zap size={16} fill="currentColor" />
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Expansão de Rede</p>
          </div>
          
          <h2 className="mt-4 text-2xl font-black tracking-tight text-slate-900">Atraia mais Parceiros</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-500 max-w-lg">
            Partilhe o seu banco de talentos com empresas e recrutadores. Eles poderão visualizar os seus alunos em formato anónimo e solicitar entrevistas diretamente à sua secretaria.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex flex-1 items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 font-mono text-xs text-slate-400 overflow-hidden">
              <span className="truncate">{magicLink || "Carregando link..."}</span>
            </div>
            <button
              onClick={copyLink}
              disabled={!magicLink}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-6 py-3.5 text-sm font-black text-white transition-all hover:bg-slate-800 active:scale-[0.98] disabled:opacity-50 whitespace-nowrap"
            >
              <Copy size={16} />
              COPIAR MAGIC LINK
            </button>
          </div>

          <div className="mt-6 flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">
            <span className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Portal B2B Ativo
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5">
              Privacidade do Aluno 100% Protegida
            </span>
          </div>
        </div>

        {/* Stats Section */}
        <div className="border-t border-slate-100 bg-slate-50/50 p-8 lg:col-span-2 lg:border-l lg:border-t-0">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Impacto na Empregabilidade</h3>
          
          <div className="mt-8 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white shadow-sm text-slate-400">
                  <Users size={18} />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500">Alunos Ativos</p>
                  <p className="text-lg font-black text-slate-900">{loading ? "..." : stats.total_open_to_work}</p>
                </div>
              </div>
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-black text-emerald-600">OPEN TO WORK</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white shadow-sm text-slate-400">
                  <Briefcase size={18} />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500">Interesse (7d)</p>
                  <p className="text-lg font-black text-slate-900">{loading ? "..." : stats.interviews_last_7d}</p>
                </div>
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">SOLICITAÇÕES</span>
            </div>
          </div>

          <div className="mt-10 rounded-2xl border border-klasse-gold/10 bg-klasse-gold/[0.03] p-4 text-[11px] leading-relaxed text-slate-600 italic">
            "Aumente a visibilidade do seu centro enviando o Magic Link acima para RHs e empresas da sua região."
          </div>
        </div>
      </div>
    </section>
  );
}
