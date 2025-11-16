"use client";

import { useState, useEffect } from "react";

interface TurmaFormProps {
  onSuccess: () => void;
}

interface AnoLetivo {
  id: string;
  nome: string;
}

interface Classe {
  id: string;
  nome: string;
}

interface Curso {
  id: string;
  nome: string;
}

interface Diretor {
  id: string;
  user_id: string;
  nome: string;
}

interface Professor {
  id: string;
  user_id: string;
  nome: string;
}

export default function TurmaForm({ onSuccess }: TurmaFormProps) {
  const [nome, setNome] = useState("");
  const [classeId, setClasseId] = useState("");
  const [cursoId, setCursoId] = useState("");
  const [turno, setTurno] = useState("");
  const [anoLetivo, setAnoLetivo] = useState("");
  const [diretorTurma, setDiretorTurma] = useState("");
  const [coordenadorPedagogico, setCoordenadorPedagogico] = useState("");
  const [capacidadeMaxima, setCapacidadeMaxima] = useState<number>(30);
  const [sala, setSala] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [anosLetivos, setAnosLetivos] = useState<AnoLetivo[]>([]);
  const [classes, setClasses] = useState<Classe[]>([]);
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [diretores, setDiretores] = useState<Diretor[]>([]);
  const [coordenadores, setCoordenadores] = useState<Professor[]>([]);
  const [carregandoDados, setCarregandoDados] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setCarregandoDados(true);
        console.log("🔄 Carregando dados para formulário de turma...");

        const [anosRes, classesRes, cursosRes, diretoresRes, coordenadoresRes] = await Promise.all([
          fetch("/api/secretaria/school-sessions"),
          fetch("/api/secretaria/classes"),
          fetch("/api/secretaria/cursos"),
          fetch("/api/secretaria/professores?cargo=diretor&days=99999"),
          fetch("/api/secretaria/professores?cargo=coordenador&days=99999"),
        ]);

        const [anosJson, classesJson, cursosJson, diretoresJson, coordenadoresJson] = await Promise.all([
          anosRes.json(),
          classesRes.json(),
          cursosRes.json(),
          diretoresRes.json(),
          coordenadoresRes.json(),
        ]);

        console.log("📊 Respostas da API:", {
          anos: anosJson,
          classes: classesJson,
          cursos: cursosJson,
          diretores: diretoresJson,
          coordenadores: coordenadoresJson,
        });

        if (anosJson.ok && anosJson.items) {
          setAnosLetivos(anosJson.items);
        }

        if (classesJson.ok && classesJson.items) {
          setClasses(classesJson.items);
        }

        if (cursosJson.ok && cursosJson.items) {
          setCursos(cursosJson.items);
        }

        if (diretoresJson.ok && diretoresJson.items) {
          setDiretores(diretoresJson.items);
        }

        if (coordenadoresJson.ok && coordenadoresJson.items) {
          setCoordenadores(coordenadoresJson.items);
        }

      } catch (e) {
        console.error("💥 Erro ao carregar dados:", e);
        setError("Falha ao carregar dados para o formulário.");
      } finally {
        setCarregandoDados(false);
      }
    };
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // ✅ Validação dos campos obrigatórios
    const camposObrigatorios = [
      { campo: nome, nome: "Nome da Turma" },
      { campo: classeId, nome: "Classe" },
      { campo: cursoId, nome: "Curso" },
      { campo: turno, nome: "Turno" },
      { campo: anoLetivo, nome: "Ano Letivo" },
    ];

    const camposFaltantes = camposObrigatorios.filter(item => !item.campo);
    if (camposFaltantes.length > 0) {
      setError(`Por favor, preencha todos os campos obrigatórios: ${camposFaltantes.map(item => item.nome).join(', ')}`);
      setLoading(false);
      return;
    }

    try {
      const payload = {
        nome,
        classe_id: classeId,
        curso_id: cursoId,
        turno,
        session_id: anoLetivo,
        diretor_turma_id: diretorTurma || null,
        coordenador_pedagogico_id: coordenadorPedagogico || null,
        capacidade_maxima: capacidadeMaxima,
        sala: sala || null,
      };

      console.log("📤 Enviando payload:", payload);

      const res = await fetch("/api/secretaria/turmas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      console.log("📥 Resposta da API:", json);

      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Falha ao criar turma");
      }

      onSuccess();
    } catch (e) {
      console.error("💥 Erro no submit:", e);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  if (carregandoDados) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-sm text-gray-600">Carregando dados do formulário...</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Informações Básicas da Turma */}
      <div className="border-b border-gray-200 pb-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Informações Básicas</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="nome" className="block text-sm font-medium text-gray-700">
              Nome da Turma *
            </label>
            <input
              type="text"
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: 10ª A, 11ª B, etc."
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm"
              required
            />
          </div>

          <div>
            <label htmlFor="sala" className="block text-sm font-medium text-gray-700">
              Sala/Ambiente
            </label>
            <input
              type="text"
              id="sala"
              value={sala}
              onChange={(e) => setSala(e.target.value)}
              placeholder="Ex: Sala 101, Laboratório 2"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm"
            />
          </div>
        </div>
      </div>

      {/* Informações Acadêmicas */}
      <div className="border-b border-gray-200 pb-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Informações Acadêmicas</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="anoLetivo" className="block text-sm font-medium text-gray-700">
              Ano Letivo *
            </label>
            <select
              id="anoLetivo"
              value={anoLetivo}
              onChange={(e) => setAnoLetivo(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm"
              required
            >
              <option value="">Selecione o ano letivo</option>
              {anosLetivos.map((ano) => (
                <option key={ano.id} value={ano.id}>
                  {ano.nome}
                </option>
              ))}
            </select>
            {anosLetivos.length === 0 && (
              <p className="mt-1 text-xs text-red-500">Nenhum ano letivo disponível</p>
            )}
          </div>

          <div>
            <label htmlFor="classe" className="block text-sm font-medium text-gray-700">
              Classe *
            </label>
            <select
              id="classe"
              value={classeId}
              onChange={(e) => setClasseId(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm"
              required
            >
              <option value="">Selecione a classe</option>
              {classes.map((classe) => (
                <option key={classe.id} value={classe.id}>
                  {classe.nome}
                </option>
              ))}
            </select>
            {classes.length === 0 && (
              <p className="mt-1 text-xs text-red-500">Nenhuma classe disponível</p>
            )}
          </div>

          <div>
            <label htmlFor="curso" className="block text-sm font-medium text-gray-700">
              Curso *
            </label>
            <select
              id="curso"
              value={cursoId}
              onChange={(e) => setCursoId(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm"
              required
            >
              <option value="">Selecione o curso</option>
              {cursos.map((curso) => (
                <option key={curso.id} value={curso.id}>
                  {curso.nome}
                </option>
              ))}
            </select>
            {cursos.length === 0 && (
              <p className="mt-1 text-xs text-red-500">Nenhum curso disponível</p>
            )}
          </div>

          <div>
            <label htmlFor="turno" className="block text-sm font-medium text-gray-700">
              Turno *
            </label>
            <select
              id="turno"
              value={turno}
              onChange={(e) => setTurno(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm"
              required
            >
              <option value="">Selecione o turno</option>
              <option value="manha">Manhã</option>
              <option value="tarde">Tarde</option>
              <option value="noite">Noite</option>
              <option value="integral">Integral</option>
            </select>
          </div>
        </div>
      </div>

      {/* Equipe Pedagógica */}
      <div className="border-b border-gray-200 pb-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Equipe Pedagógica</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="diretorTurma" className="block text-sm font-medium text-gray-700">
              Diretor de Turma
            </label>
            <select
              id="diretorTurma"
              value={diretorTurma}
              onChange={(e) => setDiretorTurma(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm"
            >
              <option value="">Selecione um diretor de turma</option>
              {diretores.map((diretor) => (
                <option key={diretor.id} value={diretor.id}>
                  {diretor.nome}
                </option>
              ))}
            </select>
            {diretores.length === 0 && (
              <p className="mt-1 text-xs text-gray-500">Nenhum diretor disponível</p>
            )}
          </div>

          <div>
            <label htmlFor="coordenadorPedagogico" className="block text-sm font-medium text-gray-700">
              Coordenador Pedagógico
            </label>
            <select
              id="coordenadorPedagogico"
              value={coordenadorPedagogico}
              onChange={(e) => setCoordenadorPedagogico(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm"
            >
              <option value="">Selecione um coordenador</option>
              {coordenadores.map((coordenador) => (
                <option key={coordenador.id} value={coordenador.id}>
                  {coordenador.nome}
                </option>
              ))}
            </select>
            {coordenadores.length === 0 && (
              <p className="mt-1 text-xs text-gray-500">Nenhum coordenador disponível</p>
            )}
          </div>
        </div>
      </div>

      {/* Configurações Adicionais */}
      <div className="border-b border-gray-200 pb-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Configurações</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="capacidadeMaxima" className="block text-sm font-medium text-gray-700">
              Capacidade Máxima de Alunos
            </label>
            <input
              type="number"
              id="capacidadeMaxima"
              value={capacidadeMaxima}
              onChange={(e) => setCapacidadeMaxima(Number(e.target.value))}
              min="1"
              max="100"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm"
            />
            <p className="mt-1 text-xs text-gray-500">Número máximo de alunos nesta turma</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <div className="flex justify-end gap-4 pt-6">
        <button
          type="button"
          onClick={onSuccess}
          className="px-6 py-3 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-3 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
              Criando Turma...
            </>
          ) : (
            "Criar Turma"
          )}
        </button>
      </div>
    </form>
  );
}