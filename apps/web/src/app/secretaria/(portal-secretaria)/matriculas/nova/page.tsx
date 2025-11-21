"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface Aluno {
  id: string;
  nome: string;
  email?: string;
  telefone?: string;
  endereco?: string;
}

interface Session {
  id: string;
  nome: string;
}

interface Turma {
  id: string;
  nome: string;
  turno?: string;
  classe?: string;
  curso?: string;
}

interface Classe {
  id: string;
  nome: string;
}

interface Curso {
  id: string;
  nome: string;
}

export default function NovaMatriculaPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [alunoId, setAlunoId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [turmaId, setTurmaId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [numeroGerado, setNumeroGerado] = useState<string | null>(null);
  const [dataMatriculaGerada, setDataMatriculaGerada] = useState<string | null>(null);

  const [turno, setTurno] = useState<"manha" | "tarde" | "noite" | "">("");
  const [classeId, setClasseId] = useState("");
  const [cursoId, setCursoId] = useState("");

  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [classes, setClasses] = useState<Classe[]>([]);
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [alunoSelecionado, setAlunoSelecionado] = useState<Aluno | null>(null);

  // Financeiro: campos de mensalidade
  const [valorMensalidade, setValorMensalidade] = useState<string>("");
  const [diaVencimento, setDiaVencimento] = useState<string>("");
  const [gerarMensalidadesTodas, setGerarMensalidadesTodas] = useState<boolean>(true);

  // ✅ NOVO: Estados de carregamento para debug
  const [carregandoAlunos, setCarregandoAlunos] = useState(true);
  const [carregandoSessions, setCarregandoSessions] = useState(true);
  const [carregandoClasses, setCarregandoClasses] = useState(true);
  const [carregandoCursos, setCarregandoCursos] = useState(true);
  const [carregandoTurmas, setCarregandoTurmas] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setCarregandoAlunos(true);
        setCarregandoSessions(true);
        setCarregandoClasses(true);
        setCarregandoCursos(true);

        console.log("🔄 Iniciando carregamento de dados...");

        // ✅ CORREÇÃO: Fetch separado para cada endpoint com debug
        const [alunosRes, sessionsRes, classesRes, cursosRes] = await Promise.all([
          fetch("/api/secretaria/alunos"),
          fetch("/api/secretaria/school-sessions"),
          fetch("/api/secretaria/classes"),
          fetch("/api/secretaria/cursos"),
        ]);

        console.log("📊 Status das respostas:", {
          alunos: alunosRes.status,
          sessions: sessionsRes.status,
          classes: classesRes.status,
          cursos: cursosRes.status,
        });

        // Processar alunos
        if (alunosRes.ok) {
          const alunosJson = await alunosRes.json();
          console.log("👥 Dados dos alunos:", alunosJson);
          if (alunosJson.items) {
            setAlunos(alunosJson.items);
          } else if (alunosJson.alunos) {
            setAlunos(alunosJson.alunos);
          } else if (Array.isArray(alunosJson)) {
            setAlunos(alunosJson);
          }
        } else {
          console.error("❌ Erro ao carregar alunos:", alunosRes.status);
        }
        setCarregandoAlunos(false);

        // Processar sessions (ano letivo)
        if (sessionsRes.ok) {
          const sessionsJson = await sessionsRes.json();
          console.log("📅 Dados das sessions:", sessionsJson);
          if (sessionsJson.items) {
            setSessions(sessionsJson.items);
          }
        } else {
          console.error("❌ Erro ao carregar sessions:", sessionsRes.status);
        }
        setCarregandoSessions(false);

        // Processar classes
        if (classesRes.ok) {
          const classesJson = await classesRes.json();
          console.log("🏫 Dados das classes:", classesJson);
          if (classesJson.items) {
            setClasses(classesJson.items);
          }
        } else {
          console.error("❌ Erro ao carregar classes:", classesRes.status);
        }
        setCarregandoClasses(false);

        // Processar cursos
        if (cursosRes.ok) {
          const cursosJson = await cursosRes.json();
          console.log("📚 Dados dos cursos:", cursosJson);
          if (cursosJson.items) {
            setCursos(cursosJson.items);
          }
        } else {
          console.error("❌ Erro ao carregar cursos:", cursosRes.status);
        }
        setCarregandoCursos(false);

      } catch (e) {
        console.error("💥 Erro geral ao carregar dados:", e);
        setError("Falha ao carregar dados para o formulário.");
        setCarregandoAlunos(false);
        setCarregandoSessions(false);
        setCarregandoClasses(false);
        setCarregandoCursos(false);
      }
    };
    fetchData();
  }, []);

  // Prefill alunoId from query string if provided
  useEffect(() => {
    const aid = searchParams?.get('alunoId');
    if (aid) {
      console.log("🎯 AlunoId da URL:", aid);
      setAlunoId(aid);
    }
  }, [searchParams]);

  // Carregar dados do aluno selecionado
  useEffect(() => {
    if (alunoId && alunos.length > 0) {
      const aluno = alunos.find(a => a.id === alunoId);
      console.log("👤 Aluno selecionado:", aluno);
      setAlunoSelecionado(aluno || null);
    } else {
      setAlunoSelecionado(null);
    }
  }, [alunoId, alunos]);

  // ✅ CORREÇÃO: Carregar turmas quando sessionId mudar
  useEffect(() => {
    const fetchTurmas = async () => {
      if (sessionId) {
        try {
          setCarregandoTurmas(true);
          console.log("🔄 Buscando turmas para session:", sessionId);
          
          const url = `/api/secretaria/turmas-simples?session_id=${sessionId}&aluno_id=${alunoId || ''}`;
          console.log("📡 URL das turmas:", url);
          
          const res = await fetch(url);
          console.log("📊 Status das turmas:", res.status);
          
          if (res.ok) {
            const json = await res.json();
            console.log("🏫 Dados das turmas:", json);
            // Aceita múltiplos formatos de resposta: { ok, items }, { items }, { turmas }, { data }, []
            const items: any[] = Array.isArray(json)
              ? json
              : (json?.items ?? json?.turmas ?? json?.data ?? []);
            if (Array.isArray(items)) {
              setTurmas(items as any);
              console.log("✅ Turmas carregadas:", items.length, json?.debug ? { debug: json.debug } : undefined);
            } else {
              console.error("❌ Formato inesperado de turmas:", json);
            }
          } else {
            console.error("❌ Erro HTTP das turmas:", res.status);
          }
        } catch (e) {
          console.error("💥 Erro ao carregar turmas:", e);
          setError("Falha ao carregar turmas.");
        } finally {
          setCarregandoTurmas(false);
        }
      } else {
        setTurmas([]);
        setTurmaId("");
        setCarregandoTurmas(false);
      }
    };
    fetchTurmas();
  }, [sessionId, alunoId]);

  // Auto-preencher valor/dia conforme curso/classe selecionados, se ainda não preenchidos
  useEffect(() => {
    const run = async () => {
      try {
        if (!classeId && !cursoId) return;
        const params = new URLSearchParams();
        if (classeId) params.set('classe_id', classeId);
        if (cursoId) params.set('curso_id', cursoId);
        const res = await fetch(`/api/financeiro/tabelas-mensalidade/resolve?${params.toString()}`, { cache: 'no-store' });
        const json = await res.json();
        if (json?.ok) {
          if (!valorMensalidade && typeof json.valor === 'number') setValorMensalidade(String(json.valor));
          if (!diaVencimento && json.dia_vencimento) setDiaVencimento(String(json.dia_vencimento));
        }
      } catch {}
    };
    run();
  }, [classeId, cursoId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setOk(null);
    setNumeroGerado(null);
    setDataMatriculaGerada(null);

    // ✅ Validação dos campos obrigatórios
    const camposObrigatorios = [
      { campo: alunoId, nome: "Aluno" },
      { campo: sessionId, nome: "Ano Letivo" },
      { campo: turmaId, nome: "Turma" },
      { campo: turno, nome: "Turno" },
      { campo: classeId, nome: "Classe" },
      { campo: cursoId, nome: "Curso" },
    ];

    const camposFaltantes = camposObrigatorios.filter(item => !item.campo);
    if (camposFaltantes.length > 0) {
      setError(`Por favor, preencha todos os campos obrigatórios: ${camposFaltantes.map(item => item.nome).join(', ')}`);
      setLoading(false);
      return;
    }

    try {
      const payload = {
        aluno_id: alunoId,
        session_id: sessionId,
        turma_id: turmaId,
        turno: turno,
        classe_id: classeId,
        curso_id: cursoId,
        numero_matricula: null,
        data_matricula: null,
        // financeiro (opcional)
        valor_mensalidade: valorMensalidade ? Number(valorMensalidade) : undefined,
        dia_vencimento: diaVencimento ? Number(diaVencimento) : undefined,
        gerar_mensalidades_todas: gerarMensalidadesTodas,
      };

      console.log("📤 Enviando payload:", payload);

      const res = await fetch("/api/secretaria/matriculas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      console.log("📥 Resposta da API:", json);

      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Falha ao criar matrícula");
      }
      
      const numero = json?.data?.numero_matricula as string | undefined;
      const dataMatricula = json?.data?.data_matricula as string | undefined;
      
      if (numero) setNumeroGerado(numero);
      if (dataMatricula) setDataMatriculaGerada(dataMatricula);
      setOk("Matrícula criada com sucesso.");

    } catch (e) {
      console.error("💥 Erro no submit:", e);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-emerald-600 mb-4"
          >
            ← Voltar
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Nova Matrícula</h1>
          <p className="text-gray-600 mt-2">Complete as informações académicas do estudante</p>
        </div>

        <div className="bg-white rounded-xl shadow border p-6">
          {/* Alerta de sucesso */}
          {ok && (
            <div className="mb-6 p-4 border border-green-200 bg-green-50 rounded-lg">
              <div className="text-sm text-green-700">
                <p className="font-medium">{ok}</p>
                {(numeroGerado || dataMatriculaGerada) && (
                  <div className="mt-2 space-y-1">
                    {numeroGerado && (
                      <p>
                        <strong>Número de matrícula:</strong> <span className="font-mono">{numeroGerado}</span>
                      </p>
                    )}
                    {dataMatriculaGerada && (
                      <p>
                        <strong>Data da matrícula:</strong> {new Date(dataMatriculaGerada).toLocaleDateString('pt-AO')}
                      </p>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 mt-3">
                {numeroGerado && (
                  <button
                    type="button"
                    className="px-3 py-1 border border-green-300 rounded text-xs text-green-700 hover:bg-green-100"
                    onClick={() => navigator.clipboard.writeText(numeroGerado!)}
                  >
                    Copiar Número
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => router.push('/secretaria/matriculas')}
                  className="px-3 py-1 border border-green-300 rounded text-xs text-green-700 hover:bg-green-100"
                >
                  Ir para matrículas
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Informações do Aluno */}
            <div className="border-b pb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Informações do Estudante</h2>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Aluno *</label>
                  <select
                    value={alunoId}
                    onChange={(e) => setAlunoId(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm"
                    required
                    disabled={carregandoAlunos}
                  >
                    <option value="">
                      {carregandoAlunos ? "Carregando alunos..." : "Selecione um aluno"}
                    </option>
                    {alunos.map((aluno) => (
                      <option key={aluno.id} value={aluno.id}>
                        {aluno.nome}
                      </option>
                    ))}
                  </select>
                  {carregandoAlunos && (
                    <p className="mt-1 text-xs text-gray-500">Carregando lista de alunos...</p>
                  )}
                  {!carregandoAlunos && alunos.length === 0 && (
                    <p className="mt-1 text-xs text-red-500">Nenhum aluno cadastrado encontrado.</p>
                  )}
                </div>

                {alunoSelecionado && (
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-sm text-gray-600">
                      <strong>Aluno selecionado:</strong> {alunoSelecionado.nome}
                      <br />
                      {alunoSelecionado.email && `Email: ${alunoSelecionado.email}`}
                      {alunoSelecionado.telefone && `Telefone: ${alunoSelecionado.telefone}`}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Informações Acadêmicas */}
            <div className="border-b pb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Informações Acadêmicas</h2>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Ano Letivo *</label>
                  <select
                    value={sessionId}
                    onChange={(e) => setSessionId(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm"
                    required
                    disabled={carregandoSessions}
                  >
                    <option value="">
                      {carregandoSessions ? "Carregando anos letivos..." : "Selecione um ano letivo"}
                    </option>
                    {sessions.map((session) => (
                      <option key={session.id} value={session.id}>
                        {session.nome}
                      </option>
                    ))}
                  </select>
                  {carregandoSessions && (
                    <p className="mt-1 text-xs text-gray-500">Carregando anos letivos...</p>
                  )}
                  {!carregandoSessions && sessions.length === 0 && (
                    <p className="mt-1 text-xs text-red-500">Nenhum ano letivo encontrado.</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Turma *</label>
                  <select
                    value={turmaId}
                    onChange={(e) => setTurmaId(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm"
                    required
                    disabled={!sessionId || carregandoTurmas}
                  >
                    <option value="">
                      {carregandoTurmas ? "Carregando turmas..." : !sessionId ? "Selecione primeiro o ano letivo" : "Selecione uma turma"}
                    </option>
                    {turmas.map((turma) => (
                      <option key={turma.id} value={turma.id}>
                        {turma.nome}
                      </option>
                    ))}
                  </select>
                  {carregandoTurmas && (
                    <p className="mt-1 text-xs text-gray-500">Carregando turmas...</p>
                  )}
                  {!carregandoTurmas && sessionId && turmas.length === 0 && (
                    <p className="mt-1 text-xs text-red-500">Nenhuma turma encontrada para este ano letivo.</p>
                  )}
                </div>
              </div>

              {/* ✅ NOVOS CAMPOS para seleção no formulário */}
              <div className="grid md:grid-cols-3 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Turno *</label>
                  <select
                    value={turno}
                    onChange={(e) => setTurno(e.target.value as any)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm"
                    required
                  >
                    <option value="">Selecione o turno</option>
                    <option value="manha">Manhã</option>
                    <option value="tarde">Tarde</option>
                    <option value="noite">Noite</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Classe *</label>
                  <select
                    value={classeId}
                    onChange={(e) => setClasseId(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm"
                    required
                    disabled={carregandoClasses}
                  >
                    <option value="">
                      {carregandoClasses ? "Carregando classes..." : "Selecione a classe"}
                    </option>
                    {classes.map((classe) => (
                      <option key={classe.id} value={classe.id}>
                        {classe.nome}
                      </option>
                    ))}
                  </select>
                  {carregandoClasses && (
                    <p className="mt-1 text-xs text-gray-500">Carregando classes...</p>
                  )}
                  {!carregandoClasses && classes.length === 0 && (
                    <p className="mt-1 text-xs text-red-500">Nenhuma classe encontrada.</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Curso *</label>
                  <select
                    value={cursoId}
                    onChange={(e) => setCursoId(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm"
                    required
                    disabled={carregandoCursos}
                  >
                    <option value="">
                      {carregandoCursos ? "Carregando cursos..." : "Selecione o curso"}
                    </option>
                    {cursos.map((curso) => (
                      <option key={curso.id} value={curso.id}>
                        {curso.nome}
                      </option>
                    ))}
                  </select>
                  {carregandoCursos && (
                    <p className="mt-1 text-xs text-gray-500">Carregando cursos...</p>
                  )}
                  {!carregandoCursos && cursos.length === 0 && (
                    <p className="mt-1 text-xs text-red-500">Nenhum curso encontrado.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Informações da Matrícula */}
            <div className="border-b pb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Informações da Matrícula</h2>
              
              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Número da Matrícula</label>
                    <div className="mt-1 block w-full rounded-md border-gray-200 bg-gray-50 p-3">
                      <p className="text-sm text-gray-600">
                        {numeroGerado ? (
                          <span className="font-mono font-medium text-green-600">{numeroGerado}</span>
                        ) : (
                          "Será gerado automaticamente após confirmar a matrícula"
                        )}
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Data da Matrícula</label>
                    <div className="mt-1 block w-full rounded-md border-gray-200 bg-gray-50 p-3">
                      <p className="text-sm text-gray-600">
                        {dataMatriculaGerada ? (
                          <span className="font-medium text-green-600">
                            {new Date(dataMatriculaGerada).toLocaleDateString('pt-AO')}
                          </span>
                        ) : (
                          "Será definida automaticamente como a data atual"
                        )}
                      </p>
                    </div>
                  </div>
                </div>
                
                <p className="text-xs text-gray-500">
                  Ambos os campos serão gerados automaticamente pelo sistema ao confirmar a matrícula.
                </p>
              </div>
            </div>

            {/* Financeiro */}
            <div className="border-b pb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Mensalidade (opcional)</h2>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Valor da mensalidade (KZ)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={valorMensalidade}
                    onChange={(e) => setValorMensalidade(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm"
                    placeholder="ex.: 15000.00"
                  />
                  <p className="mt-1 text-xs text-gray-500">Se informado, criaremos a primeira mensalidade.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Dia de vencimento</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={diaVencimento}
                    onChange={(e) => setDiaVencimento(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm"
                    placeholder="ex.: 5"
                  />
                  <p className="mt-1 text-xs text-gray-500">Aceita 1–31. O sistema ajusta automaticamente para o último dia do mês.</p>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2">
                <input
                  id="gerar-todas"
                  type="checkbox"
                  checked={gerarMensalidadesTodas}
                  onChange={(e) => setGerarMensalidadesTodas(e.target.checked)}
                  className="h-4 w-4 text-emerald-600 border-gray-300 rounded"
                />
                <label htmlFor="gerar-todas" className="text-sm text-gray-700">
                  Gerar mensalidades para todo o ano letivo
                </label>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Se desmarcado, criaremos apenas a mensalidade do mês da matrícula. Caso a matrícula ocorra após o dia de vencimento, aplicamos pró-rata no primeiro mês.
              </p>
            </div>

            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <div className="flex justify-end gap-4 pt-6">
              <button
                type="button"
                onClick={() => router.back()}
                className="px-6 py-3 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-3 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? "Salvando..." : "Confirmar Matrícula"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
