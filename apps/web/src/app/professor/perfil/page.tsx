"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/feedback/FeedbackSystem";

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
  const [disciplinas, setDisciplinas] = useState<DisciplinaItem[]>([]);
  const { error } = useToast();
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
        error(json?.error || "Falha ao carregar perfil");
      }
      setLoading(false);
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-klasse-green">Perfil do professor</h1>
          <p className="text-sm text-slate-500">Consulte seus dados e disponibilidade cadastrados.</p>
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
                <div className="text-xs text-slate-500">Telefone</div>
                <div className="text-sm font-semibold text-slate-900">{form.telefone_principal || "—"}</div>
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
              <div className="text-sm font-semibold text-slate-900">Disponibilidade</div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <div className="text-xs text-slate-500">Carga horária máxima</div>
                  <div className="text-sm font-semibold text-slate-900">
                    {form.carga_horaria_maxima ?? "—"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Turnos disponíveis</div>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {form.turnos_disponiveis.length > 0 ? (
                      form.turnos_disponiveis.map((turno) => (
                        <span
                          key={turno}
                          className="rounded-full border border-klasse-gold bg-klasse-gold/10 px-3 py-1 text-xs font-semibold text-klasse-gold"
                        >
                          {turno}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-slate-500">—</span>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Habilitações</div>
                  <div className="text-sm font-semibold text-slate-900">{form.habilitacoes || "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Vínculo contratual</div>
                  <div className="text-sm font-semibold text-slate-900">{form.vinculo_contratual || "—"}</div>
                </div>
                <div className="md:col-span-2">
                  <div className="text-xs text-slate-500">Área de formação</div>
                  <div className="text-sm font-semibold text-slate-900">{form.area_formacao || "—"}</div>
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 lg:col-span-2">
              <div className="text-sm font-semibold text-slate-900">Disciplinas habilitadas</div>
              <div className="flex flex-wrap gap-2 text-sm">
                {form.disciplinas_habilitadas.length > 0 ? (
                  disciplinas
                    .filter((disc) => form.disciplinas_habilitadas.includes(disc.id))
                    .map((disc) => (
                      <span
                        key={disc.id}
                        className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600"
                      >
                        {disc.nome}
                      </span>
                    ))
                ) : (
                  <span className="text-sm text-slate-500">—</span>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
