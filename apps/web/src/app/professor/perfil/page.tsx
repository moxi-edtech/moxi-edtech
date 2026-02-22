"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

type DisciplinaItem = { id: string; nome: string };

type ProfilePayload = {
  nome_completo: string | null;
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [disciplinas, setDisciplinas] = useState<DisciplinaItem[]>([]);
  const [form, setForm] = useState<ProfilePayload>({
    nome_completo: null,
    genero: null,
    data_nascimento: null,
    numero_bi: null,
    telefone_principal: "",
    carga_horaria_maxima: 20,
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
      const res = await fetch("/api/professor/profile", { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!active) return;
      if (res.ok && json?.ok) {
        setForm(json.profile);
        setDisciplinas(json.disciplinas || []);
      } else {
        toast.error(json?.error || "Falha ao carregar perfil");
      }
      setLoading(false);
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const toggleTurno = (turno: "Manhã" | "Tarde" | "Noite") => {
    setForm((prev) => {
      const next = new Set(prev.turnos_disponiveis);
      if (next.has(turno)) next.delete(turno);
      else next.add(turno);
      return { ...prev, turnos_disponiveis: Array.from(next) };
    });
  };

  const toggleDisciplina = (id: string) => {
    setForm((prev) => {
      const next = new Set(prev.disciplinas_habilitadas);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...prev, disciplinas_habilitadas: Array.from(next) };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/professor/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telefone_principal: form.telefone_principal,
          carga_horaria_maxima: Number(form.carga_horaria_maxima),
          turnos_disponiveis: form.turnos_disponiveis,
          habilitacoes: form.habilitacoes,
          area_formacao: form.area_formacao,
          vinculo_contratual: form.vinculo_contratual,
          disciplinas_habilitadas: form.disciplinas_habilitadas,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Falha ao salvar perfil");
      toast.success("Perfil atualizado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar perfil");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-klasse-green">Perfil do professor</h1>
          <p className="text-sm text-slate-500">Atualize seus dados e disponibilidade.</p>
        </div>

        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">Carregando perfil...</div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
            <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
              <div className="text-sm font-semibold text-slate-900">Dados pessoais</div>
              <div className="grid gap-3 md:grid-cols-2 text-sm">
                <div>
                  <div className="text-xs text-slate-500">Nome completo</div>
                  <div className="text-sm font-semibold text-slate-900">{form.nome_completo || "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">BI</div>
                  <div className="text-sm font-semibold text-slate-900">{form.numero_bi || "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Gênero</div>
                  <div className="text-sm font-semibold text-slate-900">{form.genero || "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Nascimento</div>
                  <div className="text-sm font-semibold text-slate-900">{form.data_nascimento || "—"}</div>
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500">Telefone</label>
                <input
                  type="tel"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/20"
                  value={form.telefone_principal || ""}
                  onChange={(e) => setForm((prev) => ({ ...prev, telefone_principal: e.target.value }))}
                />
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
              <div className="text-sm font-semibold text-slate-900">Disponibilidade</div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="text-xs text-slate-500">Carga horária máxima</label>
                  <input
                    type="number"
                    min={1}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/20"
                    value={form.carga_horaria_maxima || 0}
                    onChange={(e) => setForm((prev) => ({ ...prev, carga_horaria_maxima: Number(e.target.value) }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500">Turnos disponíveis</label>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {(["Manhã", "Tarde", "Noite"] as const).map((turno) => (
                      <button
                        key={turno}
                        type="button"
                        onClick={() => toggleTurno(turno)}
                        className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                          form.turnos_disponiveis.includes(turno)
                            ? "border-klasse-gold bg-klasse-gold/10 text-klasse-gold"
                            : "border-slate-200 text-slate-500"
                        }`}
                      >
                        {turno}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-500">Habilitações</label>
                  <select
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/20"
                    value={form.habilitacoes || "Licenciatura"}
                    onChange={(e) => setForm((prev) => ({ ...prev, habilitacoes: e.target.value }))}
                  >
                    {[
                      "Ensino Médio",
                      "Bacharelato",
                      "Licenciatura",
                      "Mestrado",
                      "Doutoramento",
                    ].map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500">Vínculo contratual</label>
                  <select
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/20"
                    value={form.vinculo_contratual || "Efetivo"}
                    onChange={(e) => setForm((prev) => ({ ...prev, vinculo_contratual: e.target.value }))}
                  >
                    {["Efetivo", "Colaborador", "Eventual"].map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs text-slate-500">Área de formação</label>
                  <input
                    type="text"
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/20"
                    value={form.area_formacao || ""}
                    onChange={(e) => setForm((prev) => ({ ...prev, area_formacao: e.target.value }))}
                  />
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 lg:col-span-2">
              <div className="text-sm font-semibold text-slate-900">Disciplinas habilitadas</div>
              <div className="grid gap-2 md:grid-cols-3">
                {disciplinas.map((disc) => (
                  <label key={disc.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.disciplinas_habilitadas.includes(disc.id)}
                      onChange={() => toggleDisciplina(disc.id)}
                    />
                    <span>{disc.nome}</span>
                  </label>
                ))}
              </div>
            </section>

            <div className="lg:col-span-2 flex justify-end">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-xl bg-klasse-gold px-4 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-60"
              >
                {saving ? "Salvando..." : "Salvar alterações"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
