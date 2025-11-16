"use client";

import { useState, useEffect } from "react";

interface TurmaFormProps {
  onSuccess: () => void;
}

interface AnoLetivo {
  id: string;
  nome: string;
}

export default function TurmaForm({ onSuccess }: TurmaFormProps) {
  // ✅ ESTADOS ESSENCIAIS - apenas dados que existem na tabela
  const [nome, setNome] = useState("");
  const [turno, setTurno] = useState("");
  const [anoLetivoId, setAnoLetivoId] = useState(""); // ✅ CORREÇÃO: usar ID da sessão
  const [sala, setSala] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ✅ CORREÇÃO: Carregar anos letivos das sessões acadêmicas
  const [anosLetivos, setAnosLetivos] = useState<AnoLetivo[]>([]);
  const [carregandoAnos, setCarregandoAnos] = useState(true);

  useEffect(() => {
    const fetchAnosLetivos = async () => {
      try {
        setCarregandoAnos(true);
        console.log("🔄 Carregando anos letivos...");

        const res = await fetch("/api/secretaria/school-sessions");
        const json = await res.json();

        console.log("📊 Resposta da API (school-sessions):", json);

        if (json.ok && json.items) {
          setAnosLetivos(json.items);
        } else {
          console.error("❌ Erro ao carregar anos letivos:", json.error);
        }
      } catch (e) {
        console.error("💥 Erro ao carregar anos letivos:", e);
      } finally {
        setCarregandoAnos(false);
      }
    };

    fetchAnosLetivos();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // ✅ VALIDAÇÃO MÍNIMA - apenas dados que existem
    const camposObrigatorios = [
      { campo: nome, nome: "Nome da Turma" },
      { campo: turno, nome: "Turno" },
    ];

    const camposFaltantes = camposObrigatorios.filter(item => !item.campo);
    if (camposFaltantes.length > 0) {
      setError(`Por favor, preencha todos os campos obrigatórios: ${camposFaltantes.map(item => item.nome).join(', ')}`);
      setLoading(false);
      return;
    }

    try {
      // ✅ CORREÇÃO: Enviar o nome do ano letivo em vez do ID
      const anoLetivoSelecionado = anosLetivos.find(ano => ano.id === anoLetivoId);
      const anoLetivoNome = anoLetivoSelecionado ? anoLetivoSelecionado.nome : null;

      const payload = {
        nome,
        turno,
        ano_letivo: anoLetivoNome, // ✅ CORREÇÃO: enviar o nome do ano letivo
        sala: sala || null,
      };

      console.log("📤 Enviando payload correto:", payload);

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
      const errorMessage = e instanceof Error ? e.message : String(e);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Informações Básicas da Turma */}
      <div className="border-b border-gray-200 pb-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Identificação da Turma</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="nome" className="block text-sm font-medium text-gray-700">
              Nome/Identificação *
            </label>
            <input
              type="text"
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Sala 101, Laboratório 2, Bloco A"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm"
              required
            />
            <p className="mt-1 text-xs text-gray-500">
              Identificação única do agrupamento físico
            </p>
          </div>

          <div>
            <label htmlFor="sala" className="block text-sm font-medium text-gray-700">
              Local/Sala
            </label>
            <input
              type="text"
              id="sala"
              value={sala}
              onChange={(e) => setSala(e.target.value)}
              placeholder="Ex: Sala 101, Laboratório de Ciências"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm"
            />
            <p className="mt-1 text-xs text-gray-500">
              Espaço físico onde a turma se reúne
            </p>
          </div>
        </div>
      </div>

      {/* Configurações de Horário e Período */}
      <div className="border-b border-gray-200 pb-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Horário e Período</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="anoLetivoId" className="block text-sm font-medium text-gray-700">
              Ano Letivo
            </label>
            <select
              id="anoLetivoId"
              value={anoLetivoId}
              onChange={(e) => setAnoLetivoId(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm"
              disabled={carregandoAnos}
            >
              <option value="">
                {carregandoAnos ? "Carregando anos letivos..." : "Selecione o ano letivo"}
              </option>
              {anosLetivos.map((ano) => (
                <option key={ano.id} value={ano.id}>
                  {ano.nome}
                </option>
              ))}
            </select>
            {carregandoAnos && (
              <p className="mt-1 text-xs text-gray-500">Carregando anos letivos...</p>
            )}
            {!carregandoAnos && anosLetivos.length === 0 && (
              <p className="mt-1 text-xs text-amber-600">
                Nenhum ano letivo cadastrado. Configure primeiro as sessões acadêmicas.
              </p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              Período letivo (opcional)
            </p>
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
            <p className="mt-1 text-xs text-gray-500">
              Período de funcionamento da turma
            </p>
          </div>
        </div>
      </div>

      {/* Informações sobre o conceito de turma */}
      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
        <h4 className="text-sm font-medium text-blue-900 mb-2">💡 Sobre Turmas</h4>
        <p className="text-xs text-blue-700">
          <strong>Turma</strong> = Agrupamento físico/horário<br/>
          <strong>Classe/Curso</strong> = Contexto acadêmico (definido na matrícula)<br/>
          <strong>Ano Letivo</strong> = Período acadêmico (definido nas sessões)<br/>
          <br/>
          Esta turma é um container onde alunos de diferentes classes e cursos 
          podem compartilhar o mesmo espaço/tempo.
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
          onClick={onSuccess}
          className="px-6 py-3 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading || carregandoAnos}
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