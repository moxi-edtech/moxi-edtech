"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useToast } from "@/components/feedback/FeedbackSystem";
import { DashboardHeader } from "@/components/layout/DashboardHeader";

type DisciplinaItem = { id: string; nome: string };

type ProfilePayload = {
  nome_completo: string | null;
  email: string | null;
  bio: string | null;
  naturalidade: string | null;
  provincia: string | null;
  genero: string | null;
  data_nascimento: string | null;
  numero_bi: string | null;
  telefone_principal: string | null;
  carga_horaria_maxima: number | null;
  turnos_disponiveis: Array<"Manhã" | "Tarde" | "Noite">;
  habilitacoes: string | null;
  area_formacao: string | null;
  vinculo_contratual: string | null;
  disciplinas_habilitadas: string[];
};

export default function ProfessorPerfilPage() {
  const routeParams = useParams<{ id?: string }>();
  const schoolParam = typeof routeParams?.id === "string" ? routeParams.id : null;
  const endpoint = schoolParam
    ? `/api/professor/profile?escola_id=${encodeURIComponent(schoolParam)}`
    : "/api/professor/profile";
  const [loading, setLoading] = useState(true);
  const [disciplinas, setDisciplinas] = useState<DisciplinaItem[]>([]);
  const { success, error } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ProfilePayload>({
    nome_completo: null,
    email: null,
    bio: null,
    naturalidade: null,
    provincia: null,
    genero: null,
    data_nascimento: null,
    numero_bi: null,
    telefone_principal: "",
    carga_horaria_maxima: 24,
    turnos_disponiveis: [],
    habilitacoes: "Licenciatura",
    area_formacao: "",
    vinculo_contratual: "Efetivo",
    disciplinas_habilitadas: [],
  });

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      const res = await fetch(endpoint, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!active) return;
      if (res.ok && json?.ok) {
        setForm(json.profile);
        setDisciplinas(json.disciplinas || []);
      } else {
        error(json?.error || "Falha ao carregar perfil");
      }
      setLoading(false);
    };
    load();
    return () => {
      active = false;
    };
  }, [endpoint]);

  const savePersonal = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telefone_principal: form.telefone_principal || null,
          bio: form.bio || null,
          naturalidade: form.naturalidade || null,
          provincia: form.provincia || null,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) throw new Error(data?.error || "Falha ao guardar os dados");
      setForm((previous) => ({ ...previous, ...data.profile }));
      success("Dados pessoais guardados.");
    } catch (cause) {
      error(cause instanceof Error ? cause.message : "Falha ao guardar os dados");
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/20";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full min-w-0 max-w-6xl space-y-6 md:p-6">
        <div>
          <DashboardHeader
            title="Perfil do Professor"
            description="Consulte o cadastro e atualize os seus contactos pessoais."
            breadcrumbs={[
              { label: "Início", href: "/" },
              { label: "Professor", href: "/professor" },
              { label: "Perfil" },
            ]}
          />
        </div>

        {loading ? (
          <div className="rounded-xl border border-border bg-card p-3 sm:p-4 animate-pulse space-y-2">
            <div className="h-4 w-40 rounded-md bg-muted" />
            <div className="h-3 w-full rounded-md bg-muted" />
            <div className="h-3 w-5/6 rounded-md bg-muted" />
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
            <section className="rounded-xl border border-border bg-card p-5 space-y-4">
              <div className="text-sm font-semibold text-foreground">Dados pessoais</div>
              <div className="grid gap-3 md:grid-cols-2 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Nome completo</div>
                  <div className="text-sm font-semibold text-foreground">{form.nome_completo || "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">BI</div>
                  <div className="text-sm font-semibold text-foreground">{form.numero_bi || "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Gênero</div>
                  <div className="text-sm font-semibold text-foreground">{form.genero || "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Nascimento</div>
                  <div className="text-sm font-semibold text-foreground">{form.data_nascimento || "—"}</div>
                </div>
              </div>
              <div className="space-y-3 border-t border-border pt-4">
                <p className="text-sm font-semibold text-foreground">Pode atualizar</p>
                <label className="block space-y-1">
                  <span className="text-xs text-muted-foreground">Telefone</span>
                  <input className={inputClass} type="tel" maxLength={40} value={form.telefone_principal || ""}
                    onChange={(event) => setForm((previous) => ({ ...previous, telefone_principal: event.target.value }))} />
                </label>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="block space-y-1">
                    <span className="text-xs text-muted-foreground">Naturalidade</span>
                    <input className={inputClass} maxLength={120} value={form.naturalidade || ""}
                      onChange={(event) => setForm((previous) => ({ ...previous, naturalidade: event.target.value }))} />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs text-muted-foreground">Província</span>
                    <input className={inputClass} maxLength={120} value={form.provincia || ""}
                      onChange={(event) => setForm((previous) => ({ ...previous, provincia: event.target.value }))} />
                  </label>
                </div>
                <label className="block space-y-1">
                  <span className="text-xs text-muted-foreground">Apresentação pessoal</span>
                  <textarea className={inputClass} rows={3} maxLength={1000} value={form.bio || ""}
                    onChange={(event) => setForm((previous) => ({ ...previous, bio: event.target.value }))} />
                </label>
                <div className="text-xs text-muted-foreground">E-mail de acesso: {form.email || "—"}. Para alterá-lo, contacte a gestão da escola. Nome, BI e vínculo são validados pela escola.</div>
                <button type="button" disabled={saving} onClick={savePersonal}
                  className="min-h-11 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:brightness-95 disabled:opacity-60">
                  {saving ? "A guardar…" : "Guardar os meus dados"}
                </button>
              </div>
            </section>

            <section className="rounded-xl border border-border bg-card p-5 space-y-4">
              <div className="text-sm font-semibold text-foreground">Disponibilidade</div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <div className="text-xs text-muted-foreground">Carga horária máxima</div>
                  <div className="text-sm font-semibold text-foreground">
                    {form.carga_horaria_maxima ?? "—"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Turnos disponíveis</div>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {form.turnos_disponiveis.length > 0 ? (
                      form.turnos_disponiveis.map((turno) => (
                        <span
                          key={turno}
                          className="rounded-full border border-primary/20 bg-accent px-3 py-1 text-xs font-medium text-accent-foreground"
                        >
                          {turno}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Habilitações</div>
                  <div className="text-sm font-semibold text-foreground">{form.habilitacoes || "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Vínculo contratual</div>
                  <div className="text-sm font-semibold text-foreground">{form.vinculo_contratual || "—"}</div>
                </div>
                <div className="md:col-span-2">
                  <div className="text-xs text-muted-foreground">Área de formação</div>
                  <div className="text-sm font-semibold text-foreground">{form.area_formacao || "—"}</div>
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-border bg-card p-5 space-y-4 lg:col-span-2">
              <div className="text-sm font-semibold text-foreground">Disciplinas habilitadas</div>
              <div className="flex flex-wrap gap-2 text-sm">
                {form.disciplinas_habilitadas.length > 0 ? (
                  disciplinas
                    .filter((disc) => form.disciplinas_habilitadas.includes(disc.id))
                    .map((disc) => (
                      <span
                        key={disc.id}
                        className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground"
                      >
                        {disc.nome}
                      </span>
                    ))
                ) : (
                  <span className="text-sm text-muted-foreground">—</span>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
