"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type TalentProfile = {
  id: string;
  is_open_to_work: boolean;
  career_headline: string | null;
  provincia: string | null;
  municipio: string | null;
  preferencia_trabalho: string | null;
  anonymous_slug: string | null;
  skills_tags: string[];
  eligible_for_opt_in: boolean;
  highest_media: number | null;
  pending_matches_count: number;
};

type MatchItem = {
  id: string;
  empresa_id: string;
  empresa_label: string;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
};

function statusLabel(status: MatchItem["status"]): string {
  if (status === "accepted") return "Aceite";
  if (status === "rejected") return "Recusado";
  return "Pendente";
}

export function CarreiraHubClient() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [profile, setProfile] = useState<TalentProfile | null>(null);
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [openPrompt, setOpenPrompt] = useState(false);
  const [form, setForm] = useState({
    is_open_to_work: false,
    career_headline: "",
    provincia: "",
    municipio: "",
    preferencia_trabalho: "",
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setMessage(null);

    try {
      const [profileRes, matchesRes] = await Promise.all([
        fetch("/api/formacao/talent-pool/profile", { cache: "no-store" }),
        fetch("/api/formacao/talent-pool/matches", { cache: "no-store" }),
      ]);

      const profileJson = await profileRes.json();
      const matchesJson = await matchesRes.json();

      if (!profileRes.ok || !profileJson?.ok) {
        throw new Error(String(profileJson?.error ?? "Falha ao carregar perfil de carreira"));
      }
      if (!matchesRes.ok || !matchesJson?.ok) {
        throw new Error(String(matchesJson?.error ?? "Falha ao carregar pedidos"));
      }

      const nextProfile = profileJson.profile as TalentProfile;
      const nextMatches = (matchesJson.items ?? []) as MatchItem[];

      setProfile(nextProfile);
      setMatches(nextMatches);
      setForm({
        is_open_to_work: Boolean(nextProfile.is_open_to_work),
        career_headline: String(nextProfile.career_headline ?? ""),
        provincia: String(nextProfile.provincia ?? ""),
        municipio: String(nextProfile.municipio ?? ""),
        preferencia_trabalho: String(nextProfile.preferencia_trabalho ?? ""),
      });

      const shouldOpenPrompt = nextProfile.eligible_for_opt_in && !nextProfile.is_open_to_work;
      setOpenPrompt(shouldOpenPrompt);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro inesperado ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const pendingCount = useMemo(() => matches.filter((m) => m.status === "pending").length, [matches]);

  async function saveProfile() {
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/formacao/talent-pool/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(String(json?.error ?? "Nao foi possivel guardar o perfil"));
      }

      setMessage("Perfil de carreira atualizado com sucesso.");
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro inesperado ao guardar");
    } finally {
      setSaving(false);
    }
  }

  async function replyMatch(id: string, status: "accepted" | "rejected") {
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/formacao/talent-pool/matches", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(String(json?.error ?? "Nao foi possivel responder ao pedido"));
      }

      setMessage(status === "accepted" ? "Partilha de contactos aceite." : "Pedido recusado.");
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro inesperado ao responder");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-500">A carregar carreira...</div>;
  }

  if (!profile) {
    return <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">Perfil do formando nao encontrado.</div>;
  }

  return (
    <>
      <Dialog open={openPrompt} onOpenChange={setOpenPrompt}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Parabens pela media!</DialogTitle>
            <DialogDescription>
              Concluiste com media {profile.highest_media ?? ""}. Queres que o KLASSE recomende o teu perfil anonimo a empresas parceiras?
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-3">
            <label className="block text-xs font-semibold text-slate-700">
              Titulo profissional
              <input
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Ex: Especialista em Power BI"
                value={form.career_headline}
                onChange={(e) => setForm((prev) => ({ ...prev, career_headline: e.target.value }))}
              />
            </label>

            <button
              type="button"
              className="w-full rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              disabled={saving}
              onClick={async () => {
                setForm((prev) => ({ ...prev, is_open_to_work: true }));
                await fetch("/api/formacao/talent-pool/profile", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ ...form, is_open_to_work: true }),
                });
                setOpenPrompt(false);
                await loadData();
              }}
            >
              Quero entrar no Talent Pool
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Aba Carreira</p>
          <h2 className="mt-2 text-2xl font-black text-slate-900">Passaporte Profissional</h2>
          <p className="mt-2 text-sm text-slate-600">
            Perfil anonimo: <span className="font-semibold text-slate-900">{profile.anonymous_slug ?? "ainda nao gerado"}</span>
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setForm((prev) => ({ ...prev, is_open_to_work: !prev.is_open_to_work }))}
              className={`rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wide ${
                form.is_open_to_work ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
              }`}
            >
              {form.is_open_to_work ? "Aberto para oportunidades" : "Fechado para oportunidades"}
            </button>
            <span className="text-xs text-slate-500">Pedidos pendentes: {pendingCount}</span>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <label className="text-xs font-semibold text-slate-700">
              Career headline
              <input
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                value={form.career_headline}
                onChange={(e) => setForm((prev) => ({ ...prev, career_headline: e.target.value }))}
              />
            </label>

            <label className="text-xs font-semibold text-slate-700">
              Preferencia de trabalho
              <input
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                value={form.preferencia_trabalho}
                onChange={(e) => setForm((prev) => ({ ...prev, preferencia_trabalho: e.target.value }))}
              />
            </label>

            <label className="text-xs font-semibold text-slate-700">
              Provincia
              <input
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                value={form.provincia}
                onChange={(e) => setForm((prev) => ({ ...prev, provincia: e.target.value }))}
              />
            </label>

            <label className="text-xs font-semibold text-slate-700">
              Municipio
              <input
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                value={form.municipio}
                onChange={(e) => setForm((prev) => ({ ...prev, municipio: e.target.value }))}
              />
            </label>
          </div>

          <button
            type="button"
            onClick={saveProfile}
            disabled={saving}
            className="mt-5 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Guardar perfil de carreira
          </button>

          {message ? <p className="mt-3 text-sm text-slate-600">{message}</p> : null}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Solicitacoes</p>
          <h3 className="mt-2 text-xl font-black text-slate-900">Pedidos de entrevista</h3>

          <div className="mt-4 space-y-3">
            {matches.length === 0 ? (
              <p className="text-sm text-slate-500">Ainda nao existem pedidos de entrevista.</p>
            ) : (
              matches.map((match) => (
                <article key={match.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{match.empresa_label}</p>
                      <p className="text-xs text-slate-500">{new Date(match.created_at).toLocaleString()}</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      {statusLabel(match.status)}
                    </span>
                  </div>

                  {match.status === "pending" ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                        disabled={saving}
                        onClick={() => void replyMatch(match.id, "accepted")}
                      >
                        Aceitar partilha de contactos
                      </button>
                      <button
                        type="button"
                        className="rounded-xl bg-rose-100 px-3 py-2 text-xs font-semibold text-rose-700 disabled:opacity-50"
                        disabled={saving}
                        onClick={() => void replyMatch(match.id, "rejected")}
                      >
                        Recusar
                      </button>
                    </div>
                  ) : null}
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </>
  );
}
