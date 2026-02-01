"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Check, Trash2, Library, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export type AvaliacaoMode = "herdar_escola" | "personalizada";

export type DisciplinaForm = {
  id?: string;
  nome: string;
  codigo: string;
  area?: string | null;
  carga_horaria_semanal: number;
  duracao_aula_min?: number | null;
  is_core: boolean;
  participa_horario: boolean;
  is_avaliavel: boolean;
  avaliacao_mode: AvaliacaoMode;
  programa_texto?: string | null;
};

type Props = {
  open: boolean;
  mode: "create" | "edit";
  initial?: DisciplinaForm | null;
  existingCodes: string[];
  existingNames: string[];
  onClose: () => void;
  onSave: (payload: DisciplinaForm) => Promise<void> | void;
  onDelete?: (id: string) => Promise<void> | void;
};

const emptyDisciplina: DisciplinaForm = {
  nome: "",
  codigo: "",
  area: null,
  carga_horaria_semanal: 4,
  duracao_aula_min: null,
  is_core: true,
  participa_horario: true,
  is_avaliavel: true,
  avaliacao_mode: "herdar_escola",
  programa_texto: null,
};

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
  onClose,
  onSave,
  onDelete,
}: Props) {
  const [tab, setTab] = useState<"basico" | "carga" | "avaliacao" | "programa">("basico");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState<DisciplinaForm>(() => ({
    id: initial?.id,
    nome: initial?.nome ?? "",
    codigo: initial?.codigo ?? "",
    area: initial?.area ?? null,
    carga_horaria_semanal: initial?.carga_horaria_semanal ?? 4,
    duracao_aula_min: initial?.duracao_aula_min ?? null,
    is_core: initial?.is_core ?? true,
    participa_horario: initial?.participa_horario ?? true,
    is_avaliavel: initial?.is_avaliavel ?? true,
    avaliacao_mode: initial?.avaliacao_mode ?? "herdar_escola",
    programa_texto: initial?.programa_texto ?? null,
  }));

  useEffect(() => {
    if (!open) return;
    setTab("basico");
    setSaving(false);
    setDeleting(false);
    setForm({
      id: initial?.id,
      nome: initial?.nome ?? "",
      codigo: initial?.codigo ?? "",
      area: initial?.area ?? null,
      carga_horaria_semanal: initial?.carga_horaria_semanal ?? 4,
      duracao_aula_min: initial?.duracao_aula_min ?? null,
      is_core: initial?.is_core ?? true,
      participa_horario: initial?.participa_horario ?? true,
      is_avaliavel: initial?.is_avaliavel ?? true,
      avaliacao_mode: initial?.avaliacao_mode ?? "herdar_escola",
      programa_texto: initial?.programa_texto ?? null,
    });
  }, [open, initial?.id]);

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    const nomeNorm = normalizeName(form.nome);
    const codeNorm = normalizeCode(form.codigo);

    if (nomeNorm.length < 3) e.nome = "Nome muito curto.";
    if (!isValidCode(codeNorm)) e.codigo = "Código inválido (2–12, A-Z/0-9/-/_).";

    const codesUpper = existingCodes.map((c) => normalizeCode(c));
    const namesLower = existingNames.map((n) => normalizeName(n).toLowerCase());
    const currentCode = initial?.codigo ? normalizeCode(initial.codigo) : null;
    const currentName = initial?.nome ? normalizeName(initial.nome).toLowerCase() : null;

    const codeCollides =
      codesUpper.includes(codeNorm) && (mode === "create" || codeNorm !== currentCode);
    const nameCollides =
      namesLower.includes(nomeNorm.toLowerCase()) &&
      (mode === "create" || nomeNorm.toLowerCase() !== currentName);

    if (codeCollides) e.codigo = "Este código já existe no curso.";
    if (nameCollides) e.nome = "Esta disciplina já existe no curso.";

    if (!Number.isFinite(form.carga_horaria_semanal) || form.carga_horaria_semanal <= 0) {
      e.carga_horaria_semanal = "Carga semanal deve ser > 0.";
    }
    if (form.duracao_aula_min != null && form.duracao_aula_min <= 0) {
      e.duracao_aula_min = "Duração inválida.";
    }

    return e;
  }, [existingCodes, existingNames, form, initial?.codigo, initial?.nome, mode]);

  const canSave = Object.keys(errors).length === 0;

  const handleSave = async () => {
    const payload: DisciplinaForm = {
      ...form,
      nome: normalizeName(form.nome),
      codigo: normalizeCode(form.codigo),
      area: form.area?.trim() ? form.area.trim() : null,
      programa_texto: form.programa_texto?.trim() ? form.programa_texto.trim() : null,
    };

    if (!canSave) return;

    setSaving(true);
    try {
      await onSave(payload);
      onClose();
    } catch (error: any) {
      toast.error(error?.message || "Falha ao salvar disciplina.");
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
    } catch (error: any) {
      toast.error(error?.message || "Falha ao remover disciplina.");
    } finally {
      setDeleting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-3xl rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-xl bg-slate-900 p-2 text-white">
              <Library className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                {mode === "create" ? "Nova disciplina" : "Editar disciplina"}
              </h3>
              <p className="text-xs text-slate-500">
                Define carga horária, se é core e como entra na pauta.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 p-2 text-slate-500 hover:text-slate-900 hover:border-slate-300"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 pt-4">
          <div className="flex flex-wrap gap-2">
            {[
              { key: "basico", label: "Básico" },
              { key: "carga", label: "Carga & horário" },
              { key: "avaliacao", label: "Avaliação" },
              { key: "programa", label: "Programa" },
            ].map((t) => {
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key as typeof tab)}
                  className={[
                    "rounded-full px-3 py-1.5 text-xs font-semibold border",
                    active
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-600 border-slate-200 hover:border-slate-300",
                  ].join(" ")}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-6 px-6 py-5">
          <div className="space-y-4">
            {tab === "basico" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600">Nome</label>
                    <input
                      value={form.nome}
                      onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))}
                      className={[
                        "mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none",
                        "focus:ring-4 focus:ring-klasse-gold/20 focus:border-klasse-gold",
                        errors.nome ? "border-red-300" : "border-slate-200",
                      ].join(" ")}
                      placeholder="Ex: Matemática"
                    />
                    {errors.nome && <p className="mt-1 text-xs text-red-600">{errors.nome}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600">Código</label>
                    <input
                      value={form.codigo}
                      onChange={(e) => setForm((p) => ({ ...p, codigo: e.target.value }))}
                      className={[
                        "mt-1 w-full rounded-xl border px-3 py-2 text-sm font-mono outline-none",
                        "focus:ring-4 focus:ring-klasse-gold/20 focus:border-klasse-gold",
                        errors.codigo ? "border-red-300" : "border-slate-200",
                      ].join(" ")}
                      placeholder="Ex: MAT"
                    />
                    <p className="mt-1 text-xs text-slate-500">Formato: 2–12, A-Z/0-9/-/_.</p>
                    {errors.codigo && (
                      <p className="mt-1 text-xs text-red-600">{errors.codigo}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600">
                    Área/Departamento (opcional)
                  </label>
                  <input
                    value={form.area ?? ""}
                    onChange={(e) => setForm((p) => ({ ...p, area: e.target.value }))}
                    className={[
                      "mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none",
                      "focus:ring-4 focus:ring-klasse-gold/20 focus:border-klasse-gold",
                      "border-slate-200",
                    ].join(" ")}
                    placeholder="Ex: Ciências"
                  />
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, is_core: !p.is_core }))}
                    className={[
                      "rounded-full border px-3 py-1.5 text-xs font-semibold",
                      form.is_core
                        ? "bg-klasse-gold text-white border-klasse-gold"
                        : "bg-white text-slate-600 border-slate-200 hover:border-slate-300",
                    ].join(" ")}
                  >
                    {form.is_core ? "Core: Sim" : "Core: Não"}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setForm((p) => ({ ...p, participa_horario: !p.participa_horario }))
                    }
                    className={[
                      "rounded-full border px-3 py-1.5 text-xs font-semibold",
                      form.participa_horario
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-white text-slate-600 border-slate-200 hover:border-slate-300",
                    ].join(" ")}
                  >
                    {form.participa_horario ? "Participa do horário" : "Sem slot fixo"}
                  </button>
                </div>
              </div>
            )}

            {tab === "carga" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600">
                      Carga semanal (aulas/semana)
                    </label>
                    <input
                      type="number"
                      value={form.carga_horaria_semanal}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          carga_horaria_semanal: Number(e.target.value),
                        }))
                      }
                      className={[
                        "mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none",
                        "focus:ring-4 focus:ring-klasse-gold/20 focus:border-klasse-gold",
                        errors.carga_horaria_semanal ? "border-red-300" : "border-slate-200",
                      ].join(" ")}
                      min={1}
                    />
                    {errors.carga_horaria_semanal && (
                      <p className="mt-1 text-xs text-red-600">{errors.carga_horaria_semanal}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600">
                      Duração da aula (min) (opcional)
                    </label>
                    <input
                      type="number"
                      value={form.duracao_aula_min ?? ""}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          duracao_aula_min: e.target.value === "" ? null : Number(e.target.value),
                        }))
                      }
                      className={[
                        "mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none",
                        "focus:ring-4 focus:ring-klasse-gold/20 focus:border-klasse-gold",
                        errors.duracao_aula_min ? "border-red-300" : "border-slate-200",
                      ].join(" ")}
                      placeholder="Herdar padrão da escola"
                      min={1}
                    />
                    {errors.duracao_aula_min && (
                      <p className="mt-1 text-xs text-red-600">{errors.duracao_aula_min}</p>
                    )}
                  </div>
                </div>

                {!form.participa_horario && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 flex gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-700 mt-0.5" />
                    <p className="text-xs text-amber-800">
                      Sem slot fixo: a disciplina pode existir no currículo, mas não entra no motor
                      de horários.
                    </p>
                  </div>
                )}
              </div>
            )}

            {tab === "avaliacao" && (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, is_avaliavel: true }))}
                    className={[
                      "rounded-full border px-3 py-1.5 text-xs font-semibold",
                      form.is_avaliavel
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-white text-slate-600 border-slate-200 hover:border-slate-300",
                    ].join(" ")}
                  >
                    Avaliável
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((p) => ({
                        ...p,
                        is_avaliavel: false,
                        avaliacao_mode: "herdar_escola",
                      }))
                    }
                    className={[
                      "rounded-full border px-3 py-1.5 text-xs font-semibold",
                      !form.is_avaliavel
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-white text-slate-600 border-slate-200 hover:border-slate-300",
                    ].join(" ")}
                  >
                    Não avaliável
                  </button>
                </div>

                {form.is_avaliavel && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                    <p className="text-xs font-semibold text-slate-700">Modelo de avaliação</p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setForm((p) => ({ ...p, avaliacao_mode: "herdar_escola" }))
                        }
                        className={[
                          "rounded-xl border px-3 py-3 text-left",
                          form.avaliacao_mode === "herdar_escola"
                            ? "bg-white border-slate-900"
                            : "bg-white border-slate-200 hover:border-slate-300",
                        ].join(" ")}
                      >
                        <p className="text-xs font-semibold text-slate-900">Herdar da escola</p>
                        <p className="text-xs text-slate-500">
                          Usa o padrão (MAC/NPP/PT etc.) sem customização.
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setForm((p) => ({ ...p, avaliacao_mode: "personalizada" }))
                        }
                        className={[
                          "rounded-xl border px-3 py-3 text-left",
                          form.avaliacao_mode === "personalizada"
                            ? "bg-white border-slate-900"
                            : "bg-white border-slate-200 hover:border-slate-300",
                        ].join(" ")}
                      >
                        <p className="text-xs font-semibold text-slate-900">Personalizada</p>
                        <p className="text-xs text-slate-500">
                          Define pesos e componentes específicos.
                        </p>
                      </button>
                    </div>

                    {form.avaliacao_mode === "personalizada" && (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 flex gap-2">
                        <AlertCircle className="h-4 w-4 text-amber-700 mt-0.5" />
                        <p className="text-xs text-amber-800">
                          MVP: guardamos o modo personalizada, mas a fórmula/pesos são definidos na
                          etapa de avaliação.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {tab === "programa" && (
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-slate-600">
                  Conteúdo programático (opcional)
                </label>
                <textarea
                  value={form.programa_texto ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, programa_texto: e.target.value }))}
                  className={[
                    "w-full min-h-[160px] rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none",
                    "focus:ring-4 focus:ring-klasse-gold/20 focus:border-klasse-gold",
                  ].join(" ")}
                  placeholder="Cole aqui o programa/ementa..."
                />
                <p className="text-xs text-slate-500">
                  MVP: texto simples. Upload de PDF entra depois.
                </p>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <p className="text-xs font-semibold text-slate-700">Impacto</p>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-600">
                Core: <span className="font-semibold">{form.is_core ? "Sim" : "Não"}</span>
              </p>
              <p className="text-xs text-slate-600">
                Horário:{" "}
                <span className="font-semibold">
                  {form.participa_horario
                    ? `${form.carga_horaria_semanal} slots/sem`
                    : "sem slot"}
                </span>
              </p>
              <p className="text-xs text-slate-600">
                Avaliação:{" "}
                <span className="font-semibold">
                  {!form.is_avaliavel
                    ? "não avaliável"
                    : form.avaliacao_mode === "herdar_escola"
                      ? "herda da escola"
                      : "personalizada"}
                </span>
              </p>
            </div>

            {!canSave && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 flex gap-2">
                <AlertCircle className="h-4 w-4 text-amber-700 mt-0.5" />
                <p className="text-xs text-amber-800">Corrige os campos destacados para salvar.</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
          <div className="flex items-center gap-2">
            {mode === "edit" && initial?.id && onDelete && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-70"
              >
                <Trash2 className="h-4 w-4" />
                {deleting ? "Removendo..." : "Remover"}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:border-slate-300"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave || saving}
              className="inline-flex items-center gap-2 rounded-xl bg-klasse-gold px-4 py-2 text-xs font-semibold text-white disabled:opacity-70"
            >
              <Check className="h-4 w-4" />
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
