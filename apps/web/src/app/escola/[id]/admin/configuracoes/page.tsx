"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";
import type { AcademicSession, Semester, Course, Teacher, Class, Discipline } from "@/types/academico.types";

import AcademicSetupWizard from "@/components/escola/onboarding/AcademicSetupWizard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Settings, BookOpen, Users, Calendar, GraduationCap } from "lucide-react";

export default function ConfiguracoesAcademicasPage() {
  const p = useParams() as Record<string, string | string[] | undefined>;
  const escolaId = useMemo(() => (Array.isArray(p.id) ? p.id[0] : (p.id ?? "")), [p.id]);
  const supabase = useMemo(() => createClient(), []);

  const [sessoes, setSessoes] = useState<AcademicSession[]>([]);
  const [sessaoAtiva, setSessaoAtiva] = useState<AcademicSession | null>(null);
  const [periodos, setPeriodos] = useState<Semester[]>([]);
  const [cursos, setCursos] = useState<Course[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [disciplinas, setDisciplinas] = useState<Discipline[]>([]);
  const [professores, setProfessores] = useState<Teacher[]>([]);
  const [tipoPresenca, setTipoPresenca] = useState<"secao" | "curso">("secao");
  const [estrutura, setEstrutura] = useState<"classes" | "secoes" | "cursos">("classes");
  
  const [showWizard, setShowWizard] = useState(false);
  const [setupComplete, setSetupComplete] = useState(false);

  // SEU CÓDIGO DE CARREGAMENTO EXISTENTE (mantido igual)
  useEffect(() => {
    if (!escolaId) return;
    let mounted = true;

    const loadAll = async () => {
      // 1) Sessões
      const { data: s } = await supabase
        .from("school_sessions")
        .select("id, nome, data_inicio, data_fim, status")
        .eq("escola_id", escolaId)
        .order("data_inicio", { ascending: false });

      if (!mounted) return;
      const mapSessions: AcademicSession[] = (s || []).map((row: any) => ({
        id: row.id,
        nome: row.nome,
        ano_letivo: `${String(row.data_inicio).slice(0, 4)}-${String(row.data_fim).slice(0, 4)}`,
        data_inicio: String(row.data_inicio),
        data_fim: String(row.data_fim),
        status: row.status,
      }));
      setSessoes(mapSessions);
      const ativa = mapSessions.find((x) => x.status === "ativa") || null;
      setSessaoAtiva(ativa);

      // 2) Períodos
      if (ativa) {
        const { data: per } = await supabase
          .from("semestres")
          .select("id, nome, data_inicio, data_fim, session_id")
          .eq("session_id", ativa.id)
          .order("data_inicio", { ascending: true });

        if (mounted) {
          const mapped: Semester[] = (per || []).map((row: any, idx: number) => ({
            id: row.id,
            nome: row.nome,
            numero: idx + 1,
            data_inicio: String(row.data_inicio),
            data_fim: String(row.data_fim),
            sessao_id: row.session_id,
          }));
          setPeriodos(mapped);
        }
      } else {
        setPeriodos([]);
      }

      // 3) Cursos
      const { data: cur } = await (supabase as any)
        .from("cursos")
        .select("id, nome, periodo_id, nivel")
        .eq("escola_id", escolaId);
      if (mounted) setCursos((cur as any) || []);

      // 4) Classes
      const { data: cls } = await (supabase as any)
        .from("classes")
        .select("id, nome, descricao, ordem, nivel")
        .eq("escola_id", escolaId)
        .order("ordem", { ascending: true });
      if (mounted) setClasses(cls || []);

      // 5) Disciplinas
      const { data: disc } = await (supabase as any)
        .from("disciplinas")
        .select("id, nome, tipo, curso_id, classe_id, descricao")
        .eq("escola_id", escolaId)
        .order("nome", { ascending: true });
      if (mounted) setDisciplinas(disc || []);

      // 6) Preferências
      try {
        const res = await fetch(`/api/escolas/${escolaId}/onboarding/preferences`, { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (mounted && res.ok && json?.data) {
          if (json.data.tipo_presenca === "secao" || json.data.tipo_presenca === "curso") {
            setTipoPresenca(json.data.tipo_presenca);
          }
          if (["classes", "secoes", "cursos"].includes(json.data.estrutura)) {
            setEstrutura(json.data.estrutura);
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
            .filter((p: any) => String(p.role || "").toLowerCase().includes("teacher"))
            .map((p: any) => ({ id: p.user_id, nome: p.nome, email: p.email || "" }));
          setProfessores(mapped);
        }
      } catch {}

      // Verificar se configuração básica está completa
      if (mounted) {
        const hasBasicConfig = ativa && periodos.length > 0 && classes.length > 0 && disciplinas.length > 0;
        setSetupComplete(!!hasBasicConfig);
        
        // Se não tem configuração básica, mostrar wizard automaticamente
        if (!hasBasicConfig) {
          setShowWizard(true);
        }
      }
    };

    loadAll();
    return () => {
      mounted = false;
    };
  }, [escolaId, supabase]);

  // Se wizard está aberto, mostrar apenas o wizard
  if (showWizard) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <AcademicSetupWizard
          escolaId={escolaId}
          sessoes={sessoes}
          sessaoAtiva={sessaoAtiva}
          periodos={periodos}
          cursos={cursos}
          classes={classes}
          disciplinas={disciplinas}
          onSessaoAtualizada={setSessaoAtiva}
          onSessoesAtualizadas={setSessoes}
          onPeriodosAtualizados={setPeriodos}
          onCursosAtualizados={setCursos}
          onClassesAtualizadas={setClasses}
          onDisciplinasAtualizadas={setDisciplinas}
          onComplete={() => {
            setSetupComplete(true);
            setShowWizard(false);
          }}
          onClose={() => setShowWizard(false)}
        />
      </div>
    );
  }

  // Configuração completa - mostrar dashboard
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <header className="text-center">
        <h1 className="text-3xl font-bold text-[#0B2C45]">Configurações Acadêmicas</h1>
        <p className="text-gray-600">Sua estrutura acadêmica está configurada e pronta para uso</p>
      </header>

    {/* Banner de sucesso */}
      <Card className="bg-green-50 border-green-200">
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
            <div>
              <h3 className="font-semibold text-green-900">
                Configuração Acadêmica Completa! 🎉
              </h3>
              <p className="text-green-700 text-sm">
                Todos os componentes acadêmicos estão configurados e prontos para uso
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

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
            <p className="text-2xl font-bold text-gray-900">{periodos.length}</p>
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
            <p className="text-2xl font-bold text-gray-900">{classes.length}</p>
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
            <p className="text-2xl font-bold text-gray-900">{disciplinas.length}</p>
            <p className="text-sm text-gray-600">Cadastradas</p>
          </CardContent>
        </Card>
      </div>

      {/* Configurações Avançadas */}
      <div className="space-y-6">
     
        <div className="text-center">
          <Button 
            onClick={() => setShowWizard(true)}
            variant="outline"
            className="flex items-center gap-2 mx-auto"
          >
            <Settings className="w-4 h-4" />
            Reconfigurar Estrutura Acadêmica
          </Button>
        </div>
      </div>
    </div>
  );
}