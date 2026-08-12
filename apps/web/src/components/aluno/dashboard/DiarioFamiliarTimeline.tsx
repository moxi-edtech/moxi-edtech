"use client";

import React, { useEffect, useState } from "react";
import { Star, MessageSquare, Award, Sparkles, CheckCircle, Clock } from "lucide-react";

type DiarioEntry = {
  id: string;
  tipo: "elogio" | "observacao" | "atividade" | "presenca" | "nota";
  titulo: string;
  conteudo: string;
  created_at: string;
  author_id?: string;
};

type BadgeEntry = {
  id: string;
  awarded_at: string;
  conquistas_catalogo?: {
    id: string;
    codigo: string;
    titulo: string;
    descricao: string;
    icone?: string | null;
  } | null;
};

export function DiarioFamiliarTimeline() {
  const [diarioEntries, setDiarioEntries] = useState<DiarioEntry[]>([]);
  const [badges, setBadges] = useState<BadgeEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        const [dRes, bRes] = await Promise.all([
          fetch("/api/aluno/pedagogia/diario", { cache: "no-store" }),
          fetch("/api/aluno/pedagogia/badges", { cache: "no-store" }),
        ]);

        const dJson = await dRes.json();
        const bJson = await bRes.json();

        if (active) {
          if (dRes.ok && dJson.ok) setDiarioEntries(dJson.items || []);
          if (bRes.ok && bJson.ok) setBadges(bJson.items || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="h-32 rounded-3xl bg-white border border-slate-200 animate-pulse" />
    );
  }

  const hasItems = diarioEntries.length > 0 || badges.length > 0;

  return (
    <section className="space-y-4">
      {/* SEÇÃO DE BADGES E CONQUISTAS */}
      {badges.length > 0 && (
        <div className="rounded-3xl border border-amber-200/80 bg-gradient-to-r from-amber-500/10 via-amber-50 to-amber-100/60 p-4 shadow-2xs space-y-2.5">
          <div className="flex items-center gap-2">
            <Award className="text-amber-600" size={18} />
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
              Conquistas & Badges Reconhecidos
            </h3>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {badges.map((b) => (
              <div
                key={b.id}
                className="flex items-center gap-2 rounded-2xl bg-white border border-amber-200/90 p-2.5 shadow-2xs shrink-0"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-400 text-slate-950">
                  <Award size={18} />
                </div>
                <div>
                  <p className="text-xs font-black text-slate-900">
                    {b.conquistas_catalogo?.titulo || "Conquista Académica"}
                  </p>
                  <p className="text-[10px] font-medium text-slate-500 line-clamp-1">
                    {b.conquistas_catalogo?.descricao || "Reconhecimento pedagógico"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* LINHA DO TEMPO DO DIÁRIO FAMILIAR */}
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="text-emerald-600" size={18} />
            <div>
              <h3 className="text-sm font-black text-slate-900">Diário de Bordo Familiar</h3>
              <p className="text-xs font-medium text-slate-500">Comunicação e elogios pedagógicos dos professores</p>
            </div>
          </div>
          <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">Acesso Familiar</span>
        </div>

        {!hasItems ? (
          <div className="p-6 text-center text-xs font-medium text-slate-500 space-y-1">
            <Sparkles className="w-6 h-6 text-slate-300 mx-auto mb-1" />
            <p>Nenhuma mensagem do diário de bordo registada recentemente.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {diarioEntries.map((entry) => {
              const isElogio = entry.tipo === "elogio";

              return (
                <div
                  key={entry.id}
                  className={`rounded-2xl p-4 border transition-all space-y-1.5 ${
                    isElogio
                      ? "border-emerald-200 bg-emerald-50/60"
                      : "border-slate-200/80 bg-slate-50/70"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase border ${
                        isElogio
                          ? "bg-emerald-600 text-white border-emerald-600"
                          : "bg-slate-200 text-slate-800 border-slate-300"
                      }`}
                    >
                      {isElogio ? <Star size={10} className="fill-white" /> : <MessageSquare size={10} />}
                      {entry.tipo}
                    </span>

                    <span className="text-[10px] font-mono font-semibold text-slate-400">
                      {new Date(entry.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <h4 className="text-xs font-black text-slate-900">{entry.titulo}</h4>
                  <p className="text-xs font-medium text-slate-700 leading-relaxed">
                    {entry.conteudo}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
