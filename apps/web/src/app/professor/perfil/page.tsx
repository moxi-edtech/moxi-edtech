"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/feedback/FeedbackSystem";
import { DashboardHeader } from "@/components/layout/DashboardHeader";

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
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div>
          <DashboardHeader
            title="Perfil do Professor"
            description="Consulte seus dados e disponibilidade cadastrados."
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
              <div>
                <div className="text-xs text-muted-foreground">Telefone</div>
                <div className="text-sm font-semibold text-foreground">{form.telefone_principal || "—"}</div>
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
                          className="rounded-full border border-amber/40 bg-amber/10 px-3 py-1 text-xs font-semibold text-foreground"
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
