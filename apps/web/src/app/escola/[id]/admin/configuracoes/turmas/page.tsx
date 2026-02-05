"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  Loader2,
  Plus,
  School,
  Trash2,
  Wand2,
} from "lucide-react";
import ConfigSystemShell from "@/components/escola/settings/ConfigSystemShell";
import { buildConfigMenuItems } from "../_shared/menuItems";
import { DisciplinaModal, type DisciplinaForm } from "@/components/escola/settings/_components/DisciplinaModal";

type Curso = { id: string; nome: string };
type Classe = { id: string; curso_id?: string; nome: string; turno?: string | null };
type CurriculoStatus = {
  curso_id: string;
  status: "draft" | "published" | "archived" | "none";
  version: number;
  ano_letivo_id: string;
};

type ImpactData = {
  turmas?: number;
  alunos?: number;
  professores?: number;
};

type ModalKey = null | "publish" | "classes" | "generate" | "disciplinas";

type DisciplinaItem = {
  id: string;
  nome: string;
  codigo: string;
  carga_horaria_semanal: number;
  is_core: boolean;
  participa_horario: boolean;
  is_avaliavel: boolean;
  avaliacao_mode: "herdar_escola" | "personalizada";
  area?: string | null;
  classificacao?: "core" | "complementar" | "optativa" | null;
  periodos_ativos?: number[] | null;
  entra_no_horario?: boolean | null;
  avaliacao_mode_key?: "inherit_school" | "custom" | "inherit_disciplina" | null;
  avaliacao_disciplina_id?: string | null;
  status_completude?: string | null;
  matrix_ids: string[];
};

type CursoContext = {
  cursoId: string;
  classesBase?: Classe[];
  disciplinas?: DisciplinaItem[];
};

type ClassDraft = {
  id: string;
  nome: string;
  turno?: string | null;
  isNew?: boolean;
  isDirty?: boolean;
};

type GenerateRow = {
  classId: string;
  nome: string;
  turno: "M" | "T" | "N";
  quantidade: number;
  enabled: boolean;
};

const getDefaultTurno = (turno?: string | null): "M" | "T" | "N" => {
  const value = (turno ?? "").toUpperCase();
  if (value === "T" || value === "N") return value;
  return "M";
};

const ModalShell = ({
  title,
  subtitle,
  children,
  footer,
  onClose,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  onClose: () => void;
}) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
    <div className="w-full max-w-3xl rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-6 py-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
        >
          Fechar
        </button>
      </div>
      <div className="p-6 space-y-5">{children}</div>
      {footer && <div className="border-t border-slate-200 bg-slate-50 px-6 py-4">{footer}</div>}
    </div>
  </div>
);

export default function TurmasConfiguracoesPage() {
  const params = useParams() as { id?: string };
  const escolaId = params?.id;
  const base = escolaId ? `/escola/${escolaId}/admin/configuracoes` : "";
  const menuItems = buildConfigMenuItems(base);

  const [loading, setLoading] = useState(true);
  const [impact, setImpact] = useState<ImpactData>({});
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [classes, setClasses] = useState<Classe[]>([]);
  const [curriculos, setCurriculos] = useState<CurriculoStatus[]>([]);
  const [anoLetivo, setAnoLetivo] = useState<{ id: string; ano: number } | null>(null);

  const [modal, setModal] = useState<ModalKey>(null);
  const [selectedCursoId, setSelectedCursoId] = useState<string | null>(null);
  const [ctx, setCtx] = useState<CursoContext | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalActionLoading, setModalActionLoading] = useState(false);

  const [publishRebuild, setPublishRebuild] = useState(false);
  const [publishConfirm, setPublishConfirm] = useState(false);

  const [classesDrafts, setClassesDrafts] = useState<ClassDraft[]>([]);
  const [generateRows, setGenerateRows] = useState<GenerateRow[]>([]);

  const [disciplinaModalOpen, setDisciplinaModalOpen] = useState(false);
  const [disciplinaModalMode, setDisciplinaModalMode] = useState<"create" | "edit">("create");
  const [disciplinaEditing, setDisciplinaEditing] = useState<DisciplinaForm | null>(null);
  const [disciplinaEditingMatrixIds, setDisciplinaEditingMatrixIds] = useState<string[]>([]);

  const fetchCurriculoStatus = useCallback(async () => {
    if (!escolaId) return;
    const res = await fetch(`/api/escola/${escolaId}/admin/curriculo/status`, { cache: "no-store" });
    const json = await res.json().catch(() => null);
    if (res.ok) {
      setCurriculos(json?.curriculos ?? []);
      setAnoLetivo(json?.ano_letivo ?? null);
    }
  }, [escolaId]);

  const loadData = useCallback(async () => {
    if (!escolaId) return;
    setLoading(true);
    try {
      const [cursosRes, classesRes, curriculoRes, impactRes] = await Promise.all([
        fetch(`/api/escolas/${escolaId}/cursos`, { cache: "no-store" }),
        fetch(`/api/escolas/${escolaId}/classes`, { cache: "no-store" }),
        fetch(`/api/escola/${escolaId}/admin/curriculo/status`, { cache: "no-store" }),
        fetch(`/api/escola/${escolaId}/admin/setup/impact`, {
          method: "POST",
          body: JSON.stringify({}),
        }),
      ]);

      const cursosJson = await cursosRes.json().catch(() => null);
      if (cursosRes.ok) setCursos(cursosJson?.data ?? []);

      const classesJson = await classesRes.json().catch(() => null);
      if (classesRes.ok) setClasses(classesJson?.data ?? []);

      const curriculoJson = await curriculoRes.json().catch(() => null);
      if (curriculoRes.ok) {
        setCurriculos(curriculoJson?.curriculos ?? []);
        setAnoLetivo(curriculoJson?.ano_letivo ?? null);
      }

      const impactJson = await impactRes.json().catch(() => null);
      if (impactRes.ok) {
        setImpact({
          turmas: impactJson?.data?.counts?.turmas_afetadas,
          alunos: impactJson?.data?.counts?.alunos_afetados,
          professores: impactJson?.data?.counts?.professores_afetados,
        });
      }
    } catch (e) {
      console.error(e);
      toast.error("Erro ao carregar dados acadêmicos.");
    } finally {
      setLoading(false);
    }
  }, [escolaId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const fetchCourseClasses = useCallback(
    async (cursoId: string): Promise<Classe[]> => {
      const res = await fetch(`/api/escolas/${escolaId}/classes?curso_id=${cursoId}&limit=50`, {
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || "Falha ao carregar classes base.");
      }
      return json?.data ?? [];
    },
    [escolaId]
  );

  const fetchCourseDisciplinas = useCallback(
    async (cursoId: string): Promise<DisciplinaItem[]> => {
      const res = await fetch(`/api/escolas/${escolaId}/disciplinas?curso_id=${cursoId}&limit=200`, {
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || "Falha ao carregar disciplinas.");
      }

      const map = new Map<string, DisciplinaItem>();
      (json?.data ?? []).forEach((item: any) => {
        const key = item.disciplina_id ?? item.nome ?? item.id;
        const existing = map.get(key);
        const incomingStatus = item.curriculo_status ?? null;
        const base = existing ?? {
          id: key,
          nome: item.nome,
          codigo: item.sigla ?? item.codigo ?? item.nome?.slice(0, 6)?.toUpperCase() ?? "",
          carga_horaria_semanal: Number(item.carga_horaria_semanal ?? item.carga_horaria ?? 0),
          is_core: Boolean(item.is_core ?? (item.classificacao === "core" || item.tipo === "core")),
          participa_horario: item.entra_no_horario ?? true,
          is_avaliavel: item.is_avaliavel ?? true,
          avaliacao_mode: item.avaliacao_mode === "custom" ? "personalizada" : "herdar_escola",
          area: item.area ?? null,
          classificacao: item.classificacao ?? null,
          periodos_ativos: item.periodos_ativos ?? null,
          entra_no_horario: item.entra_no_horario ?? null,
          avaliacao_mode_key: item.avaliacao_mode ?? null,
          avaliacao_disciplina_id: item.avaliacao_disciplina_id ?? null,
          status_completude: item.status_completude ?? null,
          curriculo_status: incomingStatus,
          matrix_ids: [] as string[], // Explicitly cast to string[]
        };

        const shouldReplace =
          existing && incomingStatus === "draft" && existing.curriculo_status !== "draft";
        const nextBase = shouldReplace ? { ...base, matrix_ids: [] as string[] } : base;

        const matrixIds = nextBase.matrix_ids ?? [];
        if (item.id && !matrixIds.includes(item.id as string)) { // Cast item.id to string
          matrixIds.push(item.id as string); // Also cast for push
        }
        map.set(key, { ...nextBase, matrix_ids: matrixIds });
      });

      return Array.from(map.values());
    },
    [escolaId]
  );

  const closeModal = () => {
    setModal(null);
    setSelectedCursoId(null);
    setCtx(null);
    setPublishConfirm(false);
    setPublishRebuild(false);
    setClassesDrafts([]);
    setGenerateRows([]);
    setDisciplinaModalOpen(false);
  };

  const openModal = async (cursoId: string, key: ModalKey) => {
    if (!escolaId) return;
    setSelectedCursoId(cursoId);
    setModal(key);
    setModalLoading(true);
    setPublishConfirm(false);
    setPublishRebuild(false);

    try {
      let classesBase: Classe[] | undefined;
      let disciplinas: DisciplinaItem[] | undefined;

      if (key === "classes" || key === "generate" || key === "disciplinas") {
        classesBase = await fetchCourseClasses(cursoId);
      }
      if (key === "disciplinas") {
        disciplinas = await fetchCourseDisciplinas(cursoId);
      }

      setCtx({ cursoId, classesBase, disciplinas });

      if (classesBase) {
        setClassesDrafts(
          classesBase.map((c) => ({
            id: c.id,
            nome: c.nome,
            turno: c.turno ?? "M",
          }))
        );
        setGenerateRows(
          classesBase.map((c) => ({
            classId: c.id,
            nome: c.nome,
            turno: getDefaultTurno(c.turno),
            quantidade: 1,
            enabled: true,
          }))
        );
      }
    } catch (e: any) {
      toast.error(e?.message || "Falha ao carregar dados do curso.");
      setModal(null);
    } finally {
      setModalLoading(false);
    }
  };

  const selectedCurso = useMemo(
    () => cursos.find((curso) => curso.id === selectedCursoId) ?? null,
    [cursos, selectedCursoId]
  );

  const selectedCurriculo = useMemo(
    () => curriculos.find((c) => c.curso_id === selectedCursoId) ?? null,
    [curriculos, selectedCursoId]
  );

  const handlePublish = async () => {
    if (!escolaId || !selectedCurriculo || !selectedCursoId) return;
    if (!publishConfirm) {
      toast.error("Confirme a publicação para continuar.");
      return;
    }

    setModalActionLoading(true);
    try {
      const res = await fetch(`/api/escola/${escolaId}/admin/curriculo/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cursoId: selectedCursoId,
          anoLetivoId: selectedCurriculo.ano_letivo_id,
          version: selectedCurriculo.version,
          rebuildTurmas: publishRebuild,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || "Falha ao publicar currículo.");
      }
      await fetchCurriculoStatus();
      toast.success("Currículo publicado.");
      closeModal();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao publicar currículo.");
    } finally {
      setModalActionLoading(false);
    }
  };

  const handleSaveClasses = async () => {
    if (!escolaId || !selectedCursoId) return;
    setModalActionLoading(true);
    try {
      const updates = classesDrafts.filter((row) => row.isNew || row.isDirty);
      await Promise.all(
        updates.map(async (row) => {
          if (row.isNew) {
            const res = await fetch(`/api/escolas/${escolaId}/classes`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                nome: row.nome,
                curso_id: selectedCursoId,
                turno: row.turno ?? "M",
              }),
            });
            const json = await res.json().catch(() => null);
            if (!res.ok || json?.ok === false) {
              throw new Error(json?.error || "Falha ao criar classe.");
            }
          } else if (row.isDirty) {
            const res = await fetch(`/api/escolas/${escolaId}/classes/${row.id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ nome: row.nome, turno: row.turno ?? "M" }),
            });
            const json = await res.json().catch(() => null);
            if (!res.ok || json?.ok === false) {
              throw new Error(json?.error || "Falha ao atualizar classe.");
            }
          }
        })
      );

      const classesBase = await fetchCourseClasses(selectedCursoId);
      setCtx((prev) => (prev ? { ...prev, classesBase } : prev));
      setClasses((prev) => prev.filter((c) => c.curso_id !== selectedCursoId).concat(classesBase));
      setClassesDrafts(
        classesBase.map((c) => ({ id: c.id, nome: c.nome, turno: c.turno ?? "M" }))
      );
      toast.success("Classes base salvas.");
    } catch (e: any) {
      toast.error(e?.message || "Falha ao salvar classes.");
    } finally {
      setModalActionLoading(false);
    }
  };

  const handleDeleteClass = async (id: string) => {
    if (!escolaId) return;
    const draft = classesDrafts.find((row) => row.id === id);
    if (!draft) return;
    if (draft.isNew) {
      setClassesDrafts((prev) => prev.filter((row) => row.id !== id));
      return;
    }
    try {
      const res = await fetch(`/api/escolas/${escolaId}/classes/${id}`, { method: "DELETE" });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || "Falha ao remover classe.");
      }
      setClassesDrafts((prev) => prev.filter((row) => row.id !== id));
      toast.success("Classe removida.");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao remover classe.");
    }
  };

  const handleGenerateTurmas = async () => {
    if (!escolaId || !selectedCursoId || !anoLetivo) return;
    const curriculo = curriculos.find((c) => c.curso_id === selectedCursoId);
    if (!curriculo || curriculo.status !== "published") {
      toast.error("Publique o currículo antes de gerar turmas.");
      return;
    }

    const payload = generateRows
      .filter((row) => row.enabled)
      .map((row) => ({
        classeId: row.classId,
        turno: row.turno,
        quantidade: row.quantidade,
      }));

    if (!payload.length) {
      toast.error("Selecione ao menos uma classe.");
      return;
    }

    setModalActionLoading(true);
    try {
      const res = await fetch(`/api/escola/${escolaId}/admin/turmas/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          cursoId: selectedCursoId,
          anoLetivo: anoLetivo.ano,
          turmas: payload,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || "Falha ao gerar turmas.");
      }
      toast.success("Turmas geradas com sucesso.");
      closeModal();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao gerar turmas.");
    } finally {
      setModalActionLoading(false);
    }
  };

  const openCreateDisciplina = () => {
    setDisciplinaModalMode("create");
    setDisciplinaEditing(null);
    setDisciplinaEditingMatrixIds([]);
    setDisciplinaModalOpen(true);
  };

  const openEditDisciplina = (disciplina: DisciplinaItem) => {
    setDisciplinaModalMode("edit");
    setDisciplinaEditing({
      id: disciplina.id,
      nome: disciplina.nome,
      codigo: disciplina.codigo,
      periodos_ativos: disciplina.periodos_ativos?.length ? disciplina.periodos_ativos : [1, 2, 3],
      periodo_mode: disciplina.periodos_ativos?.length ? "custom" : "ano",
      carga_horaria_semanal: disciplina.carga_horaria_semanal,
      classificacao: disciplina.classificacao ?? (disciplina.is_core ? "core" : "complementar"),
      entra_no_horario: disciplina.entra_no_horario ?? disciplina.participa_horario,
      avaliacao: {
        mode: disciplina.avaliacao_mode_key ?? (disciplina.avaliacao_mode === "personalizada" ? "custom" : "inherit_school"),
        base_id: disciplina.avaliacao_disciplina_id ?? null,
      },
      area: disciplina.area ?? null,
      programa_texto: null,
    });
    setDisciplinaEditingMatrixIds(disciplina.matrix_ids ?? []);
    setDisciplinaModalOpen(true);
  };

  const handleSaveDisciplina = async (payload: DisciplinaForm) => {
    if (!escolaId || !selectedCursoId || !ctx?.classesBase) return;
    try {
      if (disciplinaModalMode === "create") {
        if (!ctx.classesBase.length) {
          toast.error("Cadastre classes base antes.");
          return;
        }
        await Promise.all(
          ctx.classesBase.map(async (classe) => {
            const res = await fetch(`/api/escolas/${escolaId}/disciplinas`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                nome: payload.nome,
                curso_id: selectedCursoId,
                classe_id: classe.id,
                sigla: payload.codigo,
                carga_horaria_semanal: payload.carga_horaria_semanal,
                carga_horaria: payload.carga_horaria_semanal,
                classificacao: payload.classificacao,
                is_avaliavel: true,
                area: payload.area ?? null,
                periodos_ativos: payload.periodos_ativos,
                entra_no_horario: payload.entra_no_horario,
                avaliacao_mode: payload.avaliacao.mode,
                avaliacao_modelo_id: null,
                avaliacao_disciplina_id:
                  payload.avaliacao.mode === "inherit_disciplina"
                    ? payload.avaliacao.base_id ?? null
                    : null,
              }),
            });
            const json = await res.json().catch(() => null);
            if (!res.ok || json?.ok === false) {
              throw new Error(json?.error || "Falha ao criar disciplina.");
            }
          })
        );
      } else if (disciplinaEditingMatrixIds.length > 0) {
        await Promise.all(
          disciplinaEditingMatrixIds.map(async (matrixId) => {
            const res = await fetch(`/api/escolas/${escolaId}/disciplinas/${matrixId}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                nome: payload.nome,
                sigla: payload.codigo,
                carga_horaria_semanal: payload.carga_horaria_semanal,
                carga_horaria: payload.carga_horaria_semanal,
                classificacao: payload.classificacao,
                is_avaliavel: true,
                area: payload.area ?? null,
                periodos_ativos: payload.periodos_ativos,
                entra_no_horario: payload.entra_no_horario,
                avaliacao_mode: payload.avaliacao.mode,
                avaliacao_modelo_id: null,
                avaliacao_disciplina_id:
                  payload.avaliacao.mode === "inherit_disciplina"
                    ? payload.avaliacao.base_id ?? null
                    : null,
              }),
            });
            const json = await res.json().catch(() => null);
            if (!res.ok || json?.ok === false) {
              throw new Error(json?.error || "Falha ao atualizar disciplina.");
            }
          })
        );
      }

      const disciplinas = await fetchCourseDisciplinas(selectedCursoId);
      setCtx((prev) => (prev ? { ...prev, disciplinas } : prev));
      toast.success("Disciplina salva.");
    } catch (e: any) {
      toast.error(e?.message || "Falha ao salvar disciplina.");
    }
  };

  const handleDeleteDisciplina = async (disciplinaId: string) => {
    if (!escolaId || !selectedCursoId || !ctx?.disciplinas) return;
    const disciplina = ctx.disciplinas.find((d) => d.id === disciplinaId);
    const matrixIds = disciplina?.matrix_ids ?? [];
    if (!matrixIds.length) return;
    try {
      await Promise.all(
        matrixIds.map(async (matrixId) => {
          const res = await fetch(`/api/escolas/${escolaId}/disciplinas/${matrixId}`, {
            method: "DELETE",
          });
          const json = await res.json().catch(() => null);
          if (!res.ok || json?.ok === false) {
            throw new Error(json?.error || "Falha ao remover disciplina.");
          }
        })
      );
      const disciplinas = await fetchCourseDisciplinas(selectedCursoId);
      setCtx((prev) => (prev ? { ...prev, disciplinas } : prev));
      toast.success("Disciplina removida.");
    } catch (e: any) {
      toast.error(e?.message || "Falha ao remover disciplina.");
    }
  };

  const handleConfirmSetup = async () => {
    if (!escolaId) return;
    try {
      await fetch(`/api/escola/${escolaId}/admin/setup/commit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changes: { turmas: true } }),
      });
    } catch (e) {
      console.error(e);
    }
  };

  const totalGeneratePreview = generateRows
    .filter((row) => row.enabled)
    .reduce((acc, row) => acc + row.quantidade, 0);

  return (
    <ConfigSystemShell
      escolaId={escolaId ?? ""}
      title="Gestão de Turmas & Currículo"
      subtitle="Controle central: publique currículos, ajuste classes e gere turmas com segurança."
      menuItems={menuItems}
      embedded
      backHref={`${base}?tab=turmas`}
      prevHref={`${base}/avaliacao`}
      nextHref={`${base}/financeiro`}
      testHref={`${base}/sandbox`}
      impact={impact}
      onSave={handleConfirmSetup}
      saveDisabled={modalActionLoading}
    >
      <div className="space-y-6">
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-5 text-sm text-slate-600 flex gap-4">
          <div className="rounded-full bg-blue-100 p-2 text-blue-600 h-fit">
            <School className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold text-slate-900">Command Center de Turmas</p>
            <p className="mt-1">
              Publique currículos, ajuste classes base e gere turmas sem navegar. Todas as ações são
              seguras por padrão.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="py-10 flex justify-center">
            <Loader2 className="animate-spin text-slate-300" />
          </div>
        ) : cursos.length === 0 ? (
          <div className="text-center py-8 text-slate-500 border border-dashed rounded-xl">
            Nenhum curso cadastrado na escola.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {cursos.map((curso) => {
              const curriculo = curriculos.find((c) => c.curso_id === curso.id);
              const status = curriculo?.status ?? "none";
              const isPublished = status === "published";
              const classesDoCurso = classes.filter((c) => c.curso_id === curso.id).length;

              return (
                <div
                  key={curso.id}
                  className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col gap-4"
                >
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-start gap-3">
                      <div
                        className={`mt-1 rounded-full p-1.5 ${
                          isPublished
                            ? "bg-emerald-100 text-emerald-600"
                            : "bg-amber-100 text-amber-600"
                        }`}
                      >
                        {isPublished ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : (
                          <AlertCircle className="h-4 w-4" />
                        )}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900">{curso.nome}</h4>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-0.5">
                          <span className={`font-medium ${isPublished ? "text-emerald-700" : "text-amber-700"}`}>
                            {isPublished ? "Currículo Publicado" : "Rascunho"}
                          </span>
                          <span>•</span>
                          <span>v.{curriculo?.version ?? 1}</span>
                          <span>•</span>
                          <span>{classesDoCurso} classes base</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openModal(curso.id, "disciplinas")}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Disciplinas
                      </button>
                      <button
                        type="button"
                        onClick={() => openModal(curso.id, "classes")}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Classes base
                      </button>
                      {!isPublished ? (
                        <button
                          type="button"
                          onClick={() => openModal(curso.id, "publish")}
                          className="inline-flex items-center gap-2 rounded-xl bg-klasse-gold px-3 py-2 text-xs font-semibold text-white hover:brightness-95"
                        >
                          <BookOpenCheck className="h-4 w-4" />
                          Publicar
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openModal(curso.id, "generate")}
                          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                        >
                          <Wand2 className="h-4 w-4" />
                          Gerar turmas
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <Link
          href={escolaId ? `/escola/${escolaId}/admin/turmas` : "#"}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 sm:w-auto"
        >
          <span>Gerenciar turmas manualmente</span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {modal === "publish" && selectedCurso && selectedCurriculo && (
        <ModalShell
          title="Publicar currículo"
          subtitle="Publicação trava o currículo para geração de turmas."
          onClose={closeModal}
          footer={
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={publishConfirm}
                  onChange={(e) => setPublishConfirm(e.target.checked)}
                />
                Confirmo que entendo a publicação.
              </div>
              <button
                type="button"
                onClick={handlePublish}
                disabled={!publishConfirm || modalActionLoading}
                className="inline-flex items-center gap-2 rounded-xl bg-klasse-gold px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
              >
                {modalActionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpenCheck className="h-4 w-4" />}
                Publicar currículo
              </button>
            </div>
          }
        >
          <div className="space-y-3 text-sm text-slate-600">
            <p>
              Curso: <span className="font-semibold text-slate-900">{selectedCurso.nome}</span>
            </p>
            <p>
              Versão atual: <span className="font-semibold">v.{selectedCurriculo.version}</span>
            </p>
            <p>
              Status: <span className="font-semibold">{selectedCurriculo.status}</span>
            </p>
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs">
              <p className="font-semibold text-slate-800">Impacto estimado</p>
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="rounded-lg border border-slate-200 px-3 py-2">
                  Turmas afetadas: {impact.turmas ?? "-"}
                </div>
                <div className="rounded-lg border border-slate-200 px-3 py-2">
                  Alunos afetados: {impact.alunos ?? "-"}
                </div>
                <div className="rounded-lg border border-slate-200 px-3 py-2">
                  Professores: {impact.professores ?? "-"}
                </div>
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={publishRebuild}
                onChange={(e) => setPublishRebuild(e.target.checked)}
              />
              Reconstruir turmas (opcional, destrutivo)
            </label>
          </div>
        </ModalShell>
      )}

      {modal === "classes" && (
        <ModalShell
          title="Classes base do curso"
          subtitle="Cadastre as classes base que alimentam o gerador."
          onClose={closeModal}
          footer={
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() =>
                  setClassesDrafts((prev) => [
                    ...prev,
                    {
                      id: `new-${Date.now()}`,
                      nome: "",
                      turno: "M",
                      isNew: true,
                      isDirty: true,
                    },
                  ])
                }
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Plus className="h-4 w-4" /> Nova classe
              </button>
              <button
                type="button"
                onClick={handleSaveClasses}
                disabled={modalActionLoading}
                className="inline-flex items-center gap-2 rounded-xl bg-klasse-gold px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
              >
                {modalActionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar mudanças"}
              </button>
            </div>
          }
        >
          {modalLoading ? (
            <div className="py-10 flex justify-center">
              <Loader2 className="animate-spin text-slate-300" />
            </div>
          ) : (
            <div className="space-y-3">
              {classesDrafts.map((row) => (
                <div key={row.id} className="flex flex-wrap items-center gap-2">
                  <input
                    value={row.nome}
                    onChange={(e) =>
                      setClassesDrafts((prev) =>
                        prev.map((item) =>
                          item.id === row.id
                            ? { ...item, nome: e.target.value, isDirty: true }
                            : item
                        )
                      )
                    }
                    className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    placeholder="Ex: 10ª Classe"
                  />
                  <select
                    value={row.turno ?? "M"}
                    onChange={(e) =>
                      setClassesDrafts((prev) =>
                        prev.map((item) =>
                          item.id === row.id
                            ? { ...item, turno: e.target.value, isDirty: true }
                            : item
                        )
                      )
                    }
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="M">Manhã</option>
                    <option value="T">Tarde</option>
                    <option value="N">Noite</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => handleDeleteClass(row.id)}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-600 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {classesDrafts.length === 0 && (
                <div className="text-sm text-slate-500">Nenhuma classe base cadastrada.</div>
              )}
            </div>
          )}
        </ModalShell>
      )}

      {modal === "generate" && (
        <ModalShell
          title="Gerar turmas"
          subtitle="Configure quantidades por classe e turno."
          onClose={closeModal}
          footer={
            <div className="flex items-center justify-between">
              <div className="text-xs text-slate-500">
                Estimativa: {totalGeneratePreview} turmas
              </div>
              <button
                type="button"
                onClick={handleGenerateTurmas}
                disabled={modalActionLoading}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
              >
                {modalActionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                Gerar turmas
              </button>
            </div>
          }
        >
          {modalLoading ? (
            <div className="py-10 flex justify-center">
              <Loader2 className="animate-spin text-slate-300" />
            </div>
          ) : (
            <div className="space-y-3">
              {generateRows.map((row) => (
                <div key={row.classId} className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-2 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={row.enabled}
                      onChange={(e) =>
                        setGenerateRows((prev) =>
                          prev.map((item) =>
                            item.classId === row.classId
                              ? { ...item, enabled: e.target.checked }
                              : item
                          )
                        )
                      }
                    />
                    {row.nome}
                  </label>
                  <select
                    value={row.turno}
                    onChange={(e) =>
                      setGenerateRows((prev) =>
                        prev.map((item) =>
                          item.classId === row.classId
                            ? { ...item, turno: e.target.value as "M" | "T" | "N" }
                            : item
                        )
                      )
                    }
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="M">Manhã</option>
                    <option value="T">Tarde</option>
                    <option value="N">Noite</option>
                  </select>
                  <input
                    type="number"
                    min={1}
                    value={row.quantidade}
                    onChange={(e) =>
                      setGenerateRows((prev) =>
                        prev.map((item) =>
                          item.classId === row.classId
                            ? { ...item, quantidade: Number(e.target.value || 1) }
                            : item
                        )
                      )
                    }
                    className="w-24 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
              ))}
              {generateRows.length === 0 && (
                <div className="text-sm text-slate-500">Nenhuma classe base disponível.</div>
              )}
            </div>
          )}
        </ModalShell>
      )}

      {modal === "disciplinas" && (
        <ModalShell
          title="Disciplinas do currículo"
          subtitle="Edite disciplinas e requisitos do currículo publicado ou rascunho."
          onClose={closeModal}
          footer={
            <div className="flex justify-end">
              <button
                type="button"
                onClick={openCreateDisciplina}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
              >
                <Plus className="h-4 w-4" /> Nova disciplina
              </button>
            </div>
          }
        >
          {modalLoading ? (
            <div className="py-10 flex justify-center">
              <Loader2 className="animate-spin text-slate-300" />
            </div>
          ) : (
            <div className="space-y-3">
              {(ctx?.disciplinas ?? []).map((disc) => (
                <div key={disc.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                  <div>
                    <div className="font-semibold text-slate-900 flex items-center gap-2">
                      {disc.nome}
                      {disc.is_core && (
                        <span className="rounded-full bg-slate-900 text-white px-2 py-0.5 text-[10px] font-semibold">
                          Core
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 font-mono">
                      {disc.codigo} · {disc.carga_horaria_semanal} aulas/sem ·{" "}
                      {disc.is_avaliavel
                        ? disc.avaliacao_mode === "herdar_escola"
                          ? "Aval: escola"
                          : "Aval: custom"
                        : "Sem nota"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openEditDisciplina(disc)}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteDisciplina(disc.id)}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-700 hover:text-red-600"
                    >
                      Remover
                    </button>
                  </div>
                </div>
              ))}
              {(ctx?.disciplinas ?? []).length === 0 && (
                <div className="text-sm text-slate-500">Nenhuma disciplina cadastrada.</div>
              )}
            </div>
          )}
        </ModalShell>
      )}

      <DisciplinaModal
        open={disciplinaModalOpen}
        mode={disciplinaModalMode}
        initial={disciplinaEditing}
        existingCodes={(ctx?.disciplinas ?? []).map((d) => d.codigo)}
        existingNames={(ctx?.disciplinas ?? []).map((d) => d.nome)}
        existingDisciplines={(ctx?.disciplinas ?? []).map((d) => ({ id: d.id, nome: d.nome }))}
        onClose={() => setDisciplinaModalOpen(false)}
        onSave={handleSaveDisciplina}
        onDelete={disciplinaModalMode === "edit" ? handleDeleteDisciplina : undefined}
      />
    </ConfigSystemShell>
  );
}
