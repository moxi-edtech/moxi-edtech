"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Clock,
  Shield,
  Award,
  LayoutGrid,
  Scale,
  AlertCircle,
  Check,
  X,
  Trash2,
} from "lucide-react";
import {
  calculateTotalSlots,
  shouldAppearInScheduler,
  type SchedulerDisciplineRulesInput,
} from "@/lib/rules/scheduler-rules";

export type AvaliacaoMode = "inherit_school" | "custom" | "inherit_disciplina";

export type DisciplinaForm = {
  id?: string;
  nome: string;
  codigo: string;
  area?: string | null;
  periodos_ativos: number[];
  periodo_mode: "ano" | "custom";
  carga_horaria_semanal: number;
  classificacao: "core" | "complementar" | "optativa";
  entra_no_horario: boolean;
  avaliacao: {
    mode: AvaliacaoMode;
    base_id?: string | null;
  };
  programa_texto?: string | null;
  class_ids?: string[];
  apply_scope?: "all" | "selected";
  carga_by_class?: Record<string, number | null>;
};

type DisciplineOption = {
  id: string;
  nome: string;
};

type ClassOption = {
  id: string;
  nome: string;
};

type Props = {
  open: boolean;
  mode: "create" | "edit";
  initial?: DisciplinaForm | null;
  existingCodes: string[];
  existingNames: string[];
  existingDisciplines?: DisciplineOption[];
  pendingDisciplines?: DisciplineOption[];
  onSelectPending?: (id: string) => void;
  classOptions?: ClassOption[];
  onClose: () => void;
  onSave: (payload: DisciplinaForm) => Promise<void> | void;
  onDelete?: (id: string) => Promise<void> | void;
};

const emptyDisciplina: DisciplinaForm = {
  nome: "",
  codigo: "",
  area: null,
  periodos_ativos: [1, 2, 3],
  periodo_mode: "ano",
  carga_horaria_semanal: 4,
  classificacao: "core",
  entra_no_horario: true,
  avaliacao: { mode: "inherit_school", base_id: null },
  programa_texto: null,
};

function inferCargaFromName(nome: string) {
  const value = normalizeName(nome).toLowerCase();
  if (value.includes("portugues") || value.includes("língua") || value.includes("lingua")) return 4;
  if (value.includes("matem")) return 4;
  if (value.includes("fisic") || value.includes("quim") || value.includes("biolog")) return 3;
  if (value.includes("hist") || value.includes("geograf") || value.includes("filos") || value.includes("sociol")) return 3;
  if (value.includes("educa") && value.includes("fisic")) return 2;
  if (value.includes("informat") || value.includes("tic") || value.includes("laborat")) return 2;
  return 3;
}

function applyDefaults(payload: DisciplinaForm) {
  return {
    ...payload,
    classificacao: payload.classificacao ?? "core",
    entra_no_horario: payload.entra_no_horario ?? true,
    avaliacao: payload.avaliacao?.mode
      ? payload.avaliacao
      : { mode: "inherit_school", base_id: null },
    periodo_mode: payload.periodo_mode ?? "ano",
    periodos_ativos:
      payload.periodos_ativos && payload.periodos_ativos.length > 0
        ? payload.periodos_ativos
        : [1, 2, 3],
    carga_horaria_semanal:
      payload.carga_horaria_semanal && payload.carga_horaria_semanal > 0
        ? payload.carga_horaria_semanal
        : inferCargaFromName(payload.nome || ""),
  };
}

function normalizeCode(code: string) {
  return code
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "-")
    .replace(/[^A-Z0-9\-_]/g, "");
}

function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

function isValidCode(code: string) {
  return /^[A-Z0-9\-_]{2,12}$/.test(code);
}

export function DisciplinaModal({
  open,
  mode,
  initial,
  existingCodes,
  existingNames,
  existingDisciplines = [],
  pendingDisciplines = [],
  onSelectPending,
  classOptions = [],
  onClose,
  onSave,
  onDelete,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const allClassIds = useMemo(() => classOptions.map((item) => item.id), [classOptions]);
  const [form, setForm] = useState<DisciplinaForm>(() => ({
    ...emptyDisciplina,
    ...initial,
    avaliacao: initial?.avaliacao ?? emptyDisciplina.avaliacao,
    periodos_ativos: initial?.periodos_ativos?.length
      ? initial.periodos_ativos
      : emptyDisciplina.periodos_ativos,
    periodo_mode: initial?.periodo_mode ?? emptyDisciplina.periodo_mode,
  }));
  const [applyScope, setApplyScope] = useState<"all" | "selected">("all");
  const [classIds, setClassIds] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setSaving(false);
    setDeleting(false);
    setForm(
      applyDefaults({
        ...emptyDisciplina,
        ...initial,
        avaliacao: initial?.avaliacao ?? emptyDisciplina.avaliacao,
        periodos_ativos: initial?.periodos_ativos?.length
          ? initial.periodos_ativos
          : emptyDisciplina.periodos_ativos,
        periodo_mode: initial?.periodo_mode ?? emptyDisciplina.periodo_mode,
      })
    );
    const nextClassIds = initial?.class_ids?.length ? initial.class_ids : allClassIds;
    const nextScope =
      allClassIds.length > 0 && nextClassIds.length !== allClassIds.length ? "selected" : "all";
    setApplyScope(nextScope);
    setClassIds(nextClassIds);
  }, [allClassIds, initial, open]);

  const errors = useMemo(() => {
    const nextErrors: Record<string, string> = {};
    const nomeNorm = normalizeName(form.nome);
    const codeNorm = normalizeCode(form.codigo);

    if (nomeNorm.length < 3) nextErrors.nome = "Nome muito curto.";
    if (!isValidCode(codeNorm)) nextErrors.codigo = "Código inválido (2–12, A-Z/0-9/-/_).";

    const codesUpper = existingCodes.map((code) => normalizeCode(code));
    const namesLower = existingNames.map((name) => normalizeName(name).toLowerCase());
    const currentCode = initial?.codigo ? normalizeCode(initial.codigo) : null;
    const currentName = initial?.nome ? normalizeName(initial.nome).toLowerCase() : null;

    const codeCollides =
      codesUpper.includes(codeNorm) && (mode === "create" || codeNorm !== currentCode);
    const nameCollides =
      namesLower.includes(nomeNorm.toLowerCase()) &&
      (mode === "create" || nomeNorm.toLowerCase() !== currentName);

    if (codeCollides) nextErrors.codigo = "Este código já existe no curso.";
    if (nameCollides) nextErrors.nome = "Esta disciplina já existe no curso.";

    if (form.periodo_mode === "custom" && form.periodos_ativos.length === 0) {
      nextErrors.periodos_ativos = "Selecione ao menos um período.";
    }

    if (!Number.isFinite(form.carga_horaria_semanal) || form.carga_horaria_semanal <= 0) {
      nextErrors.carga_horaria_semanal = "Carga semanal deve ser > 0.";
    }

    if (form.avaliacao.mode === "inherit_disciplina" && !form.avaliacao.base_id) {
      nextErrors.avaliacao = "Selecione a disciplina base.";
    }

    if (classOptions.length > 0 && applyScope === "selected" && classIds.length === 0) {
      nextErrors.class_ids = "Selecione ao menos uma classe.";
    }

    return nextErrors;
  }, [applyScope, classIds, classOptions.length, existingCodes, existingNames, form, initial?.codigo, initial?.nome, mode]);

  const canSave = Object.keys(errors).length === 0;
  const totalHorasAno =
    form.carga_horaria_semanal * Math.max(form.periodos_ativos.length, 1) * 12;
  const schedulerRulesInput = useMemo<SchedulerDisciplineRulesInput>(
    () => ({
      entra_no_horario: form.entra_no_horario,
      carga_horaria_semanal: form.carga_horaria_semanal,
    }),
    [form.entra_no_horario, form.carga_horaria_semanal]
  );
  const appearsInScheduler = shouldAppearInScheduler(schedulerRulesInput);
  const totalSlots = calculateTotalSlots(schedulerRulesInput);

  const updateScope = (scope: "all" | "selected") => {
    setApplyScope(scope);
    if (scope === "all") {
      setClassIds(allClassIds);
    }
  };

  const toggleClasse = (classId: string) => {
    setClassIds((prev) => {
      if (prev.includes(classId)) {
        return prev.filter((item) => item !== classId);
      }
      return [...prev, classId];
    });
  };

  const togglePeriodo = (periodo: number) => {
    setForm((prev) => {
      if (prev.periodos_ativos.includes(periodo)) {
        if (prev.periodos_ativos.length === 1) return prev;
        return {
          ...prev,
          periodos_ativos: prev.periodos_ativos.filter((item) => item !== periodo),
        };
      }
      return {
        ...prev,
        periodos_ativos: [...prev.periodos_ativos, periodo].sort(),
      };
    });
  };

  const handleSave = async () => {
    if (!canSave) return;
    const scopedClassIds = applyScope === "all" ? allClassIds : classIds;
    const payload: DisciplinaForm = {
      ...form,
      nome: normalizeName(form.nome),
      codigo: normalizeCode(form.codigo),
      area: form.area?.trim() ? form.area.trim() : null,
      programa_texto: form.programa_texto?.trim() ? form.programa_texto.trim() : null,
      class_ids: classOptions.length > 0 ? scopedClassIds : undefined,
      apply_scope: classOptions.length > 0 ? applyScope : undefined,
    };

    setSaving(true);
    try {
      await onSave(payload);
      setForm((prev) => ({ ...prev, ...payload }));
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete || !initial?.id) return;
    setDeleting(true);
    try {
      await onDelete(initial.id);
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  if (!open) return null;

  const handleAutoFill = () => {
    setForm((prev) => applyDefaults({ ...prev }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-10">
      <div className="w-full max-w-3xl bg-slate-50 rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[80vh]">
        <div className="bg-[#1F6B3B] px-6 py-4 text-white flex justify-between items-start shrink-0">
          <div className="space-y-1">
            <div className="text-[#D7E7DC] text-xs font-bold uppercase tracking-wider">
              {mode === "create" ? "Nova disciplina" : "Configurando Disciplina"}
            </div>
            {mode === "create" ? (
              <div className="space-y-2">
                <input
                  value={form.nome}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, nome: event.target.value }))
                  }
                  placeholder="Nome da disciplina"
                  className="w-full rounded-lg border border-white/30 bg-white/10 px-3 py-2 text-lg font-semibold text-white placeholder:text-white/60 outline-none focus:ring-2 focus:ring-white/40"
                />
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    value={form.codigo}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, codigo: event.target.value }))
                    }
                    placeholder="Sigla"
                    className="w-full sm:w-32 rounded-lg border border-white/30 bg-white/10 px-3 py-2 text-sm font-mono text-white placeholder:text-white/60 outline-none focus:ring-2 focus:ring-white/40"
                  />
                  <input
                    value={form.area ?? ""}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, area: event.target.value }))
                    }
                    placeholder="Área/Departamento"
                    className="flex-1 rounded-lg border border-white/30 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/60 outline-none focus:ring-2 focus:ring-white/40"
                  />
                </div>
                {(errors.nome || errors.codigo) && (
                  <p className="text-xs text-[#FFE7B8]">
                    {errors.nome ?? errors.codigo}
                  </p>
                )}
              </div>
            ) : (
              <>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  {form.nome || "Disciplina"}
                  <span className="px-2 py-0.5 rounded text-sm bg-white/15 text-white font-mono">
                    {form.codigo || "---"}
                  </span>
                </h2>
                <p className="text-white/70 text-sm">{form.area || "Sem área"}</p>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/20 px-2.5 py-1.5 text-xs font-semibold text-white/80 hover:bg-white/10"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {pendingDisciplines.length > 0 && (
            <section className="bg-white p-5 rounded-xl border border-amber-200 shadow-sm">
              <h3 className="text-xs font-bold uppercase text-amber-700 mb-3">Resolver pendências</h3>
              <select
                value={pendingDisciplines.some((d) => d.id === initial?.id) ? initial?.id ?? "" : ""}
                onChange={(event) => onSelectPending?.(event.target.value)}
                className="w-full rounded-xl border border-amber-200 px-3 py-2 text-sm bg-amber-50"
              >
                <option value="">Selecione uma disciplina pendente</option>
                {pendingDisciplines.map((disc) => (
                  <option key={disc.id} value={disc.id}>
                    {disc.nome}
                  </option>
                ))}
              </select>
            </section>
          )}
          <section className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-slate-900">Auto-preencher disciplina</p>
              <p className="text-xs text-slate-500">Aplica padrões de carga, períodos e avaliação.</p>
            </div>
            <button
              type="button"
              onClick={handleAutoFill}
              className="rounded-lg bg-klasse-gold px-4 py-2 text-xs font-bold text-white shadow-sm hover:brightness-110"
            >
              Auto-preencher
            </button>
          </section>
          {!appearsInScheduler && (
            <section className="bg-amber-50 p-4 rounded-xl border border-amber-200 text-amber-800 text-sm">
              Esta disciplina não aparecerá no quadro porque não entra no horário ou a carga semanal está zerada.
            </section>
          )}
          <section className="bg-white p-4 rounded-xl border border-slate-200 text-sm text-slate-600">
            <p className="font-semibold text-slate-800">Dica Angola:</p>
            <p className="text-xs text-slate-500 mt-1">
              No ensino médio, algumas disciplinas só existem em certas classes (ex.: Filosofia apenas na 12ª).
              Use o escopo por classe e os trimestres para refletir a realidade.
            </p>
          </section>
          {appearsInScheduler && (
            <section className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs text-slate-600">
              Esta disciplina irá gerar <span className="font-semibold text-slate-900">{totalSlots}</span> tempo(s) semanais no quadro.
            </section>
          )}
          {classOptions.length > 0 && (
            <section className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 uppercase flex items-center gap-2 mb-4">
                <LayoutGrid className="w-4 h-4 text-[#1F6B3B]" /> Aplicar em quais classes?
              </h3>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => updateScope("all")}
                  className={`flex-1 py-3 px-4 rounded-lg border text-sm font-medium transition-all ${
                    applyScope === "all"
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                  }`}
                >
                  Todas as classes
                </button>
                <button
                  type="button"
                  onClick={() => updateScope("selected")}
                  className={`flex-1 py-3 px-4 rounded-lg border text-sm font-medium transition-all ${
                    applyScope === "selected"
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                  }`}
                >
                  Classes específicas
                </button>
              </div>

              {applyScope === "selected" && (
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {classOptions.map((classe) => {
                    const active = classIds.includes(classe.id);
                    return (
                      <button
                        key={classe.id}
                        type="button"
                        onClick={() => toggleClasse(classe.id)}
                        className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm transition-all ${
                          active
                            ? "border-[#1F6B3B] bg-[#1F6B3B]/10 text-[#1F6B3B]"
                            : "border-slate-200 text-slate-600 hover:border-slate-300"
                        }`}
                      >
                        <span className="font-semibold">{classe.nome}</span>
                        {active && <Check className="w-4 h-4" />}
                      </button>
                    );
                  })}
                </div>
              )}

              {errors.class_ids && (
                <p className="mt-2 text-xs text-red-600">{errors.class_ids}</p>
              )}
            </section>
          )}
          <section className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 uppercase flex items-center gap-2 mb-4">
              <CalendarDays className="w-4 h-4 text-[#1F6B3B]" /> Quando acontece?
            </h3>
            <p className="text-xs text-slate-500 mb-3">
              Se a disciplina só acontece em um trimestre, selecione apenas ele. Ex.: Filosofia só na 12ª classe.
            </p>

            <div className="flex gap-4 mb-4">
              <button
                type="button"
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    periodo_mode: "ano",
                    periodos_ativos: [1, 2, 3],
                  }))
                }
                className={`flex-1 py-3 px-4 rounded-lg border text-sm font-medium transition-all ${
                  form.periodo_mode === "ano"
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                }`}
              >
                Ano Completo
              </button>
              <button
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, periodo_mode: "custom" }))}
                className={`flex-1 py-3 px-4 rounded-lg border text-sm font-medium transition-all ${
                  form.periodo_mode === "custom"
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                }`}
              >
                Períodos Específicos
              </button>
            </div>

            {form.periodo_mode === "custom" && (
              <div className="flex gap-2 animate-in slide-in-from-top-2">
                {[1, 2, 3].map((periodo) => (
                  <button
                    key={periodo}
                    type="button"
                    onClick={() => togglePeriodo(periodo)}
                    className={`flex-1 py-2 rounded-lg border text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                      form.periodos_ativos.includes(periodo)
                        ? "bg-[#1F6B3B]/10 text-[#1F6B3B] border-[#1F6B3B]/30 ring-1 ring-[#1F6B3B]/20"
                        : "bg-slate-50 text-slate-400 border-slate-200"
                    }`}
                  >
                    {form.periodos_ativos.includes(periodo) && <Check className="w-3 h-3" />}
                    {periodo}º Trimestre
                  </button>
                ))}
              </div>
            )}
            {errors.periodos_ativos && (
              <p className="mt-2 text-xs text-red-600">{errors.periodos_ativos}</p>
            )}
          </section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <section className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 uppercase flex items-center gap-2 mb-4">
                <Clock className="w-4 h-4 text-[#1F6B3B]" /> Carga Semanal
              </h3>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      carga_horaria_semanal: Math.max(1, prev.carga_horaria_semanal - 1),
                    }))
                  }
                  className="w-10 h-10 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center font-bold text-lg"
                >
                  -
                </button>
                <div className="flex-1 text-center">
                  <span className="text-3xl font-bold text-slate-900">
                    {form.carga_horaria_semanal}
                  </span>
                  <span className="text-xs text-slate-500 block uppercase font-bold">Aulas</span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      carga_horaria_semanal: Math.min(10, prev.carga_horaria_semanal + 1),
                    }))
                  }
                  className="w-10 h-10 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center font-bold text-lg"
                >
                  +
                </button>
              </div>
              {errors.carga_horaria_semanal && (
                <p className="mt-2 text-xs text-red-600">{errors.carga_horaria_semanal}</p>
              )}
            </section>

            <section className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <h3 className="text-sm font-bold text-slate-900 uppercase flex items-center gap-2">
                <LayoutGrid className="w-4 h-4 text-[#1F6B3B]" /> Horário
              </h3>
              <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-100">
                <span className="text-sm font-medium text-slate-700">Entra na grade?</span>
                <button
                  type="button"
                  onClick={() =>
                    setForm((prev) => ({ ...prev, entra_no_horario: !prev.entra_no_horario }))
                  }
                  className={`w-12 h-6 rounded-full p-1 transition-colors ${
                    form.entra_no_horario ? "bg-[#1F6B3B]" : "bg-slate-300"
                  }`}
                >
                  <div
                    className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${
                      form.entra_no_horario ? "translate-x-6" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </section>
          </div>

          <section className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 uppercase flex items-center gap-2 mb-4">
              <Shield className="w-4 h-4 text-[#1F6B3B]" /> Classificação
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { id: "core", label: "Nuclear", icon: Shield, desc: "Obrigatória p/ média" },
                { id: "complementar", label: "Complementar", icon: Award, desc: "Enriquecimento" },
                { id: "optativa", label: "Opção", icon: LayoutGrid, desc: "Extra-curricular" },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      classificacao: opt.id as DisciplinaForm["classificacao"],
                    }))
                  }
                  className={`p-3 rounded-xl border text-left transition-all hover:shadow-md ${
                    form.classificacao === opt.id
                      ? "bg-[#E3B23C]/10 border-[#E3B23C] ring-1 ring-[#E3B23C]/40"
                      : "bg-white border-slate-200 hover:border-[#1F6B3B]/40"
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center mb-2 ${
                      form.classificacao === opt.id
                        ? "bg-[#E3B23C]/20 text-[#9E6F12]"
                        : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    <opt.icon className="w-4 h-4" />
                  </div>
                  <div
                    className={`font-bold text-sm ${
                      form.classificacao === opt.id ? "text-[#7A5510]" : "text-slate-700"
                    }`}
                  >
                    {opt.label}
                  </div>
                  <div className="text-[10px] text-slate-500">{opt.desc}</div>
                </button>
              ))}
            </div>
          </section>

          <section className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 uppercase flex items-center gap-2 mb-4">
              <Scale className="w-4 h-4 text-[#1F6B3B]" /> Sistema de Avaliação
            </h3>
            <div className="space-y-3">
              {[
                {
                  id: "inherit_school",
                  label: "Padrão da Escola",
                  desc: "MAC (40%) + NPP (30%) + PT (30%)",
                },
                {
                  id: "custom",
                  label: "Personalizado",
                  desc: "Definir pesos específicos para esta disciplina",
                },
                {
                  id: "inherit_disciplina",
                  label: "Herdar de...",
                  desc: "Copiar regras de outra disciplina",
                },
              ].map((opt) => (
                <label
                  key={opt.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                    form.avaliacao.mode === opt.id
                      ? "bg-slate-50 border-slate-900"
                      : "bg-white border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="avaliacao"
                    className="mt-1 text-[#1F6B3B] focus:ring-[#1F6B3B]"
                    checked={form.avaliacao.mode === opt.id}
                    onChange={() =>
                      setForm((prev) => ({
                        ...prev,
                        avaliacao: {
                          ...prev.avaliacao,
                          mode: opt.id as AvaliacaoMode,
                          base_id: opt.id === "inherit_disciplina" ? prev.avaliacao.base_id : null,
                        },
                      }))
                    }
                  />
                  <div>
                    <div className="text-sm font-bold text-slate-900">{opt.label}</div>
                    <div className="text-xs text-slate-500">{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>

            {form.avaliacao.mode === "inherit_disciplina" && (
              <div className="mt-4">
                <select
                  value={form.avaliacao.base_id ?? ""}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      avaliacao: {
                        ...prev.avaliacao,
                        base_id: event.target.value || null,
                      },
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="">Selecione uma disciplina</option>
                  {existingDisciplines.map((disc) => (
                    <option key={disc.id} value={disc.id}>
                      {disc.nome}
                    </option>
                  ))}
                </select>
                {errors.avaliacao && (
                  <p className="mt-1 text-xs text-red-600">{errors.avaliacao}</p>
                )}
              </div>
            )}
          </section>
        </div>

        <div className="border-t border-slate-200 p-6 bg-white shrink-0 space-y-4">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-start gap-3 text-xs text-slate-600">
            <AlertCircle className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
            <div>
              <span className="font-bold text-slate-700 block mb-1">Resumo do Impacto:</span>
              <ul className="space-y-0.5 list-disc pl-4">
                <li>
                  Afetará <span className="font-bold">{form.periodos_ativos.length} período(s)</span>.
                </li>
                <li>
                  Carga horária total: <span className="font-bold">{totalHorasAno} horas</span>/ano.
                </li>
                <li>
                  Avaliação: <span className="font-bold">{form.avaliacao.mode}</span>.
                </li>
              </ul>
            </div>
          </div>

          {!canSave && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-700" />
              Corrija os campos destacados para salvar.
            </div>
          )}

          <div className="flex flex-wrap justify-end gap-3">
            {mode === "edit" && initial?.id && onDelete && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="px-6 py-3 rounded-xl font-bold text-white bg-red-600 disabled:opacity-70 flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                {deleting ? "Removendo..." : "Remover"}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave || saving}
              className="px-8 py-3 rounded-xl font-bold text-white bg-slate-900 hover:bg-slate-800 shadow-lg hover:shadow-xl transition-all flex items-center gap-2 disabled:opacity-70"
            >
              <Check className="w-5 h-5" />
              {saving ? "Salvando..." : "Salvar Configuração"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
