"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { B2BJoinForm } from "./_components/B2BJoinForm";
import { PartnerTalentTeaser } from "./_components/PartnerTalentTeaser";
import { canAccessGlobalScope } from "@/lib/talent-pool/onboarding";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type TalentItem = {
  aluno_id: string;
  escola_id: string;
  escola_nome: string;
  escola_slug: string;
  provincia: string | null;
  municipio: string | null;
  preferencia_trabalho: string | null;
  career_headline: string | null;
  skills_tags: unknown;
  anonymous_slug: string | null;
  highest_media: number | null;
};

type Payload = {
  ok: boolean;
  error?: string;
  partner?: {
    escola_id: string;
    nome: string;
    slug: string;
    tenant_type: "formacao" | "solo_creator" | "k12";
    cor_primaria: string | null;
    logo_url: string | null;
  };
  scope?: "local" | "global";
  query?: string | null;
  local_count?: number;
  global_count?: number;
  items?: TalentItem[];
};

type BrandPalette = {
  primary: string;
  chipBg: string;
  chipText: string;
  glow: string;
};

function parseHexColor(value: string): string | null {
  const raw = value.trim();
  const full = raw.startsWith("#") ? raw : `#${raw}`;
  return /^#([a-fA-F0-9]{6})$/.test(full) ? full.toLowerCase() : null;
}

function hexToRgb(hex: string): [number, number, number] {
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ];
}

function alpha(hex: string, opacity: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function partnerPalette(color: string | null | undefined): BrandPalette {
  const primary = parseHexColor(String(color ?? "")) ?? "#c8902a";
  const textDark = luminance(primary) > 0.6;
  return {
    primary,
    chipBg: alpha(primary, 0.2),
    chipText: textDark ? "#111827" : "#f8fafc",
    glow: alpha(primary, 0.18),
  };
}

export function PartnerTalentPoolClient({ slug }: { slug: string }) {
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<"local" | "global">("local");
  const [query, setQuery] = useState("");
  const [payload, setPayload] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authState, setAuthState] = useState<"checking" | "anonymous" | "authenticated">("checking");
  const [isVerified, setIsVerified] = useState(false);
  const [blockModalOpen, setBlockModalOpen] = useState(false);

  const palette = useMemo(() => partnerPalette(payload?.partner?.cor_primaria), [payload?.partner?.cor_primaria]);

  async function load(nextScope: "local" | "global", nextQuery: string) {
    setLoading(true);
    setError(null);
    try {
      const url = `/api/formacao/publico/talent-pool?slug=${encodeURIComponent(slug)}&scope=${nextScope}&q=${encodeURIComponent(nextQuery)}`;
      const res = await fetch(url, { cache: "no-store" });
      const json = (await res.json()) as Payload;
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? "Falha ao carregar talentos");
      }
      setPayload(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load("local", "");
  }, [slug]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let mounted = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (data.session) {
        setAuthState("authenticated");
        fetch("/api/formacao/talent-pool/empresa-status")
          .then(r => r.json())
          .then(j => setIsVerified(Boolean(j.profile?.is_verified)));
      } else {
        setAuthState("anonymous");
      }
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      if (session) {
        setAuthState("authenticated");
        fetch("/api/formacao/talent-pool/empresa-status")
          .then(r => r.json())
          .then(j => setIsVerified(Boolean(j.profile?.is_verified)));
      } else {
        setAuthState("anonymous");
      }
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const localCount = payload?.local_count ?? 0;
  const globalCount = payload?.global_count ?? 0;
  const items = payload?.items ?? [];
  const showUpsell = scope === "local" && !loading && items.length === 0 && globalCount > 0;
  const canAccessGlobal = canAccessGlobalScope({
    scope,
    loading,
    itemsCount: items.length,
    globalCount,
  });

  const handleSkillClick = (skill: string) => {
    setQuery(skill);
    void load(scope, skill);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-20">
      <Dialog open={blockModalOpen} onOpenChange={setBlockModalOpen}>
        <DialogContent className="bg-slate-900 border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="font-sora text-xl font-black text-white">Conta em Validação</DialogTitle>
            <DialogDescription className="text-slate-400">
              Para proteger a privacidade dos nossos prodígios, validamos manualmente cada entidade parceira.
              A sua conta será ativada num período de 2 a 4 horas. Receberá um aviso por e-mail.
            </DialogDescription>
          </DialogHeader>
          <button onClick={() => setBlockModalOpen(false)} className="mt-4 w-full rounded-xl bg-white py-3 text-sm font-bold text-slate-950">
            Compreendido
          </button>
        </DialogContent>
      </Dialog>

      <div
        className="pointer-events-none fixed inset-x-0 top-0 h-64 bg-gradient-to-b to-transparent"
        style={{ backgroundImage: `linear-gradient(to bottom, ${palette.glow}, transparent)` }}
      />

      <main className="relative mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <header className="rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl shadow-2xl shadow-black/50">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <span
                className="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em]"
                style={{ backgroundColor: palette.chipBg, color: palette.chipText }}
              >
                Porta B2B
              </span>
              <span className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                {scope === "local" ? "Rede Local" : "Rede Global KLASSE"}
              </span>
            </div>
            {payload?.partner?.logo_url ? (
              <img
                src={payload.partner.logo_url}
                alt={`Logo ${payload.partner.nome}`}
                className="h-8 w-auto rounded-lg border border-white/10 bg-white/95 p-1"
              />
            ) : null}
          </div>

          <div>
            <h1 className="mt-6 text-3xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl max-w-4xl">
              Talentos <span style={{ color: palette.primary }}>Recomendados</span>
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-400">
              Aceda a um banco de profissionais qualificados pela <strong>{payload?.partner?.nome ?? "instituição parceira"}</strong>. 
              Privacidade garantida até a confirmação de interesse.
            </p>
          </div>

          <div className="mt-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <form
              className="flex-1 flex flex-col gap-2 sm:flex-row"
              onSubmit={(e) => {
                e.preventDefault();
                void load(scope, query);
              }}
            >
              <div className="relative flex-1">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Pesquisar headline, competência ou cidade..."
                  className="w-full rounded-2xl border border-white/10 bg-slate-900/50 px-5 py-4 text-sm text-white placeholder:text-slate-500 focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/10"
                />
                {loading && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                  </div>
                )}
              </div>
              <button
                className="rounded-2xl px-8 py-4 text-sm font-black text-white transition-all hover:brightness-110 active:scale-[0.95] shadow-xl shadow-black/20"
                type="submit"
                style={{ backgroundColor: palette.primary }}
              >
                PESQUISAR
              </button>
            </form>

            <div className="flex shrink-0 flex-col gap-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Âmbito da Procura</label>
              <div className="inline-flex rounded-2xl bg-white/5 p-1 backdrop-blur-sm border border-white/5">
                <button
                  type="button"
                  onClick={() => { setScope("local"); void load("local", query); }}
                  className={`rounded-xl px-5 py-2.5 text-xs font-bold transition-all ${scope === 'local' ? 'bg-white text-slate-950 shadow-lg shadow-white/10' : 'text-slate-400 hover:text-white'}`}
                >
                  Local ({localCount})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!canAccessGlobal) return;
                    setScope("global");
                    void load("global", query);
                  }}
                  disabled={!canAccessGlobal}
                  className={`rounded-xl px-5 py-2.5 text-xs font-bold transition-all ${
                    scope === "global"
                      ? "bg-white text-slate-950 shadow-lg shadow-white/10"
                      : canAccessGlobal
                        ? "text-slate-400 hover:text-white"
                        : "cursor-not-allowed text-slate-600"
                  }`}
                >
                  Global ({globalCount})
                </button>
              </div>
            </div>
          </div>
        </header>

        <section className="mt-12">
          {authState === "authenticated" && (
            <PartnerTalentTeaser 
              slug={slug}
              isVerified={isVerified}
              partnerName={payload?.partner?.nome ?? ""}
              primaryColor={palette.primary}
              onActionClick={() => {
                if (!isVerified) {
                  setBlockModalOpen(true);
                } else {
                  window.location.href = "/login";
                }
              }}
            />
          )}

          {error ? (
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-300">
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-64 animate-pulse rounded-2xl border border-white/5 bg-white/5" />
              ))}
            </div>
          ) : authState === "authenticated" ? (
            items.length > 0 ? (
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {items.map((item) => {
                  const skills = Array.isArray(item.skills_tags)
                    ? (item.skills_tags as unknown[]).map((s) => String(s)).filter(Boolean)
                    : [];

                  return (
                    <article 
                      key={item.aluno_id} 
                      className="group relative flex flex-col rounded-2xl border border-white/10 bg-white/5 p-6 transition-all hover:border-white/20 hover:bg-white/[0.07] hover:shadow-2xl hover:shadow-black/50 text-white"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-slate-400">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                        <div className="flex flex-col items-end gap-2 text-right">
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                            {item.anonymous_slug?.split('-')[0] ?? "TALENTO"}
                          </span>
                          {item.preferencia_trabalho && (
                            <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-emerald-500 border border-emerald-500/20">
                              {item.preferencia_trabalho}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="mt-6 flex-1">
                        <p className="text-xl font-bold leading-tight text-white group-hover:text-klasse-gold transition-colors">
                          {item.career_headline ?? "Perfil profissional em validação"}
                        </p>
                        <div className="mt-3 flex items-center gap-2 text-sm text-slate-400">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          {item.municipio ? `${item.municipio}, ` : ""}{item.provincia ?? "Angola"}
                        </div>
                      </div>

                      {skills.length > 0 ? (
                        <div className="mt-6 flex flex-wrap gap-2">
                          {skills.slice(0, 5).map((skill) => (
                            <button
                              key={`${item.aluno_id}-${skill}`} 
                              onClick={() => handleSkillClick(skill)}
                              className="rounded-xl bg-slate-900 px-3 py-1.5 text-[10px] font-bold text-slate-300 border border-white/5 transition-colors hover:border-white/20 hover:bg-slate-800"
                            >
                              {skill}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-6 h-8" />
                      )}

                      <div className="mt-8 flex flex-col gap-3 border-t border-white/5 pt-6 text-white">
                        <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                          <span className="text-slate-500">Privacidade</span>
                          <span className="text-emerald-500 flex items-center gap-1.5 text-white">
                            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)] text-white" />
                            Handshake Disponível
                          </span>
                        </div>
                        
                        <Link 
                          href="/login"
                          className="w-full rounded-2xl bg-white/5 py-4 text-center text-xs font-black uppercase tracking-widest text-white transition-all hover:bg-white/10 active:scale-[0.98] border border-white/5"
                        >
                          SOLICITAR ENTREVISTA
                        </Link>
                      </div>

                      {scope === "global" && (
                        <div className="mt-4 text-center">
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-700 italic">
                            Fonte: {item.escola_nome}
                          </p>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-3xl border border-white/10 bg-white/5 p-12 text-center backdrop-blur-xl">
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-white/5 text-slate-500">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-white">Nenhum talento encontrado</h3>
                <p className="mt-2 text-slate-400">Tente ajustar os filtros ou pesquisar por termos mais genéricos.</p>
                {scope === "local" && globalCount > localCount && (
                  <button
                    onClick={() => { setScope("global"); void load("global", query); }}
                    className="mt-8 rounded-2xl bg-white px-8 py-3 text-sm font-black text-slate-950 transition-all hover:brightness-110 active:scale-[0.95]"
                  >
                    PESQUISAR NA REDE GLOBAL ({globalCount})
                  </button>
                )}
              </div>
            )
          ) : null}

          {!loading && !error && authState === "checking" ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-slate-300">
              A validar sessão...
            </div>
          ) : null}

          {!loading && !error && authState === "anonymous" ? (
            <B2BJoinForm
              slug={slug}
              partnerName={payload?.partner?.nome ?? "instituição parceira"}
              brandColor={payload?.partner?.cor_primaria}
              onCompleted={() => {
                setAuthState("authenticated");
                void load(scope, query);
              }}
            />
          ) : null}
        </section>

        {showUpsell && authState === "authenticated" ? (
          <section className="mt-6 rounded-2xl border border-amber-300/30 bg-gradient-to-r from-amber-500/15 to-yellow-500/5 p-5">
            <p className="text-sm font-semibold text-amber-100">
              Não encontrou o que procurava? O KLASSE tem mais {Math.max(globalCount - localCount, 0)} talentos noutras instituições.
            </p>
            <button
              type="button"
              onClick={() => {
                setScope("global");
                void load("global", query);
              }}
              className="mt-3 rounded-xl bg-amber-500 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-amber-400"
            >
              Pesquisar na Rede Global
            </button>
          </section>
        ) : null}

        {authState === "authenticated" ? (
          <div className="mt-10 flex justify-center">
            <Link href="/login" className="rounded-full border border-white/20 px-5 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10">
              Entrar no Portal Empresarial
            </Link>
          </div>
        ) : null}
      </main>
    </div>
  );
}
