"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { 
  AlertTriangle, 
  Plus, 
  Trash2, 
  Clock, 
  User, 
  BookOpen, 
  Calendar,
  CheckCircle2,
  XCircle,
  Loader2,
  ShieldCheck
} from "lucide-react";
import { toast } from "sonner";

interface Excecao {
  id: string;
  turma_id: string;
  disciplina_id: string | null;
  trimestre: number | null;
  user_id: string;
  motivo: string;
  expira_em: string;
  created_at: string;
  profiles: { nome: string } | null;
  turmas: { nome: string } | null;
  disciplinas_catalogo: { nome: string } | null;
}

interface UserProfile {
  user_id: string;
  nome: string;
  role: string;
}

interface Turma {
  id: string;
  nome: string;
}

interface Disciplina {
  id: string;
  nome: string;
}

export default function ExcecoesPautaPanel({ params }: { params: Promise<{ id: string }> }) {
  const [escolaId, setEscolaId] = useState<string | null>(null);
  const [excecoes, setExcecoes] = useState<Excecao[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  
  // Form states
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [disciplinas, setDisciplinas] = useState<Disciplina[]>([]);
  
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedTurma, setSelectedTurma] = useState("");
  const [selectedDisciplina, setSelectedDisciplina] = useState("");
  const [selectedTrimestre, setSelectedTrimestre] = useState("");
  const [motivo, setMotivo] = useState("");
  const [horas, setHoras] = useState("24");
  const [saving, setSaving] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    params.then(p => setEscolaId(p.id));
  }, [params]);

  useEffect(() => {
    if (escolaId) {
      loadData();
      loadFormOptions();
    }
  }, [escolaId]);

  async function loadData() {
    if (!escolaId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("excecoes_pauta")
        .select(`
          *,
          profiles:user_id(nome),
          turmas:turma_id(nome),
          disciplinas_catalogo:disciplina_id(nome)
        `)
        .eq("escola_id", escolaId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setExcecoes(data as any || []);
    } catch (err: any) {
      toast.error("Erro ao carregar exceções: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadFormOptions() {
    if (!escolaId) return;
    try {
      // 1. Carregar Professores e Admins da escola
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, nome, role")
        .eq("escola_id", escolaId)
        .in("role", ["professor", "admin", "secretaria", "financeiro"]);
      setUsers(profiles || []);

      // 2. Carregar Turmas
      if (escolaId) {
        const { data: t } = await supabase
          .from("turmas")
          .select("id, nome")
          .eq("escola_id", escolaId);
        setTurmas(t || []);

        // 3. Carregar Catálogo de Disciplinas
        const { data: d } = await supabase
          .from("disciplinas_catalogo")
          .select("id, nome")
          .eq("escola_id", escolaId);
        setDisciplinas(d || []);
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleAdd() {
    if (!escolaId || !selectedUser || !selectedTurma || !motivo) {
      toast.error("Preencha os campos obrigatórios (Usuário, Turma e Motivo)");
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const expira_em = new Date();
      expira_em.setHours(expira_em.getHours() + parseInt(horas));

      const { error } = await supabase.from("excecoes_pauta").insert({
        escola_id: escolaId,
        user_id: selectedUser,
        turma_id: selectedTurma,
        disciplina_id: selectedDisciplina || null,
        trimestre: selectedTrimestre ? parseInt(selectedTrimestre) : null,
        motivo,
        expira_em: expira_em.toISOString(),
        criado_por: user.id
      });

      if (error) throw error;

      toast.success("Exceção criada com sucesso!");
      setShowAdd(false);
      resetForm();
      loadData();
    } catch (err: any) {
      toast.error("Erro ao criar exceção: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  function resetForm() {
    setSelectedUser("");
    setSelectedTurma("");
    setSelectedDisciplina("");
    setSelectedTrimestre("");
    setMotivo("");
    setHoras("24");
  }

  async function handleDelete(id: string) {
    if (!confirm("Deseja remover esta exceção? O acesso será revogado imediatamente.")) return;
    
    try {
      const { error } = await supabase.from("excecoes_pauta").delete().eq("id", id);
      if (error) throw error;
      toast.success("Exceção removida.");
      loadData();
    } catch (err: any) {
      toast.error("Erro ao remover: " + err.message);
    }
  }

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <AlertTriangle className="text-klasse-gold-500 w-5 h-5" />
            Reabertura Excecional de Pauta
          </h2>
          <p className="text-sm text-slate-500">
            Autorize professores a editar notas em períodos já trancados ou fora do calendário.
          </p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-2 bg-[#1F6B3B] text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-[#1F6B3B]/90 transition-all"
        >
          {showAdd ? <XCircle className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showAdd ? "Cancelar" : "Nova Exceção"}
        </button>
      </div>

      {showAdd && (
        <div className="bg-white border-2 border-klasse-gold-100 rounded-2xl p-6 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider">Configurar Acesso Temporário</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Utilizador (Professor/Admin)</label>
              <select 
                value={selectedUser} 
                onChange={e => setSelectedUser(e.target.value)}
                className="w-full rounded-xl border-slate-200 text-sm"
              >
                <option value="">Selecionar utilizador...</option>
                {users.map(u => <option key={u.user_id} value={u.user_id}>{u.nome} ({u.role})</option>)}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Turma</label>
              <select 
                value={selectedTurma} 
                onChange={e => setSelectedTurma(e.target.value)}
                className="w-full rounded-xl border-slate-200 text-sm"
              >
                <option value="">Selecionar turma...</option>
                {turmas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Disciplina (Opcional)</label>
              <select 
                value={selectedDisciplina} 
                onChange={e => setSelectedDisciplina(e.target.value)}
                className="w-full rounded-xl border-slate-200 text-sm"
              >
                <option value="">Todas as disciplinas</option>
                {disciplinas.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Trimestre</label>
                <select 
                  value={selectedTrimestre} 
                  onChange={e => setSelectedTrimestre(e.target.value)}
                  className="w-full rounded-xl border-slate-200 text-sm"
                >
                  <option value="">Todos</option>
                  <option value="1">1º Trimestre</option>
                  <option value="2">2º Trimestre</option>
                  <option value="3">3º Trimestre</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Duração (Horas)</label>
                <select 
                  value={horas} 
                  onChange={e => setHoras(e.target.value)}
                  className="w-full rounded-xl border-slate-200 text-sm"
                >
                  <option value="1">1 hora</option>
                  <option value="4">4 horas</option>
                  <option value="12">12 horas</option>
                  <option value="24">24 horas</option>
                  <option value="48">48 horas</option>
                  <option value="168">1 semana</option>
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">Motivo da Reabertura (Auditoria)</label>
            <textarea 
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              placeholder="Ex: Erro na soma da prova de Matemática detectado pelo encarregado..."
              className="w-full h-20 rounded-xl border-slate-200 text-sm p-3"
            />
          </div>

          <div className="flex justify-end">
            <button
              disabled={saving}
              onClick={handleAdd}
              className="bg-klasse-gold-500 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-klasse-gold-600 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              Conceder Acesso Excecional
            </button>
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 text-left">Utilizador</th>
              <th className="px-6 py-4 text-left">Contexto</th>
              <th className="px-6 py-4 text-left">Expira em</th>
              <th className="px-6 py-4 text-left">Status</th>
              <th className="px-6 py-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {excecoes.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                  Nenhuma exceção ativa registada.
                </td>
              </tr>
            ) : (
              excecoes.map(ex => {
                const expirada = new Date(ex.expira_em) < new Date();
                return (
                  <tr key={ex.id} className={expirada ? "opacity-60 bg-slate-50/50" : ""}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                          <User className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{ex.profiles?.nome}</p>
                          <p className="text-[10px] text-slate-500 uppercase">{ex.motivo}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <p className="flex items-center gap-1.5 font-medium text-slate-700">
                          <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                          {ex.turmas?.nome}
                        </p>
                        <p className="text-xs text-slate-500 pl-5">
                          {ex.disciplinas_catalogo?.nome || "Todas as disciplinas"}
                          {ex.trimestre && ` · ${ex.trimestre}º Trimestre`}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <Clock className="w-3.5 h-3.5" />
                        {new Date(ex.expira_em).toLocaleString('pt-AO')}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {expirada ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold">
                          <XCircle className="w-3 h-3" /> EXPIRADA
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-klasse-green-100 text-klasse-green-700 text-[10px] font-bold animate-pulse">
                          <CheckCircle2 className="w-3 h-3" /> ATIVA
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => handleDelete(ex.id)}
                        className="p-2 text-slate-400 hover:text-rose-600 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
