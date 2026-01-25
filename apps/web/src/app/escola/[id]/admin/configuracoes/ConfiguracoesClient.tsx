"use client";

import { useEffect, useMemo, useState } from "react";
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
} from "@/types/academico.types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import Button from "@/components/ui/Button";
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

  const [sessoes, setSessoes] = useState<AcademicSession[]>([]);
  const [sessaoAtiva, setSessaoAtiva] = useState<AcademicSession | null>(null);
  const [periodos, setPeriodos] = useState<Semester[]>([]);
  const [cursos, setCursos] = useState<Course[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [disciplinas, setDisciplinas] = useState<Discipline[]>([]);
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
                      <span className="text-sm text-[#0B2C45]">{c.nome}</span>
                      <div className="flex items-center gap-2">
                        <button
                          className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded border hover:bg-slate-50"
                          onClick={async () => {
                            const novo = window.prompt('Novo nome da classe', c.nome);
                            if (!novo || novo.trim() === c.nome) return;
                            try {
                              const res = await fetch(`/api/escolas/${escolaId}/classes/${c.id}`, {
                                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome: novo.trim() })
                              });
                              const json = await res.json().catch(()=>null);
                              if (!res.ok || !json?.ok) throw new Error(json?.error || 'Falha ao atualizar classe');
                              setClasses(prev => prev.map((x:any)=> x.id===c.id ? { ...x, nome: novo.trim() } : x));
                            } catch (e:any) { toast.error(e?.message || 'Erro ao atualizar classe'); }
                          }}
                        >
                          <Pencil className="w-3.5 h-3.5" /> Editar
                        </button>
                        <button
                          className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded border border-red-300 text-red-700 hover:bg-red-50"
                          onClick={async () => {
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
                      <span className="text-sm text-[#0B2C45]">{d.nome}</span>
                      <div className="flex items-center gap-2">
                        <button
                          className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded border hover:bg-slate-50"
                          onClick={async () => {
                            const novo = window.prompt('Novo nome da disciplina', d.nome);
                            if (!novo || novo.trim() === d.nome) return;
                            try {
                              const res = await fetch(`/api/escolas/${escolaId}/disciplinas/${d.id}`, {
                                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome: novo.trim() })
                              });
                              const json = await res.json().catch(()=>null);
                              if (!res.ok || !json?.ok) throw new Error(json?.error || 'Falha ao atualizar disciplina');
                              setDisciplinas(prev => prev.map((x:any)=> x.id===d.id ? { ...x, nome: novo.trim() } : x));
                            } catch (e:any) { toast.error(e?.message || 'Erro ao atualizar disciplina'); }
                          }}
                        >
                          <Pencil className="w-3.5 h-3.5" /> Editar
                        </button>
                        <button
                          className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded border border-red-300 text-red-700 hover:bg-red-50"
                          onClick={async () => {
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
              <Button
                variant="default"
                disabled={!!quickActionLoading}
                onClick={async () => {
                  if (!escolaId) return;
                  const nome = window.prompt('Nome da classe (ex.: 10ª, 11ª, 12ª)');
                  if (!nome) return;
                  setQuickActionLoading('classe');
                  try {
                    const res = await fetch(`/api/escolas/${escolaId}/classes`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ nome }),
                    });
                    const json = await res.json().catch(() => null);
                    if (!res.ok || !json?.ok) throw new Error(json?.error || 'Falha ao criar classe');
                    toast.success('Classe criada');
                    // reload classes
                    const r = await fetch(`/api/escolas/${escolaId}/classes`, { cache: 'no-store' });
                    const j = await r.json().catch(() => null);
                    if (r.ok && Array.isArray(j?.data)) setClasses(j.data as any);
                  } catch (e: any) {
                    toast.error(e?.message || 'Erro ao criar classe');
                  } finally {
                    setQuickActionLoading(null);
                  }
                }}
              >
                Nova Classe
              </Button>

              <Button
                variant="default"
                disabled={!!quickActionLoading}
                onClick={async () => {
                  if (!escolaId) return;
                  const nome = window.prompt('Nome do curso (ex.: Matemática, Ciências)');
                  if (!nome) return;
                  setQuickActionLoading('curso');
                  try {
                    const res = await fetch(`/api/escolas/${escolaId}/cursos`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ nome }),
                    });
                    const json = await res.json().catch(() => null);
                    if (!res.ok || !json?.ok) throw new Error(json?.error || 'Falha ao criar curso');
                    toast.success('Curso criado');
                    const r = await fetch(`/api/escolas/${escolaId}/cursos`, { cache: 'no-store' });
                    const j = await r.json().catch(() => null);
                    if (r.ok && Array.isArray(j?.data)) setCursos(j.data as any);
                  } catch (e: any) {
                    toast.error(e?.message || 'Erro ao criar curso');
                  } finally {
                    setQuickActionLoading(null);
                  }
                }}
              >
                Novo Curso
              </Button>

              <Button
                variant="default"
                disabled={!!quickActionLoading}
                onClick={async () => {
                  if (!escolaId) return;
                  const nome = window.prompt('Nome da disciplina (ex.: Álgebra, Física)');
                  if (!nome) return;
                  setQuickActionLoading('disciplina');
                  try {
                    const res = await fetch(`/api/escolas/${escolaId}/disciplinas`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ nome }),
                    });
                    const json = await res.json().catch(() => null);
                    if (!res.ok || !json?.ok) throw new Error(json?.error || 'Falha ao criar disciplina');
                    toast.success('Disciplina criada');
                    const r = await fetch(`/api/escolas/${escolaId}/disciplinas`, { cache: 'no-store' });
                    const j = await r.json().catch(() => null);
                    if (r.ok && Array.isArray(j?.data)) setDisciplinas(j.data as any);
                  } catch (e: any) {
                    toast.error(e?.message || 'Erro ao criar disciplina');
                  } finally {
                    setQuickActionLoading(null);
                  }
                }}
              >
                Nova Disciplina
              </Button>

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
                  variant="danger"
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
