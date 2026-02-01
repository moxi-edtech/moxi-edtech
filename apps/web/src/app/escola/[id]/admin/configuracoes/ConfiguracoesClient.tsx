"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";

// 🔹 O Wizard foi movido para a sua própria página para unificar o fluxo
// import AcademicSetupWizard from "@/components/escola/onboarding/AcademicSetupWizard";
import {
  type AcademicSession,
  type Semester,
  type Course,
  type Class,
  type Discipline,
  type Teacher,
  type ModeloAvaliacao,
} from "@/types/academico.types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CheckCircle2,
  Settings,
  BookOpen,
  Users,
  Calendar,
  GraduationCap,
  Pencil,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

// 🔹 Novo: seletor de modelo curricular
import { CurriculumPresetSelector } from "@/components/escola/onboarding/CurriculumPresetSelector";
import type { CurriculumKey } from "@/lib/onboarding";

export default function ConfiguracoesAcademicasPage() {
  const p = useParams() as Record<string, string | string[] | undefined>;
  const escolaId = useMemo(
    () => (Array.isArray(p.id) ? p.id[0] : (p.id ?? "")),
    [p.id]
  );
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const publishUrl = escolaId
    ? `/escola/${escolaId}/admin/configuracoes/academico-completo`
    : "#";

  const [sessoes, setSessoes] = useState<AcademicSession[]>([]);
  const [sessaoAtiva, setSessaoAtiva] = useState<AcademicSession | null>(null);
  const [periodos, setPeriodos] = useState<Semester[]>([]);
  const [cursos, setCursos] = useState<Course[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [disciplinas, setDisciplinas] = useState<Discipline[]>([]);
  const [modelosAvaliacao, setModelosAvaliacao] = useState<ModeloAvaliacao[]>([]);
  const [professores, setProfessores] = useState<Teacher[]>([]);
  const [tipoPresenca, setTipoPresenca] = useState<"secao" | "curso">("secao");
  const [estrutura, setEstrutura] = useState<"classes" | "secoes" | "cursos">(
    "classes"
  );

  const [setupComplete, setSetupComplete] = useState(false);

  // 🔹 Novo: modelo curricular de referência + loading ao aplicar
  const [curriculumPreset, setCurriculumPreset] =
    useState<CurriculumKey | null>(null);
  const [applyPresetLoading, setApplyPresetLoading] = useState(false);
  const [quickActionLoading, setQuickActionLoading] = useState<string | null>(null);
  const [newClasseForm, setNewClasseForm] = useState({
    nome: "",
    cursoId: "",
    anoLetivoId: "",
    turno: "",
    cargaSemanal: "",
    minCore: "",
  });
  const [newDisciplinaForm, setNewDisciplinaForm] = useState({
    nome: "",
    cursoId: "",
    classeId: "",
    sigla: "",
    cargaSemanal: "",
    area: "",
    isCore: true,
    modeloId: "",
  });
  const [newModeloForm, setNewModeloForm] = useState({
    nome: "",
    componentes: '{"componentes":[{"code":"MAC","peso":50,"ativo":true},{"code":"PT","peso":50,"ativo":true}]}',
    isDefault: false,
  });
  const [editingClasse, setEditingClasse] = useState<Class | null>(null);
  const [editingDisciplina, setEditingDisciplina] = useState<Discipline | null>(null);
  const [editingClasseForm, setEditingClasseForm] = useState({
    nome: "",
    turno: "",
    cargaSemanal: "",
    minCore: "",
  });
  const [editingDisciplinaForm, setEditingDisciplinaForm] = useState({
    nome: "",
    sigla: "",
    cargaSemanal: "",
    area: "",
    isCore: true,
    modeloId: "",
  });

  const defaultModeloAvaliacao = useMemo(
    () => modelosAvaliacao.find((m) => m.is_default) ?? modelosAvaliacao[0] ?? null,
    [modelosAvaliacao]
  );

  const isClasseLocked = useMemo(() => {
    const publishedByClasse = new Map<string, boolean>();
    disciplinas.forEach((disc) => {
      if (!disc.classe_id) return;
      if (disc.curriculo_status === 'published') {
        publishedByClasse.set(disc.classe_id, true);
      }
    });
    return (classeId: string) => publishedByClasse.get(classeId) === true;
  }, [disciplinas]);

  useEffect(() => {
    if (defaultModeloAvaliacao && !newDisciplinaForm.modeloId) {
      setNewDisciplinaForm((prev) => ({ ...prev, modeloId: defaultModeloAvaliacao.id }));
    }
  }, [defaultModeloAvaliacao, newDisciplinaForm.modeloId]);

  // Dados da escola e Danger Zone (wipe)
  const [escolaNome, setEscolaNome] = useState<string>("");
  const [wipeScope, setWipeScope] = useState<"session" | "config" | "all">(
    "session"
  );
  const [wipeIncludes, setWipeIncludes] = useState<string[]>([
    "matriculas",
    "turmas",
    "semestres",
  ]);
  const [wipeSessionId, setWipeSessionId] = useState<string | undefined>(
    undefined
  );
  const [wipeDryCounts, setWipeDryCounts] = useState<Record<string, number>>(
    {}
  );
  const [wipeLoading, setWipeLoading] = useState<"simulate" | "execute" | null>(
    null
  );
  const [wipeConfirm, setWipeConfirm] = useState<string>("");

  useEffect(() => {
    if (!escolaId) return;
    let mounted = true;

    const loadAll = async () => {
      // Nome da escola (para confirmação)
      try {
        const { data: esc } = await supabase
          .from("escolas")
          .select("nome")
          .eq("id", escolaId)
          .maybeSingle();
        if (mounted) {
          setEscolaNome((esc as any)?.nome || "");
        }
      } catch {}

      // Helper: safe select with fallback (ainda disponível se precisar)
      const selectWithFallback = async <T,>(
        table: string,
        full: string,
        minimal: string,
        filter: { col: string; val: string }
      ) => {
        try {
          const { data, error } = await (supabase as any)
            .from(table)
            .select(full)
            .eq(filter.col, filter.val);
          if (!error) return (data as T[]) || [];
        } catch {}
        try {
          const { data } = await (supabase as any)
            .from(table)
            .select(minimal)
            .eq(filter.col, filter.val);
          return (data as T[]) || [];
        } catch {
          return [] as T[];
        }
      };

      const fetchAllPaginated = async <T,>(endpoint: string, limit = 50) => {
        const items: T[] = [];
        let cursor: string | null = null;
        do {
          const url = new URL(endpoint, window.location.origin);
          url.searchParams.set("limit", String(limit));
          if (cursor) url.searchParams.set("cursor", cursor);
          const res = await fetch(url.toString(), { cache: "no-store" });
          const json = await res.json().catch(() => null);
          if (!res.ok || json?.ok === false) {
            throw new Error(json?.error || "Falha ao carregar dados");
          }
          const pageItems = (json?.data ?? json?.items ?? []) as T[];
          items.push(...pageItems);
          cursor = json?.next_cursor ?? null;
        } while (cursor);
        return items;
      };

      // 1) Sessões — usar API (service role) para leitura consistente
      let mapSessions: AcademicSession[] = [];
      try {
        const res = await fetch(
          `/api/escolas/${escolaId}/onboarding/core/session`,
          { cache: "no-store" }
        );
        const json = await res.json().catch(() => null);
        const rows = res.ok && Array.isArray(json?.data) ? json.data : [];
        mapSessions = rows.map((row: any) => ({
          id: row.id,
          nome: row.nome,
          ano_letivo: `${String(row.data_inicio).slice(
            0,
            4
          )}-${String(row.data_fim).slice(0, 4)}`,
          data_inicio: String(row.data_inicio),
          data_fim: String(row.data_fim),
          status: row.status,
        }));
      } catch {}

      if (!mounted) return;
      setSessoes(mapSessions);
      const ativa = mapSessions.find((x) => x.status === "ativa") || null;
      setSessaoAtiva(ativa);
      setWipeSessionId(ativa?.id);
      setNewClasseForm((prev) => ({
        ...prev,
        anoLetivoId: ativa?.id ?? prev.anoLetivoId,
      }));

      // 2) Períodos — usar API (service role) para leitura consistente
      let periodosCountLoaded = 0;
      if (ativa) {
        try {
          const res = await fetch(
            `/api/escolas/${escolaId}/semestres?session_id=${encodeURIComponent(
              ativa.id
            )}`,
            { cache: "no-store" }
          );
          const json = await res.json().catch(() => null);
          const rows: any[] =
            res.ok && Array.isArray(json?.data) ? json.data : [];
          if (mounted) {
            const mapped: Semester[] = rows.map((row: any, idx: number) => ({
              id: row.id,
              nome: row.nome,
              numero: typeof row.numero === "number" ? row.numero : idx + 1,
              data_inicio: String(row.data_inicio),
              data_fim: String(row.data_fim),
              sessao_id: row.sessao_id ?? row.session_id,
            }));
            setPeriodos(mapped);
            periodosCountLoaded = mapped.length;
          }
        } catch {
          if (mounted) {
            setPeriodos([]);
            periodosCountLoaded = 0;
          }
        }
      } else {
        setPeriodos([]);
        periodosCountLoaded = 0;
      }

      // 3) Cursos — usar API (service role) para evitar RLS retornar vazio
      let cursosRows: Course[] = [] as any;
      try {
        cursosRows = await fetchAllPaginated<Course>(`/api/escolas/${escolaId}/cursos`);
        if (mounted) setCursos(cursosRows as any);
      } catch (error) {
        console.warn("Cursos GET error:", error);
      }

      // 4) Classes — usar API para leitura consistente
      let classesRows: Class[] = [] as any;
      try {
        const rows = await fetchAllPaginated<Class>(`/api/escolas/${escolaId}/classes`);
        classesRows = rows.sort(
          (a: any, b: any) => (a?.ordem ?? 0) - (b?.ordem ?? 0)
        );
        if (mounted) setClasses(classesRows as any);
      } catch (error) {
        console.warn("Classes GET error:", error);
      }

      // 5) Disciplinas — usar API para leitura consistente
      let disciplinasRows: Discipline[] = [] as any;
      try {
        disciplinasRows = await fetchAllPaginated<Discipline>(`/api/escolas/${escolaId}/disciplinas`);
        if (mounted) setDisciplinas(disciplinasRows as any);
      } catch (error) {
        console.warn("Disciplinas GET error:", error);
      }

      try {
        const res = await fetch(`/api/escolas/${escolaId}/modelos-avaliacao`, { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (mounted && res.ok && Array.isArray(json?.data)) {
          setModelosAvaliacao(json.data as ModeloAvaliacao[]);
        }
      } catch (error) {
        console.warn("Modelos avaliação GET error:", error);
      }

      // 6) Preferências
      try {
        const res = await fetch(
          `/api/escolas/${escolaId}/onboarding/preferences`,
          { cache: "no-store" }
        );
        const json = await res.json().catch(() => null);
        if (mounted && res.ok && json?.data) {
          if (
            json.data.tipo_presenca === "secao" ||
            json.data.tipo_presenca === "curso"
          ) {
            setTipoPresenca(json.data.tipo_presenca);
          }
          if (["classes", "secoes", "cursos"].includes(json.data.estrutura)) {
            setEstrutura(json.data.estrutura);
          }
          // 🔹 Novo: preset curricular salvo nas preferências
          if (json.data.curriculum_preset_key) {
            setCurriculumPreset(
              json.data.curriculum_preset_key as CurriculumKey
            );
          }
        }
      } catch {}

      // 7) Professores
      try {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, nome, email, role")
          .eq("current_escola_id", escolaId);
        if (mounted) {
          const mapped: Teacher[] = (profs || [])
            .filter((p: any) =>
              String(p.role || "").toLowerCase().includes("teacher")
            )
            .map((p: any) => ({
              id: p.user_id,
              nome: p.nome,
              email: p.email || "",
            }));
          setProfessores(mapped);
        }
      } catch {}

      // Verificar se configuração básica está completa
      if (mounted) {
        const hasBasicConfig = Boolean(
          ativa &&
            periodosCountLoaded > 0 &&
            (Array.isArray(classesRows) ? classesRows.length > 0 : false) &&
            (Array.isArray(disciplinasRows)
              ? disciplinasRows.length > 0
              : false)
        );
        setSetupComplete(hasBasicConfig);
      }
    };

    loadAll();
    return () => {
      mounted = false;
    };
  }, [escolaId, supabase]);

// 🔹 Novo: aplicar modelo curricular de referência
const handleApplyCurriculumPreset = async () => {
  if (!escolaId || !curriculumPreset) return;

  setApplyPresetLoading(true);
  const toastId = toast.loading("Aplicando modelo curricular...");

  try {
    // 1) Aplica o preset no backend
      const res = await fetch(
        `/api/escola/${escolaId}/admin/curriculo/install-preset`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          presetKey: curriculumPreset,
          ano_letivo_id: sessaoAtiva?.id ?? undefined,
          options: { autoPublish: true, generateTurmas: true },
          // se depois quisermos semântica de overwrite, mandamos aqui
          // overwrite: false,
        }),
      }
    );

    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok) {
      const step = json?.step;
      if (step === 'publish') {
        throw new Error(json?.message || json?.error || 'Falha ao publicar currículo.');
      }
      if (step === 'generate_turmas') {
        throw new Error(json?.message || json?.error || 'Falha ao gerar turmas.');
      }
      throw new Error(json?.message || json?.error || "Falha ao aplicar modelo curricular.");
    }

    // 2) Recarrega cursos, classes e disciplinas usando as APIs oficiais
    const [cursosRes, classesRes, disciplinasRes] = await Promise.all([
      fetch(`/api/escolas/${escolaId}/cursos`, { cache: "no-store" }),
      fetch(`/api/escolas/${escolaId}/classes`, { cache: "no-store" }),
      fetch(`/api/escolas/${escolaId}/disciplinas`, { cache: "no-store" }),
    ]);

    const cursosJson = await cursosRes.json().catch(() => null);
    const classesJson = await classesRes.json().catch(() => null);
    const disciplinasJson = await disciplinasRes.json().catch(() => null);

    if (cursosRes.ok && Array.isArray(cursosJson?.data)) {
      setCursos(cursosJson.data as Course[]);
    }
    if (classesRes.ok && Array.isArray(classesJson?.data)) {
      const rows = (classesJson.data as any[]).sort(
        (a, b) => (a?.ordem ?? 0) - (b?.ordem ?? 0)
      );
      setClasses(rows as Class[]);
    }
    if (disciplinasRes.ok && Array.isArray(disciplinasJson?.data)) {
      setDisciplinas(disciplinasJson.data as Discipline[]);
    }

    // 3) Usar o summary devolvido pelo backend para o toast legal
    const s = json.summary || json.data?.summary;
    if (s) {
      const msg = [
        s.disciplinas?.created ? `+${s.disciplinas.created} disciplinas` : null,
        s.classes?.created ? `+${s.classes.created} classes` : null,
        s.cursos?.created ? `+${s.cursos.created} cursos` : null,
      ]
        .filter(Boolean)
        .join(", ");

      toast.success(
        msg
          ? `Modelo aplicado: ${msg}.`
          : "Modelo curricular aplicado com sucesso.",
        { id: toastId }
      );
    } else {
      toast.success("Modelo curricular aplicado com sucesso.", { id: toastId });
    }
  } catch (e: any) {
    toast.error(e.message || "Erro ao aplicar modelo curricular.", {
      id: toastId,
    });
  } finally {
    setApplyPresetLoading(false);
  }
};

  // Configuração completa - mostrar dashboard
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <Dialog open={!!editingClasse} onOpenChange={(open) => !open && setEditingClasse(null)}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Editar classe</DialogTitle>
            <DialogDescription>
              Ajuste o turno e a carga horária semanal com segurança.
            </DialogDescription>
          </DialogHeader>
          {editingClasse && isClasseLocked(editingClasse.id) && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Esta classe está vinculada a currículo publicado e é somente leitura.
            </div>
          )}
          <div className="space-y-3">
            <label className="text-xs text-slate-600">Nome</label>
            <input
              className="w-full rounded border border-slate-200 px-2 py-2 text-sm"
              value={editingClasseForm.nome}
              onChange={(e) => setEditingClasseForm((prev) => ({ ...prev, nome: e.target.value }))}
              disabled={editingClasse ? isClasseLocked(editingClasse.id) : false}
            />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-slate-600">Turno</label>
                <select
                  className="w-full rounded border border-slate-200 px-2 py-2 text-sm"
                  value={editingClasseForm.turno}
                  onChange={(e) => setEditingClasseForm((prev) => ({ ...prev, turno: e.target.value }))}
                  disabled={editingClasse ? isClasseLocked(editingClasse.id) : false}
                >
                  <option value="">Não definido</option>
                  <option value="M">Manhã</option>
                  <option value="T">Tarde</option>
                  <option value="N">Noite</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-600">Carga semanal (h)</label>
                <input
                  className="w-full rounded border border-slate-200 px-2 py-2 text-sm"
                  value={editingClasseForm.cargaSemanal}
                  onChange={(e) => setEditingClasseForm((prev) => ({ ...prev, cargaSemanal: e.target.value }))}
                  disabled={editingClasse ? isClasseLocked(editingClasse.id) : false}
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-600">Mínimo de disciplinas core</label>
              <input
                className="w-full rounded border border-slate-200 px-2 py-2 text-sm"
                value={editingClasseForm.minCore}
                onChange={(e) => setEditingClasseForm((prev) => ({ ...prev, minCore: e.target.value }))}
                disabled={editingClasse ? isClasseLocked(editingClasse.id) : false}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingClasse(null)}>
              Cancelar
            </Button>
            <Button
              disabled={!editingClasse || isClasseLocked(editingClasse.id)}
              onClick={async () => {
                if (!editingClasse || !escolaId) return;
                try {
                  const res = await fetch(`/api/escolas/${escolaId}/classes/${editingClasse.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      nome: editingClasseForm.nome.trim(),
                      turno: editingClasseForm.turno || null,
                      carga_horaria_semanal: editingClasseForm.cargaSemanal ? Number(editingClasseForm.cargaSemanal) : null,
                      min_disciplinas_core: editingClasseForm.minCore ? Number(editingClasseForm.minCore) : null,
                    }),
                  });
                  const json = await res.json().catch(() => null);
                  if (!res.ok || !json?.ok) throw new Error(json?.error || 'Falha ao atualizar classe');
                  setClasses((prev) => prev.map((x:any) => x.id === editingClasse.id ? { ...x, ...json.data } : x));
                  setEditingClasse(null);
                } catch (e:any) {
                  toast.error(e?.message || 'Erro ao atualizar classe');
                }
              }}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingDisciplina} onOpenChange={(open) => !open && setEditingDisciplina(null)}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Editar disciplina</DialogTitle>
            <DialogDescription>
              Ajuste modelo de avaliação e carga semanal.
            </DialogDescription>
          </DialogHeader>
          {editingDisciplina?.curriculo_status === 'published' && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Esta disciplina está publicada e não pode ser alterada.
            </div>
          )}
          <div className="space-y-3">
            <label className="text-xs text-slate-600">Nome</label>
            <input
              className="w-full rounded border border-slate-200 px-2 py-2 text-sm"
              value={editingDisciplinaForm.nome}
              onChange={(e) => setEditingDisciplinaForm((prev) => ({ ...prev, nome: e.target.value }))}
              disabled={editingDisciplina?.curriculo_status === 'published'}
            />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-slate-600">Sigla</label>
                <input
                  className="w-full rounded border border-slate-200 px-2 py-2 text-sm"
                  value={editingDisciplinaForm.sigla}
                  onChange={(e) => setEditingDisciplinaForm((prev) => ({ ...prev, sigla: e.target.value }))}
                  disabled={editingDisciplina?.curriculo_status === 'published'}
                />
              </div>
              <div>
                <label className="text-xs text-slate-600">Carga semanal (h)</label>
                <input
                  className="w-full rounded border border-slate-200 px-2 py-2 text-sm"
                  value={editingDisciplinaForm.cargaSemanal}
                  onChange={(e) => setEditingDisciplinaForm((prev) => ({ ...prev, cargaSemanal: e.target.value }))}
                  disabled={editingDisciplina?.curriculo_status === 'published'}
                />
              </div>
            </div>
            <label className="text-xs text-slate-600">Área</label>
            <input
              className="w-full rounded border border-slate-200 px-2 py-2 text-sm"
              value={editingDisciplinaForm.area}
              onChange={(e) => setEditingDisciplinaForm((prev) => ({ ...prev, area: e.target.value }))}
              disabled={editingDisciplina?.curriculo_status === 'published'}
            />
            <label className="text-xs text-slate-600">Modelo de avaliação</label>
            <select
              className="w-full rounded border border-slate-200 px-2 py-2 text-sm"
              value={editingDisciplinaForm.modeloId}
              onChange={(e) => setEditingDisciplinaForm((prev) => ({ ...prev, modeloId: e.target.value }))}
              disabled={editingDisciplina?.curriculo_status === 'published'}
            >
              <option value="">Selecione</option>
              {modelosAvaliacao.map((m) => (
                <option key={m.id} value={m.id}>{m.nome}</option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={editingDisciplinaForm.isCore}
                onChange={(e) => setEditingDisciplinaForm((prev) => ({ ...prev, isCore: e.target.checked }))}
                disabled={editingDisciplina?.curriculo_status === 'published'}
              />
              Disciplina core
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingDisciplina(null)}>
              Cancelar
            </Button>
            <Button
              disabled={!editingDisciplina || editingDisciplina?.curriculo_status === 'published'}
              onClick={async () => {
                if (!editingDisciplina || !escolaId) return;
                try {
                  const res = await fetch(`/api/escolas/${escolaId}/disciplinas/${editingDisciplina.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      nome: editingDisciplinaForm.nome.trim(),
                      sigla: editingDisciplinaForm.sigla || null,
                      carga_horaria_semana: editingDisciplinaForm.cargaSemanal ? Number(editingDisciplinaForm.cargaSemanal) : null,
                      area: editingDisciplinaForm.area || null,
                      is_core: editingDisciplinaForm.isCore,
                      aplica_modelo_avaliacao_id: editingDisciplinaForm.modeloId || null,
                    }),
                  });
                  const json = await res.json().catch(() => null);
                  if (!res.ok || !json?.ok) throw new Error(json?.error || 'Falha ao atualizar disciplina');
                  setDisciplinas((prev) => prev.map((x:any) => x.id === editingDisciplina.id ? { ...x, ...json.data } : x));
                  setEditingDisciplina(null);
                } catch (e:any) {
                  toast.error(e?.message || 'Erro ao atualizar disciplina');
                }
              }}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <header className="text-center">
        <h1 className="text-3xl font-bold text-[#0B2C45]">
          Configurações Acadêmicas
        </h1>
        <p className="text-gray-600">
          {setupComplete
            ? "Sua estrutura acadêmica está configurada e pronta para uso"
            : "Configuração incompleta. Use o assistente para concluir a estrutura"}
        </p>
      </header>

      {/* Banner de status */}
      {setupComplete ? (
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
              <div>
                <h3 className="font-semibold text-green-900">
                  Configuração Acadêmica Completa! 🎉
                </h3>
                <p className="text-green-700 text-sm">
                  Todos os componentes acadêmicos estão configurados e prontos
                  para uso
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-6">
            <div className="flex items-center gap-4 justify-between">
              <div className="text-amber-900">
                <h3 className="font-semibold">Configuração incompleta</h3>
                <p className="text-sm">
                  Abra o assistente para criar a sessão acadêmica, períodos,
                  classes e disciplinas.
                </p>
              </div>
              <Button onClick={() => router.push(`/escola/${escolaId}/configuracoes/onboarding`)} variant="default">
                Abrir assistente
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resumo da Configuração */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Sessão Ativa
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-gray-900">
              {sessaoAtiva ? sessaoAtiva.nome : "Nenhuma"}
            </p>
            <p className="text-sm text-gray-600">
              {sessaoAtiva ? "Ano Letivo" : "Configure uma sessão"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              Períodos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-gray-900">
              {periodos.length}
            </p>
            <p className="text-sm text-gray-600">Configurados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="w-4 h-4" />
              Classes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-gray-900">
              {classes.length}
            </p>
            <p className="text-sm text-gray-600">Criadas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <GraduationCap className="w-4 h-4" />
              Disciplinas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-gray-900">
              {disciplinas.length}
            </p>
            <p className="text-sm text-gray-600">Cadastradas</p>
          </CardContent>
        </Card>
      </div>

      {/* Configurações Avançadas */}
      <div className="space-y-6">
        {/* Gerenciar estrutura: Classes, Cursos, Disciplinas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#0B2C45]">
              <Users className="w-5 h-5" />
              Gerenciar Estrutura
            </CardTitle>
            <CardDescription>Edite ou remova itens existentes.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Classes */}
            <section>
              <h3 className="text-sm font-semibold text-[#0B2C45] mb-2">Classes</h3>
              {classes.length === 0 ? (
                <p className="text-sm text-gray-500">Nenhuma classe cadastrada.</p>
              ) : (
                <ul className="divide-y divide-slate-200 rounded border">
                  {classes.slice(0, 10).map((c: any) => (
                    <li key={c.id} className="flex items-center justify-between px-3 py-2">
                      <div>
                        <span className="text-sm text-[#0B2C45]">{c.nome}</span>
                        <p className="text-xs text-slate-500">
                          {c.turno ? `Turno ${c.turno}` : 'Turno indefinido'}
                          {c.carga_horaria_semanal ? ` · ${c.carga_horaria_semanal}h/sem` : ''}
                          {typeof c.min_disciplinas_core === 'number' ? ` · Core mín.: ${c.min_disciplinas_core}` : ''}
                          {isClasseLocked(c.id) ? ' · Publicada' : ''}
                        </p>
                        {isClasseLocked(c.id) && (
                          <div className="mt-1 inline-flex items-center gap-2 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">
                            Currículo publicado — edição bloqueada
                            <Link className="underline" href={publishUrl}>
                              Solicitar nova versão
                            </Link>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded border hover:bg-slate-50 disabled:opacity-50"
                          disabled={isClasseLocked(c.id)}
                          onClick={() => {
                            if (isClasseLocked(c.id)) {
                              toast.error('Classe vinculada a currículo publicado.');
                              return;
                            }
                            setEditingClasse(c);
                            setEditingClasseForm({
                              nome: c.nome ?? '',
                              turno: c.turno ?? '',
                              cargaSemanal: c.carga_horaria_semanal ? String(c.carga_horaria_semanal) : '',
                              minCore: typeof c.min_disciplinas_core === 'number' ? String(c.min_disciplinas_core) : '',
                            });
                          }}
                        >
                          <Pencil className="w-3.5 h-3.5" /> Editar
                        </button>
                        <button
                          className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50"
                          disabled={isClasseLocked(c.id)}
                          onClick={async () => {
                            if (isClasseLocked(c.id)) {
                              toast.error('Classe vinculada a currículo publicado.');
                              return;
                            }
                            if (!window.confirm(`Remover classe "${c.nome}"? Esta ação não pode ser desfeita.`)) return;
                            try {
                              const res = await fetch(`/api/escolas/${escolaId}/classes/${c.id}`, { method: 'DELETE' });
                              const json = await res.json().catch(()=>null);
                              if (!res.ok || !json?.ok) throw new Error(json?.error || 'Falha ao remover classe');
                              setClasses(prev => prev.filter((x:any)=> x.id !== c.id));
                            } catch (e:any) { toast.error(e?.message || 'Erro ao remover classe'); }
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Remover
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Cursos */}
            <section>
              <h3 className="text-sm font-semibold text-[#0B2C45] mb-2">Cursos</h3>
              {cursos.length === 0 ? (
                <p className="text-sm text-gray-500">Nenhum curso cadastrado.</p>
              ) : (
                <ul className="divide-y divide-slate-200 rounded border">
                  {cursos.slice(0, 10).map((c: any) => (
                    <li key={c.id} className="flex items-center justify-between px-3 py-2">
                      <span className="text-sm text-[#0B2C45]">{c.nome}</span>
                      <div className="flex items-center gap-2">
                        <button
                          className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded border hover:bg-slate-50"
                          onClick={async () => {
                            const novo = window.prompt('Novo nome do curso', c.nome);
                            if (!novo || novo.trim() === c.nome) return;
                            try {
                              const res = await fetch(`/api/escolas/${escolaId}/cursos/${c.id}`, {
                                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome: novo.trim() })
                              });
                              const json = await res.json().catch(()=>null);
                              if (!res.ok || !json?.ok) throw new Error(json?.error || 'Falha ao atualizar curso');
                              setCursos(prev => prev.map((x:any)=> x.id===c.id ? { ...x, nome: novo.trim() } : x));
                            } catch (e:any) { toast.error(e?.message || 'Erro ao atualizar curso'); }
                          }}
                        >
                          <Pencil className="w-3.5 h-3.5" /> Editar
                        </button>
                        <button
                          className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded border border-red-300 text-red-700 hover:bg-red-50"
                          onClick={async () => {
                            if (!window.confirm(`Remover curso "${c.nome}"? Esta ação não pode ser desfeita.`)) return;
                            try {
                              const res = await fetch(`/api/escolas/${escolaId}/cursos/${c.id}`, { method: 'DELETE' });
                              const json = await res.json().catch(()=>null);
                              if (!res.ok || !json?.ok) throw new Error(json?.error || 'Falha ao remover curso');
                              setCursos(prev => prev.filter((x:any)=> x.id !== c.id));
                            } catch (e:any) { toast.error(e?.message || 'Erro ao remover curso'); }
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Remover
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Disciplinas */}
            <section>
              <h3 className="text-sm font-semibold text-[#0B2C45] mb-2">Disciplinas</h3>
              {disciplinas.length === 0 ? (
                <p className="text-sm text-gray-500">Nenhuma disciplina cadastrada.</p>
              ) : (
                <ul className="divide-y divide-slate-200 rounded border">
                  {disciplinas.slice(0, 10).map((d: any) => (
                    <li key={d.id} className="flex items-center justify-between px-3 py-2">
                      <div>
                        <span className="text-sm text-[#0B2C45]">{d.nome}</span>
                        <p className="text-xs text-slate-500">
                          {d.sigla ? `Sigla ${d.sigla}` : 'Sem sigla'}
                          {d.carga_horaria_semana ? ` · ${d.carga_horaria_semana}h/sem` : ''}
                          {d.is_core ? ' · Core' : ' · Eletiva'}
                          {d.curriculo_status === 'published' ? ' · Publicada' : ''}
                        </p>
                        {d.curriculo_status === 'published' && (
                          <div className="mt-1 inline-flex items-center gap-2 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">
                            Currículo publicado — edição bloqueada
                            <Link className="underline" href={publishUrl}>
                              Solicitar nova versão
                            </Link>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded border hover:bg-slate-50 disabled:opacity-50"
                          disabled={d.curriculo_status === 'published'}
                          onClick={async () => {
                            if (d.curriculo_status === 'published') {
                              toast.error('Disciplina publicada não pode ser editada.');
                              return;
                            }
                            setEditingDisciplina(d);
                            setEditingDisciplinaForm({
                              nome: d.nome ?? '',
                              sigla: d.sigla ?? '',
                              cargaSemanal: d.carga_horaria_semana ? String(d.carga_horaria_semana) : '',
                              area: d.area ?? '',
                              isCore: d.is_core ?? true,
                              modeloId: d.aplica_modelo_avaliacao_id ?? defaultModeloAvaliacao?.id ?? '',
                            });
                          }}
                        >
                          <Pencil className="w-3.5 h-3.5" /> Editar
                        </button>
                        <button
                          className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50"
                          disabled={d.curriculo_status === 'published'}
                          onClick={async () => {
                            if (d.curriculo_status === 'published') {
                              toast.error('Disciplina publicada não pode ser removida.');
                              return;
                            }
                            if (!window.confirm(`Remover disciplina "${d.nome}"? Esta ação não pode ser desfeita.`)) return;
                            try {
                              const res = await fetch(`/api/escolas/${escolaId}/disciplinas/${d.id}`, { method: 'DELETE' });
                              const json = await res.json().catch(()=>null);
                              if (!res.ok || !json?.ok) throw new Error(json?.error || 'Falha ao remover disciplina');
                              setDisciplinas(prev => prev.filter((x:any)=> x.id !== d.id));
                            } catch (e:any) { toast.error(e?.message || 'Erro ao remover disciplina'); }
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Remover
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

          </CardContent>
        </Card>
        {/* Ações rápidas: criar itens pós-onboarding */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#0B2C45]">
              <Settings className="w-5 h-5" />
              Ações Rápidas
            </CardTitle>
            <CardDescription>
              Crie novos elementos acadêmicos mesmo após o onboarding.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-lg border border-slate-200 p-3 space-y-2">
                  <h4 className="text-xs font-semibold text-slate-600">Nova Classe</h4>
                  <input
                    className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                    placeholder="Nome da classe"
                    value={newClasseForm.nome}
                    onChange={(e) => setNewClasseForm((prev) => ({ ...prev, nome: e.target.value }))}
                  />
                  <select
                    className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                    value={newClasseForm.cursoId}
                    onChange={(e) => setNewClasseForm((prev) => ({ ...prev, cursoId: e.target.value }))}
                  >
                    <option value="">Curso</option>
                    {cursos.map((c) => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                  <select
                    className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                    value={newClasseForm.anoLetivoId}
                    onChange={(e) => setNewClasseForm((prev) => ({ ...prev, anoLetivoId: e.target.value }))}
                  >
                    <option value="">Ano letivo</option>
                    {sessoes.map((s) => (
                      <option key={s.id} value={s.id}>{s.nome}</option>
                    ))}
                  </select>
                  <select
                    className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                    value={newClasseForm.turno}
                    onChange={(e) => setNewClasseForm((prev) => ({ ...prev, turno: e.target.value }))}
                  >
                    <option value="">Turno</option>
                    <option value="M">Manhã</option>
                    <option value="T">Tarde</option>
                    <option value="N">Noite</option>
                  </select>
                  <input
                    className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                    placeholder="Carga semanal (h)"
                    value={newClasseForm.cargaSemanal}
                    onChange={(e) => setNewClasseForm((prev) => ({ ...prev, cargaSemanal: e.target.value }))}
                  />
                  <input
                    className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                    placeholder="Mín. core"
                    value={newClasseForm.minCore}
                    onChange={(e) => setNewClasseForm((prev) => ({ ...prev, minCore: e.target.value }))}
                  />
                  <Button
                    variant="default"
                    disabled={!!quickActionLoading}
                    onClick={async () => {
                      if (!escolaId) return;
                      if (!newClasseForm.nome || !newClasseForm.cursoId) {
                        toast.error('Informe nome e curso.');
                        return;
                      }
                      setQuickActionLoading('classe');
                      try {
                        const res = await fetch(`/api/escolas/${escolaId}/classes`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            nome: newClasseForm.nome,
                            curso_id: newClasseForm.cursoId,
                            ano_letivo_id: newClasseForm.anoLetivoId || null,
                            turno: newClasseForm.turno || null,
                            carga_horaria_semanal: newClasseForm.cargaSemanal ? Number(newClasseForm.cargaSemanal) : null,
                            min_disciplinas_core: newClasseForm.minCore ? Number(newClasseForm.minCore) : null,
                          }),
                        });
                        const json = await res.json().catch(() => null);
                        if (!res.ok || !json?.ok) throw new Error(json?.error || 'Falha ao criar classe');
                        toast.success('Classe criada');
                        const r = await fetch(`/api/escolas/${escolaId}/classes`, { cache: 'no-store' });
                        const j = await r.json().catch(() => null);
                        if (r.ok && Array.isArray(j?.data)) setClasses(j.data as any);
                    setNewClasseForm({
                      nome: "",
                      cursoId: newClasseForm.cursoId,
                      anoLetivoId: newClasseForm.anoLetivoId,
                      turno: "",
                      cargaSemanal: "",
                      minCore: "",
                    });
                      } catch (e: any) {
                        toast.error(e?.message || 'Erro ao criar classe');
                      } finally {
                        setQuickActionLoading(null);
                      }
                    }}
                  >
                    Criar Classe
                  </Button>
                </div>

                <div className="rounded-lg border border-slate-200 p-3 space-y-2">
                  <h4 className="text-xs font-semibold text-slate-600">Nova Disciplina</h4>
                  <input
                    className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                    placeholder="Nome"
                    value={newDisciplinaForm.nome}
                    onChange={(e) => setNewDisciplinaForm((prev) => ({ ...prev, nome: e.target.value }))}
                  />
                  <select
                    className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                    value={newDisciplinaForm.cursoId}
                    onChange={(e) => {
                      const cursoId = e.target.value;
                      const classe = classes.find((c) => c.curso_id === cursoId);
                      setNewDisciplinaForm((prev) => ({
                        ...prev,
                        cursoId,
                        classeId: classe?.id ?? "",
                      }));
                    }}
                  >
                    <option value="">Curso</option>
                    {cursos.map((c) => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                  <select
                    className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                    value={newDisciplinaForm.classeId}
                    onChange={(e) => setNewDisciplinaForm((prev) => ({ ...prev, classeId: e.target.value }))}
                  >
                    <option value="">Classe</option>
                    {classes
                      .filter((c) => !newDisciplinaForm.cursoId || c.curso_id === newDisciplinaForm.cursoId)
                      .map((c) => (
                        <option key={c.id} value={c.id}>{c.nome}</option>
                      ))}
                  </select>
                  <input
                    className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                    placeholder="Sigla"
                    value={newDisciplinaForm.sigla}
                    onChange={(e) => setNewDisciplinaForm((prev) => ({ ...prev, sigla: e.target.value }))}
                  />
                  <input
                    className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                    placeholder="Carga semanal (h)"
                    value={newDisciplinaForm.cargaSemanal}
                    onChange={(e) => setNewDisciplinaForm((prev) => ({ ...prev, cargaSemanal: e.target.value }))}
                  />
                  <input
                    className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                    placeholder="Área"
                    value={newDisciplinaForm.area}
                    onChange={(e) => setNewDisciplinaForm((prev) => ({ ...prev, area: e.target.value }))}
                  />
                  <select
                    className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                    value={newDisciplinaForm.modeloId}
                    onChange={(e) => setNewDisciplinaForm((prev) => ({ ...prev, modeloId: e.target.value }))}
                  >
                    <option value="">Modelo de avaliação</option>
                    {modelosAvaliacao.map((m) => (
                      <option key={m.id} value={m.id}>{m.nome}</option>
                    ))}
                  </select>
                  <label className="flex items-center gap-2 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={newDisciplinaForm.isCore}
                      onChange={(e) => setNewDisciplinaForm((prev) => ({ ...prev, isCore: e.target.checked }))}
                    />
                    Disciplina core
                  </label>
                  <Button
                    variant="default"
                    disabled={!!quickActionLoading}
                    onClick={async () => {
                      if (!escolaId) return;
                      if (!newDisciplinaForm.nome || !newDisciplinaForm.cursoId || !newDisciplinaForm.classeId) {
                        toast.error('Informe nome, curso e classe.');
                        return;
                      }
                      const modeloId = newDisciplinaForm.modeloId || defaultModeloAvaliacao?.id || "";
                      if (!modeloId) {
                        toast.error('Selecione um modelo de avaliação.');
                        return;
                      }
                      setQuickActionLoading('disciplina');
                      try {
                        const res = await fetch(`/api/escolas/${escolaId}/disciplinas`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            nome: newDisciplinaForm.nome,
                            curso_id: newDisciplinaForm.cursoId,
                            classe_id: newDisciplinaForm.classeId,
                            sigla: newDisciplinaForm.sigla || null,
                            carga_horaria_semana: newDisciplinaForm.cargaSemanal ? Number(newDisciplinaForm.cargaSemanal) : null,
                            area: newDisciplinaForm.area || null,
                            is_core: newDisciplinaForm.isCore,
                            aplica_modelo_avaliacao_id: modeloId,
                          }),
                        });
                        const json = await res.json().catch(() => null);
                        if (!res.ok || !json?.ok) throw new Error(json?.error || 'Falha ao criar disciplina');
                        toast.success('Disciplina criada');
                        const r = await fetch(`/api/escolas/${escolaId}/disciplinas`, { cache: 'no-store' });
                        const j = await r.json().catch(() => null);
                        if (r.ok && Array.isArray(j?.data)) setDisciplinas(j.data as any);
                        setNewDisciplinaForm({
                          nome: "",
                          cursoId: newDisciplinaForm.cursoId,
                          classeId: newDisciplinaForm.classeId,
                          sigla: "",
                          cargaSemanal: "",
                          area: "",
                          isCore: true,
                          modeloId: newDisciplinaForm.modeloId,
                        });
                      } catch (e: any) {
                        toast.error(e?.message || 'Erro ao criar disciplina');
                      } finally {
                        setQuickActionLoading(null);
                      }
                    }}
                  >
                    Criar Disciplina
                  </Button>
                </div>

                <div className="rounded-lg border border-slate-200 p-3 space-y-2">
                  <h4 className="text-xs font-semibold text-slate-600">Novo Modelo de Avaliação</h4>
                  <input
                    className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                    placeholder="Nome do modelo"
                    value={newModeloForm.nome}
                    onChange={(e) => setNewModeloForm((prev) => ({ ...prev, nome: e.target.value }))}
                  />
                  <textarea
                    className="w-full rounded border border-slate-200 px-2 py-1 text-xs min-h-[90px]"
                    value={newModeloForm.componentes}
                    onChange={(e) => setNewModeloForm((prev) => ({ ...prev, componentes: e.target.value }))}
                  />
                  <label className="flex items-center gap-2 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={newModeloForm.isDefault}
                      onChange={(e) => setNewModeloForm((prev) => ({ ...prev, isDefault: e.target.checked }))}
                    />
                    Definir como padrão
                  </label>
                  <Button
                    variant="default"
                    disabled={!!quickActionLoading}
                    onClick={async () => {
                      if (!escolaId) return;
                      if (!newModeloForm.nome.trim()) {
                        toast.error('Informe o nome do modelo.');
                        return;
                      }
                      let componentes: Record<string, any> = {};
                      try {
                        componentes = newModeloForm.componentes ? JSON.parse(newModeloForm.componentes) : {};
                      } catch {
                        toast.error('JSON inválido para componentes.');
                        return;
                      }
                      setQuickActionLoading('modelo');
                      try {
                        const res = await fetch(`/api/escolas/${escolaId}/modelos-avaliacao`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ nome: newModeloForm.nome.trim(), componentes, is_default: newModeloForm.isDefault }),
                        });
                        const json = await res.json().catch(() => null);
                        if (!res.ok || !json?.ok) throw new Error(json?.error || 'Falha ao criar modelo');
                        setModelosAvaliacao((prev) => [json.data, ...prev.filter((m:any) => m.id !== json.data.id)]);
                        if (newModeloForm.isDefault) {
                          setModelosAvaliacao((prev) => prev.map((m:any) => ({ ...m, is_default: m.id === json.data.id })));
                        }
                        toast.success('Modelo criado');
                        setNewModeloForm({ nome: "", componentes: newModeloForm.componentes, isDefault: false });
                      } catch (e:any) {
                        toast.error(e?.message || 'Erro ao criar modelo');
                      } finally {
                        setQuickActionLoading(null);
                      }
                    }}
                  >
                    Criar Modelo
                  </Button>
                </div>
              </div>

              <Button
                variant="outline"
                disabled={!!quickActionLoading}
                onClick={async () => {
                  if (!escolaId) return;
                  setQuickActionLoading('backfill');
                  try {
                    const res = await fetch(`/api/escolas/${escolaId}/academico/offers/backfill`, { method: 'POST' });
                    const json = await res.json().catch(() => null);
                    if (!res.ok || !json?.ok) throw new Error(json?.error || 'Falha ao completar ofertas');
                    toast.success(`Ofertas criadas/atualizadas: ${json.updated ?? 0}`);
                  } catch (e: any) {
                    toast.error(e?.message || 'Erro ao completar ofertas');
                  } finally {
                    setQuickActionLoading(null);
                  }
                }}
              >
                Completar Ofertas (turma×semestre)
              </Button>
            </div>
          </CardContent>
        </Card>
        {/* 🔹 Modelo Curricular Base */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#0B2C45]">
              <BookOpen className="w-5 h-5" />
              Modelo Curricular Base
            </CardTitle>
            <CardDescription>
              Selecione um modelo curricular de referência. O sistema pode gerar
              automaticamente classes, cursos e disciplinas iniciais para esta
              escola com base nesse modelo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <CurriculumPresetSelector
              value={curriculumPreset}
              onChange={(key) => {
                setCurriculumPreset(key);
                // salvar nas preferências (best effort)
                fetch(`/api/escolas/${escolaId}/onboarding/preferences`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ curriculum_preset_key: key }),
                }).catch(() => {});
              }}
              disabled={applyPresetLoading || !!wipeLoading}
            />

            <div className="flex items-center justify-between pt-2 gap-4">
              <p className="text-xs text-gray-500 max-w-md">
                {curriculumPreset ? (
                  <>
                    Modelo selecionado:{" "}
                    <strong>{curriculumPreset}</strong>.{" "}
                    {classes.length === 0 || disciplinas.length === 0
                      ? "Você ainda não gerou a estrutura a partir deste modelo."
                      : "Esta escola já possui classes e disciplinas cadastradas; aplicar o modelo pode complementar ou ajustar a estrutura atual."}
                  </>
                ) : (
                  "Selecione um modelo curricular para habilitar a geração automática de estrutura."
                )}
              </p>

              <Button
                variant="default"
                onClick={handleApplyCurriculumPreset}
                disabled={!curriculumPreset || applyPresetLoading}
                className="flex items-center gap-2 whitespace-nowrap"
              >
                {applyPresetLoading ? (
                  <>Aplicando...</>
                ) : (
                  <>
                    <Settings className="w-4 h-4" />
                    Aplicar modelo
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="text-center">
          <Button
            onClick={() => router.push(`/escola/${escolaId}/configuracoes/onboarding`)}
            variant="outline"
            className="flex items-center gap-2 mx-auto"
          >
            <Settings className="w-4 h-4" />
            Reconfigurar Estrutura Acadêmica
          </Button>
        </div>

        {/* Zona de Perigo: Apagar Dados Acadêmicos */}
        <Card className="border-red-300">
          <CardHeader>
            <CardTitle className="text-red-700">Zona de Perigo</CardTitle>
            <CardDescription className="text-red-600">
              Apaga dados acadêmicos. Use com extremo cuidado.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Escopo
                  </label>
                  <select
                    value={wipeScope}
                    onChange={(e) => {
                      const val = e.target.value as typeof wipeScope;
                      setWipeScope(val);
                      if (val === "session")
                        setWipeIncludes(["matriculas", "turmas", "semestres"]);
                      if (val === "config")
                        setWipeIncludes([
                          "disciplinas",
                          "classes",
                          "cursos",
                        ]);
                      if (val === "all")
                        setWipeIncludes([
                          "matriculas",
                          "turmas",
                          "semestres",
                          "disciplinas",
                          "classes",
                          "cursos",
                        ]);
                    }}
                    className="w-full p-2 border rounded"
                  >
                    <option value="session">Sessão atual</option>
                    <option value="config">Configuração acadêmica</option>
                    <option value="all">Tudo acadêmico da escola</option>
                  </select>
                </div>

                {(wipeScope === "session" || wipeScope === "all") && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Sessão
                    </label>
                    <select
                      value={wipeSessionId || ""}
                      onChange={(e) =>
                        setWipeSessionId(e.target.value || undefined)
                      }
                      className="w-full p-2 border rounded"
                    >
                      <option value="">Selecione uma sessão</option>
                      {sessoes.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.nome} {s.status === "ativa" ? "• ativa" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Itens a incluir
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { k: "semestres", l: "Períodos" },
                      { k: "turmas", l: "Turmas" },
                      { k: "matriculas", l: "Matrículas" },
                      { k: "classes", l: "Classes" },
                      { k: "disciplinas", l: "Disciplinas" },
                      { k: "cursos", l: "Cursos" },
                    ].map(({ k, l }) => (
                      <label
                        key={k}
                        className="flex items-center gap-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={wipeIncludes.includes(k)}
                          onChange={(e) => {
                            setWipeIncludes((prev) =>
                              e.target.checked
                                ? Array.from(new Set([...prev, k]))
                                : prev.filter((x) => x !== k)
                            );
                          }}
                        />
                        {l}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={async () => {
                    if (!escolaId) return;
                    if (
                      (wipeScope === "session" || wipeScope === "all") &&
                      !wipeSessionId
                    ) {
                      return toast.error("Selecione a sessão.");
                    }
                    setWipeLoading("simulate");
                    try {
                      const res = await fetch(
                        `/api/escolas/${escolaId}/academico/wipe`,
                        {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            scope: wipeScope,
                            sessionId: wipeSessionId,
                            include: wipeIncludes,
                            dryRun: true,
                          }),
                        }
                      );
                      const json = await res.json();
                      if (!res.ok || !json?.ok)
                        throw new Error(json?.error || "Falha ao simular.");
                      setWipeDryCounts(json.counts || {});
                      if (
                        typeof json?.escolaNome === "string" &&
                        json.escolaNome.trim()
                      ) {
                        setEscolaNome(json.escolaNome);
                      }
                      toast.success("Simulação pronta.");
                    } catch (e: any) {
                      toast.error(e.message || "Erro ao simular.");
                    } finally {
                      setWipeLoading(null);
                    }
                  }}
                >
                  {wipeLoading === "simulate"
                    ? "Simulando..."
                    : "Simular exclusão"}
                </Button>

                <div className="text-sm text-gray-700">
                  {Object.keys(wipeDryCounts).length > 0 && (
                    <span>
                      Resultado:{" "}
                      {Object.entries(wipeDryCounts)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(", ")}
                    </span>
                  )}
                </div>
              </div>

              <div className="p-3 bg-red-50 border border-red-200 rounded">
                <p className="text-sm text-red-700 mb-2">
                  Para confirmar, digite o nome da escola:{" "}
                  <strong>{escolaNome || "—"}</strong>
                </p>
                <input
                  type="text"
                  value={wipeConfirm}
                  onChange={(e) => setWipeConfirm(e.target.value)}
                  className="w-full p-2 border rounded"
                  placeholder="Digite exatamente o nome da escola"
                />
              </div>

              <div className="flex items-center gap-3 justify-end">
                <Button
                  variant="destructive"
                  onClick={async () => {
                    if (!escolaId) return;
                    if (
                      (wipeScope === "session" || wipeScope === "all") &&
                      !wipeSessionId
                    ) {
                      return toast.error("Selecione a sessão.");
                    }
                    const expected = (escolaNome || "").trim();
                    if (!wipeConfirm.trim()) {
                      return toast.error(
                        "Digite a frase de confirmação."
                      );
                    }
                    if (expected && wipeConfirm.trim() !== expected) {
                      return toast.error(
                        "Frase de confirmação incorreta."
                      );
                    }
                    setWipeLoading("execute");
                    const id = toast.loading("Apagando dados...");
                    try {
                      const res = await fetch(
                        `/api/escolas/${escolaId}/academico/wipe`,
                        {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            scope: wipeScope,
                            sessionId: wipeSessionId,
                            include: wipeIncludes,
                            dryRun: false,
                            confirmPhrase: wipeConfirm,
                          }),
                        }
                      );
                      const json = await res.json();
                      if (!res.ok || !json?.ok)
                        throw new Error(
                          json?.error || "Falha ao apagar dados"
                        );
                      setWipeDryCounts({});
                      setWipeConfirm("");
                      toast.success("Dados apagados.", { id });
                      window.location.reload();
                    } catch (e: any) {
                      toast.error(e.message || "Erro ao apagar.", {
                        id,
                      });
                    } finally {
                      setWipeLoading(null);
                    }
                  }}
                >
                  {wipeLoading === "execute"
                    ? "Apagando..."
                    : "Apagar definitivamente"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
