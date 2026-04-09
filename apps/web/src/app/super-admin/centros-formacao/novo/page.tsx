"use client";

import { type ReactNode, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import AuditPageView from "@/components/audit/AuditPageView";
import { Button } from "@/components/ui/Button";

type PapelEquipe = "formacao_admin" | "formacao_secretaria" | "formacao_financeiro" | "formador";

type TeamMember = {
  nome: string;
  email: string;
  telefone: string;
  papel: PapelEquipe;
};

function normalizeOptionalEmail(value: string): string | null {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : null;
}

type CentroFormData = {
  centro: {
    nome: string;
    abrev: string;
    morada: string;
    municipio: string;
    provincia: string;
    telefone: string;
    email: string;
    website: string;
  };
  fiscal: {
    nipc: string;
    nif: string;
    registo_maptess: string;
    regime_iva: "normal" | "simplificado" | "isento";
    moeda: string;
  };
  perfil_formacao: {
    areas_formacao: string;
    modalidades: Array<"presencial" | "online" | "hibrido">;
    capacidade_max: string;
    plano: "basic" | "pro" | "enterprise";
  };
  equipe_inicial: TeamMember[];
  notas_admin: string;
};

const STEP_TITLES = [
  "Dados do Centro",
  "Dados Fiscais",
  "Perfil de Formação",
  "Equipa Inicial",
  "Confirmar Provisionamento",
];

const EMPTY_MEMBER: TeamMember = {
  nome: "",
  email: "",
  telefone: "",
  papel: "formacao_secretaria",
};

export default function NovoCentroFormacaoPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<
    | {
        escolaId: string;
        provisionados: Array<{ email: string; papel: string; tempPassword: string | null }>;
      }
    | null
  >(null);

  const [form, setForm] = useState<CentroFormData>({
    centro: {
      nome: "",
      abrev: "",
      morada: "",
      municipio: "",
      provincia: "Luanda",
      telefone: "",
      email: "",
      website: "",
    },
    fiscal: {
      nipc: "",
      nif: "",
      registo_maptess: "",
      regime_iva: "normal",
      moeda: "AOA",
    },
    perfil_formacao: {
      areas_formacao: "",
      modalidades: ["presencial"],
      capacidade_max: "",
      plano: "basic",
    },
    equipe_inicial: [
      { nome: "", email: "", telefone: "", papel: "formacao_admin" },
      { ...EMPTY_MEMBER },
    ],
    notas_admin: "",
  });

  const parsedAreas = useMemo(() => {
    return form.perfil_formacao.areas_formacao
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
  }, [form.perfil_formacao.areas_formacao]);

  const canNext = useMemo(() => {
    if (step === 1) {
      return form.centro.nome.trim().length >= 2;
    }
    if (step === 2) {
      return true;
    }
    if (step === 3) {
      return parsedAreas.length > 0 && form.perfil_formacao.modalidades.length > 0;
    }
    if (step === 4) {
      const validMembers = form.equipe_inicial.filter(
        (member) => member.nome.trim().length >= 2 && /.+@.+\..+/.test(member.email.trim())
      );
      const hasAdmin = validMembers.some((member) => member.papel === "formacao_admin");
      const hasSecretaria = validMembers.some((member) => member.papel === "formacao_secretaria");
      return validMembers.length >= 2 && hasAdmin && hasSecretaria;
    }
    return true;
  }, [step, form, parsedAreas.length]);

  const updateMember = (index: number, patch: Partial<TeamMember>) => {
    setForm((prev) => {
      const copy = [...prev.equipe_inicial];
      copy[index] = { ...copy[index], ...patch };
      return { ...prev, equipe_inicial: copy };
    });
  };

  const addMember = () => {
    setForm((prev) => ({ ...prev, equipe_inicial: [...prev.equipe_inicial, { ...EMPTY_MEMBER }] }));
  };

  const removeMember = (index: number) => {
    setForm((prev) => {
      if (prev.equipe_inicial.length <= 2) return prev;
      return {
        ...prev,
        equipe_inicial: prev.equipe_inicial.filter((_, current) => current !== index),
      };
    });
  };

  const toggleModalidade = (modalidade: "presencial" | "online" | "hibrido") => {
    setForm((prev) => {
      const current = prev.perfil_formacao.modalidades;
      const exists = current.includes(modalidade);
      const next = exists ? current.filter((item) => item !== modalidade) : [...current, modalidade];
      return {
        ...prev,
        perfil_formacao: {
          ...prev.perfil_formacao,
          modalidades: next.length > 0 ? next : ["presencial"],
        },
      };
    });
  };

  const submit = async () => {
    try {
      setLoading(true);
      setResult(null);

      const payload = {
        centro: {
          ...form.centro,
          abrev: form.centro.abrev || null,
          morada: form.centro.morada || null,
          municipio: form.centro.municipio || null,
          provincia: form.centro.provincia || null,
          telefone: form.centro.telefone || null,
          email: normalizeOptionalEmail(form.centro.email),
          website: form.centro.website || null,
        },
        fiscal: {
          ...form.fiscal,
          nipc: form.fiscal.nipc || null,
          nif: form.fiscal.nif || null,
          registo_maptess: form.fiscal.registo_maptess || null,
        },
        perfil_formacao: {
          areas_formacao: parsedAreas,
          modalidades: form.perfil_formacao.modalidades,
          capacidade_max: form.perfil_formacao.capacidade_max
            ? Number(form.perfil_formacao.capacidade_max)
            : null,
          plano: form.perfil_formacao.plano,
        },
        equipe_inicial: form.equipe_inicial.map((member) => ({
          ...member,
          nome: member.nome.trim(),
          email: member.email.trim().toLowerCase(),
          telefone: member.telefone.trim() || null,
        })),
        notas_admin: form.notas_admin || null,
      };

      const res = await fetch("/api/super-admin/centros-formacao/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = (await res.json().catch(() => null)) as
        | {
            ok: boolean;
            error?: string;
            escolaId?: string;
            provisionados?: Array<{ email: string; papel: string; tempPassword: string | null }>;
          }
        | null;

      if (!res.ok || !json?.ok || !json.escolaId) {
        throw new Error(json?.error || "Falha ao provisionar centro");
      }

      setResult({
        escolaId: json.escolaId,
        provisionados: json.provisionados ?? [],
      });
      toast.success("Centro provisionado com sucesso");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6">
      <AuditPageView portal="super_admin" acao="PAGE_VIEW" entity="centros_formacao_create" />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Novo Centro de Formação</h1>
          <p className="text-sm text-slate-500">Wizard em 5 passos com provisionamento inicial da equipa.</p>
        </div>
        <Button variant="secondary" asChild>
          <Link href="/super-admin/centros-formacao">Voltar à listagem</Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-5">
        {STEP_TITLES.map((title, index) => {
          const number = index + 1;
          const active = number === step;
          const done = number < step;
          return (
            <div key={title} className="flex items-center gap-3">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                  active
                    ? "bg-klasse-green text-white"
                    : done
                    ? "bg-emerald-500 text-white"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {number}
              </div>
              <p className={`text-xs font-semibold ${active ? "text-klasse-green" : "text-slate-500"}`}>
                {title}
              </p>
            </div>
          );
        })}
      </div>

      <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-5">
        {step === 1 ? (
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Nome do centro *">
              <input
                value={form.centro.nome}
                onChange={(event) => setForm((prev) => ({ ...prev, centro: { ...prev.centro, nome: event.target.value } }))}
                className={INPUT_CLASS}
              />
            </Field>
            <Field label="Abreviatura">
              <input
                value={form.centro.abrev}
                onChange={(event) => setForm((prev) => ({ ...prev, centro: { ...prev.centro, abrev: event.target.value } }))}
                className={INPUT_CLASS}
              />
            </Field>
            <Field label="Morada">
              <input
                value={form.centro.morada}
                onChange={(event) => setForm((prev) => ({ ...prev, centro: { ...prev.centro, morada: event.target.value } }))}
                className={INPUT_CLASS}
              />
            </Field>
            <Field label="Município">
              <input
                value={form.centro.municipio}
                onChange={(event) => setForm((prev) => ({ ...prev, centro: { ...prev.centro, municipio: event.target.value } }))}
                className={INPUT_CLASS}
              />
            </Field>
            <Field label="Província">
              <input
                value={form.centro.provincia}
                onChange={(event) => setForm((prev) => ({ ...prev, centro: { ...prev.centro, provincia: event.target.value } }))}
                className={INPUT_CLASS}
              />
            </Field>
            <Field label="Telefone">
              <input
                value={form.centro.telefone}
                onChange={(event) => setForm((prev) => ({ ...prev, centro: { ...prev.centro, telefone: event.target.value } }))}
                className={INPUT_CLASS}
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                value={form.centro.email}
                onChange={(event) => setForm((prev) => ({ ...prev, centro: { ...prev.centro, email: event.target.value } }))}
                className={INPUT_CLASS}
              />
            </Field>
            <Field label="Website">
              <input
                value={form.centro.website}
                onChange={(event) => setForm((prev) => ({ ...prev, centro: { ...prev.centro, website: event.target.value } }))}
                className={INPUT_CLASS}
              />
            </Field>
          </section>
        ) : null}

        {step === 2 ? (
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="NIPC">
              <input
                value={form.fiscal.nipc}
                onChange={(event) => setForm((prev) => ({ ...prev, fiscal: { ...prev.fiscal, nipc: event.target.value } }))}
                className={INPUT_CLASS}
              />
            </Field>
            <Field label="NIF">
              <input
                value={form.fiscal.nif}
                onChange={(event) => setForm((prev) => ({ ...prev, fiscal: { ...prev.fiscal, nif: event.target.value } }))}
                className={INPUT_CLASS}
              />
            </Field>
            <Field label="Registo MAPTESS">
              <input
                value={form.fiscal.registo_maptess}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, fiscal: { ...prev.fiscal, registo_maptess: event.target.value } }))
                }
                className={INPUT_CLASS}
              />
            </Field>
            <Field label="Regime IVA">
              <select
                value={form.fiscal.regime_iva}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    fiscal: {
                      ...prev.fiscal,
                      regime_iva: event.target.value as "normal" | "simplificado" | "isento",
                    },
                  }))
                }
                className={INPUT_CLASS}
              >
                <option value="normal">Normal</option>
                <option value="simplificado">Simplificado</option>
                <option value="isento">Isento</option>
              </select>
            </Field>
          </section>
        ) : null}

        {step === 3 ? (
          <section className="space-y-4">
            <Field label="Áreas de formação (separadas por vírgula) *">
              <input
                value={form.perfil_formacao.areas_formacao}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    perfil_formacao: { ...prev.perfil_formacao, areas_formacao: event.target.value },
                  }))
                }
                placeholder="TI, Gestão, Saúde"
                className={INPUT_CLASS}
              />
            </Field>

            <Field label="Modalidades *">
              <div className="flex flex-wrap gap-2">
                {(["presencial", "online", "hibrido"] as const).map((modalidade) => {
                  const selected = form.perfil_formacao.modalidades.includes(modalidade);
                  return (
                    <button
                      key={modalidade}
                      type="button"
                      onClick={() => toggleModalidade(modalidade)}
                      className={`rounded-full border px-3 py-1.5 text-sm ${
                        selected
                          ? "border-klasse-green bg-klasse-green text-white"
                          : "border-slate-300 bg-white text-slate-700"
                      }`}
                    >
                      {modalidade}
                    </button>
                  );
                })}
              </div>
            </Field>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Capacidade máxima">
                <input
                  type="number"
                  min={1}
                  value={form.perfil_formacao.capacidade_max}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      perfil_formacao: { ...prev.perfil_formacao, capacidade_max: event.target.value },
                    }))
                  }
                  className={INPUT_CLASS}
                />
              </Field>
              <Field label="Plano">
                <select
                  value={form.perfil_formacao.plano}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      perfil_formacao: {
                        ...prev.perfil_formacao,
                        plano: event.target.value as "basic" | "pro" | "enterprise",
                      },
                    }))
                  }
                  className={INPUT_CLASS}
                >
                  <option value="basic">Basic</option>
                  <option value="pro">Pro</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </Field>
            </div>
          </section>
        ) : null}

        {step === 4 ? (
          <section className="space-y-4">
            {form.equipe_inicial.map((member, index) => (
              <div key={index} className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 p-3 md:grid-cols-4">
                <input
                  value={member.nome}
                  onChange={(event) => updateMember(index, { nome: event.target.value })}
                  placeholder="Nome"
                  className={INPUT_CLASS}
                />
                <input
                  value={member.email}
                  onChange={(event) => updateMember(index, { email: event.target.value })}
                  placeholder="Email"
                  className={INPUT_CLASS}
                />
                <input
                  value={member.telefone}
                  onChange={(event) => updateMember(index, { telefone: event.target.value })}
                  placeholder="Telefone"
                  className={INPUT_CLASS}
                />
                <div className="flex gap-2">
                  <select
                    value={member.papel}
                    onChange={(event) => updateMember(index, { papel: event.target.value as PapelEquipe })}
                    className={INPUT_CLASS}
                  >
                    <option value="formacao_admin">admin_centro</option>
                    <option value="formacao_secretaria">secretaria_centro</option>
                    <option value="formacao_financeiro">financeiro_centro</option>
                    <option value="formador">formador</option>
                  </select>
                  <Button type="button" variant="secondary" onClick={() => removeMember(index)}>
                    Remover
                  </Button>
                </div>
              </div>
            ))}

            <Button type="button" variant="secondary" onClick={addMember}>
              Adicionar membro
            </Button>

            <p className="text-xs text-slate-500">
              Obrigatório: pelo menos 1 `admin_centro` e 1 `secretaria_centro`.
            </p>
          </section>
        ) : null}

        {step === 5 ? (
          <section className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p>
                Vai provisionar o centro <strong>{form.centro.nome}</strong> com{" "}
                <strong>{form.equipe_inicial.length}</strong> utilizadores iniciais.
              </p>
              <p className="mt-1">
                Áreas: {parsedAreas.join(", ")} · Modalidades: {form.perfil_formacao.modalidades.join(", ")}
              </p>
            </div>

            <Field label="Notas administrativas (opcional)">
              <textarea
                value={form.notas_admin}
                onChange={(event) => setForm((prev) => ({ ...prev, notas_admin: event.target.value }))}
                className={INPUT_CLASS}
                rows={4}
              />
            </Field>

            {result ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-sm font-semibold text-emerald-900">Provisionamento concluído com sucesso.</p>
                <p className="mt-1 text-sm text-emerald-900">Escola/Tenant ID: {result.escolaId}</p>
                <div className="mt-3 space-y-1 text-sm text-slate-700">
                  {result.provisionados.map((member) => (
                    <p key={`${member.email}-${member.papel}`}>
                      {member.email} ({member.papel})
                      {member.tempPassword ? ` · senha temporária: ${member.tempPassword}` : " · utilizador existente"}
                    </p>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="flex gap-2">
              <Button onClick={() => router.push("/super-admin/centros-formacao")}>Ir para listagem</Button>
              <Button
                variant="secondary"
                onClick={() => {
                  router.refresh();
                  setResult(null);
                }}
              >
                Limpar resultado
              </Button>
            </div>
          </section>
        ) : null}
      </div>

      <div className="flex items-center justify-between">
        <Button type="button" variant="secondary" onClick={() => setStep((prev) => Math.max(1, prev - 1))}>
          Anterior
        </Button>
        <div className="flex gap-2">
          {step < 5 ? (
            <Button type="button" disabled={!canNext} onClick={() => setStep((prev) => Math.min(5, prev + 1))}>
              Próximo
            </Button>
          ) : (
            <Button type="button" disabled={loading || Boolean(result)} onClick={submit}>
              {loading ? "Provisionando..." : result ? "Provisionado" : "Provisionar centro"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

const INPUT_CLASS =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-klasse-green";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-1.5 text-sm">
      <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  );
}
