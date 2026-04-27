"use client";

import { useEffect, useState } from "react";
import { Star, Zap, ShieldCheck, ShieldAlert } from "lucide-react";
import { motion } from "framer-motion";

type TalentItem = {
  aluno_id: string;
  career_headline: string | null;
  anonymous_slug: string | null;
  highest_media: number | null;
  skills_tags: unknown;
};

type Props = {
  slug: string;
  isVerified: boolean;
  partnerName: string;
  primaryColor: string;
  onActionClick: (id: string) => void;
};

export function PartnerTalentTeaser({ slug, isVerified, partnerName, primaryColor, onActionClick }: Props) {
  const [loading, setLoading] = useState(true);
  const [topTalents, setTopTalents] = useState<TalentItem[]>([]);

  useEffect(() => {
    async function loadTop3() {
      setLoading(true);
      try {
        const res = await fetch(`/api/formacao/publico/talent-pool?slug=${slug}&limit=3&min_media=17.5`);
        const json = await res.json();
        if (json.ok) {
          setTopTalents(json.items || []);
        }
      } catch (e) {
        console.error("Erro ao carregar top talentos", e);
      } finally {
        setLoading(false);
      }
    }
    void loadTop3();
  }, [slug]);

  if (loading) return (
    <div className="mb-12 grid gap-6 md:grid-cols-3">
      {[1, 2, 3].map(i => <div key={i} className="h-48 animate-pulse rounded-2xl bg-white/5 border border-white/5" />)}
    </div>
  );

  if (topTalents.length === 0) return null;

  return (
    <section className="mb-16">
      <div className="mb-8 flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="font-sora text-2xl font-black text-white">Prodígios do Mês</h2>
          <p className="text-sm text-slate-400">Os 3 alunos com maior desempenho académico disponíveis para contratação.</p>
        </div>
        <div className={`flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest ${isVerified ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-500' : 'border-amber-500/20 bg-amber-500/10 text-amber-500'}`}>
          {isVerified ? <ShieldCheck size={12} /> : <ShieldAlert size={12} />}
          {isVerified ? 'Acesso Total' : 'Modo Visualização'}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {topTalents.map((talent, index) => {
          const skills = Array.isArray(talent.skills_tags) ? (talent.skills_tags as string[]).slice(0, 2) : [];
          
          return (
            <motion.article
              key={talent.aluno_id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 to-transparent p-6 ring-1 ring-klasse-gold/10 transition-all hover:border-klasse-gold/30 hover:shadow-2xl hover:shadow-klasse-gold/5"
            >
              <div className="absolute -right-4 -top-4 text-klasse-gold/10">
                <Star size={80} fill="currentColor" />
              </div>

              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-klasse-gold text-slate-950">
                  <Star size={20} fill="currentColor" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-klasse-gold">Média Final</p>
                  <p className="font-mono text-lg font-black text-white">{talent.highest_media?.toFixed(1) ?? "18.5"}</p>
                </div>
              </div>

              <div className="mt-6">
                <p className="font-sora text-base font-bold leading-tight text-white group-hover:text-klasse-gold transition-colors">
                  {talent.career_headline ?? "Especialista em destaque"}
                </p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  {talent.anonymous_slug}
                </p>
              </div>

              <div className="mt-6 flex flex-wrap gap-1.5">
                {skills.map(s => (
                  <span key={s} className="rounded-lg bg-white/5 px-2 py-1 text-[9px] font-bold text-slate-400 border border-white/5">{s}</span>
                ))}
              </div>

              <button
                onClick={() => onActionClick(talent.aluno_id)}
                className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3 text-[10px] font-black uppercase tracking-widest text-slate-950 transition-all hover:bg-klasse-gold active:scale-[0.98]"
              >
                <Zap size={14} fill="currentColor" />
                Garantir este Talento
              </button>
            </motion.article>
          );
        })}
      </div>
    </section>
  );
}
