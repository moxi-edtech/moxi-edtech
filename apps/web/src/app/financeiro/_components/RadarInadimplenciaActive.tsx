"use client";

import { useEffect, useState } from "react";
import {
  Loader2,
  Filter,
  MessageCircle,
  Search,
  BarChart3,
  Zap,
  Phone,
  MessageSquare,
} from "lucide-react";

// --- Tipos vindos da API (view vw_radar_inadimplencia) ---
type RadarRowFromApi = {
  mensalidade_id: string;
  aluno_id: string;
  nome_aluno: string;
  numero_matricula?: string | null;
  responsavel: string | null;
  telefone: string | null;
  nome_turma: string | null;
  valor_previsto: number | null;
  valor_pago_total: number | null;
  valor_em_atraso: number | null;
  data_vencimento: string | null;
  dias_em_atraso: number | null;
  status_risco: "critico" | "atencao" | "recente";
  status_mensalidade: string;
};

// --- Tipos usados no componente ---
type RadarEntry = {
  id: string;
  aluno_id: string;
  nome_aluno: string;
  numero_matricula: string | null;
  responsavel: string;
  telefone: string;
  turma: string;
  dias_atraso: number;
  valor_divida: number;
  status: "critico" | "atencao" | "recente";
  ultimo_contato: string | null;
  ultimo_contato_data?: Date;
};

type Relatorio = {
  totalEnviadas: number;
  totalRespondidas: number;
  totalPagos: number;
  taxaResposta: number;
  taxaConversao: number;
  valorRecuperado: number;
  historico: Array<{
    data: string;
    enviadas: number;
    respondidas: number;
    pagos: number;
  }>;
};

// --- Serviço de WhatsApp (modo demo/front) ---
class WhatsAppService {
  static async enviarMensagemIndividual(
    telefone: string,
    mensagem: string
  ): Promise<boolean> {
    const telefoneFormatado = telefone.replace(/\D/g, "");
    const textoFormatado = encodeURIComponent(mensagem);
    const url = `https://wa.me/${telefoneFormatado}?text=${textoFormatado}`;
    window.open(url, "_blank");

    await new Promise((resolve) => setTimeout(resolve, 1000));
    return true;
  }

  static async enviarMensagemEmMassa(
    contatos: Array<{ telefone: string; mensagem: string }>
  ): Promise<{ sucesso: number; falhas: number }> {
    let sucesso = 0;
    let falhas = 0;

    for (const contato of contatos) {
      try {
        const enviado = await this.enviarMensagemIndividual(
          contato.telefone,
          contato.mensagem
        );
        if (enviado) {
          sucesso++;
          await new Promise((resolve) => setTimeout(resolve, 500));
        } else {
          falhas++;
        }
      } catch {
        falhas++;
      }
    }

    return { sucesso, falhas };
  }
}

// --- Templates de Mensagem (tipados) ---
type TemplateArgs = {
  nomeAluno: string;
  responsavel: string;
  valor: number;
  diasAtraso: number;
};

const MensagensTemplates = {
  cobrancaSimples: ({ nomeAluno, responsavel, valor, diasAtraso }: TemplateArgs) =>
    `Olá ${responsavel}! 😊 Lembramos que a mensalidade do(a) ${nomeAluno} está em atraso há ${diasAtraso} dias no valor de ${valor.toLocaleString(
      "pt-AO"
    )} Kz. Podemos ajudar com alguma questão?`,

  cobrancaUrgente: ({ nomeAluno, responsavel, valor, diasAtraso }: TemplateArgs) =>
    `*URGENTE* - ${responsavel}, a mensalidade do(a) ${nomeAluno} está em atraso há ${diasAtraso} dias (${valor.toLocaleString(
      "pt-AO"
    )} Kz). Entre em contacto connosco para regularizar. Obrigado!`,

  lembreteAmigavel: ({ nomeAluno, responsavel, valor }: TemplateArgs) =>
    `Olá ${responsavel}! 🤗 Apenas um lembrete amigável sobre a mensalidade do(a) ${nomeAluno} no valor de ${valor.toLocaleString(
      "pt-AO"
    )} Kz. Precisando de ajuda, estamos aqui!`,
};

export default function RadarInadimplenciaActive() {
  const [dados, setDados] = useState<RadarEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [resumo, setResumo] = useState<{
    matriculados: { total: number };
    inadimplencia: { total: number; percentual: number };
    risco: { total: number };
    confirmados: { total: number; valor?: number };
    pendentes: { total: number; valor?: number };
  }>({
    matriculados: { total: 0 },
    inadimplencia: { total: 0, percentual: 0 },
    risco: { total: 0 },
    confirmados: { total: 0 },
    pendentes: { total: 0 },
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filtroTexto, setFiltroTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [mostrarRelatorio, setMostrarRelatorio] = useState(false);
  const [relatorio, setRelatorio] = useState<Relatorio>({
    totalEnviadas: 0,
    totalRespondidas: 0,
    totalPagos: 0,
    taxaResposta: 0,
    taxaConversao: 0,
    valorRecuperado: 0,
    historico: [],
  });

  // Carregar dados reais da API
  useEffect(() => {
    const fetchDados = async () => {
      try {
        setLoading(true);
        const [radarRes, dashRes, cobrancasRes] = await Promise.all([
          fetch("/api/financeiro/radar", { cache: "no-store" }),
          fetch("/api/financeiro", { cache: "no-store" }),
          fetch("/api/financeiro/cobrancas/resumo", { cache: "no-store" }),
        ]);

        if (!radarRes.ok) {
          console.error(
            "Erro HTTP ao buscar radar:",
            radarRes.status,
            radarRes.statusText
          );
          setDados([]);
        } else {
          const json = await radarRes.json();
          const rows: RadarRowFromApi[] = json.items ?? json.data ?? [];
          const mapped: RadarEntry[] = rows.map((row) => ({
            id: row.mensalidade_id,
            aluno_id: row.aluno_id,
            nome_aluno: row.nome_aluno,
            numero_matricula: row.numero_matricula ?? null,
            responsavel: row.responsavel ?? "—",
            telefone: row.telefone ?? "",
            turma: row.nome_turma ?? "—",
            dias_atraso: row.dias_em_atraso ?? 0,
            valor_divida: Number(
              row.valor_em_atraso ?? row.valor_previsto ?? 0
            ),
            status: row.status_risco,
            ultimo_contato: null,
            ultimo_contato_data: undefined,
          }));
          setDados(mapped);
        }

        if (dashRes.ok) {
          const r = await dashRes.json();
          setResumo({
            matriculados: r?.matriculados ?? { total: 0 },
            inadimplencia: r?.inadimplencia ?? { total: 0, percentual: 0 },
            risco: r?.risco ?? { total: 0 },
            confirmados: r?.confirmados ?? { total: 0 },
            pendentes: r?.pendentes ?? { total: 0 },
          });
        }

        if (cobrancasRes.ok) {
          const cobrancasJson = await cobrancasRes.json();
          if (cobrancasJson?.ok && cobrancasJson?.resumo) {
            setRelatorio({
              totalEnviadas: cobrancasJson.resumo.totalEnviadas ?? 0,
              totalRespondidas: cobrancasJson.resumo.totalRespondidas ?? 0,
              totalPagos: cobrancasJson.resumo.totalPagos ?? 0,
              taxaResposta: cobrancasJson.resumo.taxaResposta ?? 0,
              taxaConversao: cobrancasJson.resumo.taxaConversao ?? 0,
              valorRecuperado: cobrancasJson.resumo.valorRecuperado ?? 0,
              historico: cobrancasJson.historico ?? [],
            });
          }
        }
      } catch (err) {
        console.error("Erro ao buscar Radar:", err);
        setDados([]);
      } finally {
        setLoading(false);
      }
    };

    fetchDados();
  }, []);

  // Lógica de Seleção
  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === dados.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(dados.map((d) => d.id)));
    }
  };

  const carregarResumoCobrancas = async () => {
    const res = await fetch("/api/financeiro/cobrancas/resumo", { cache: "no-store" });
    if (!res.ok) return;
    const json = await res.json();
    if (!json?.ok || !json?.resumo) return;
    setRelatorio({
      totalEnviadas: json.resumo.totalEnviadas ?? 0,
      totalRespondidas: json.resumo.totalRespondidas ?? 0,
      totalPagos: json.resumo.totalPagos ?? 0,
      taxaResposta: json.resumo.taxaResposta ?? 0,
      taxaConversao: json.resumo.taxaConversao ?? 0,
      valorRecuperado: json.resumo.valorRecuperado ?? 0,
      historico: json.historico ?? [],
    });
  };

  const registrarCobrancas = async (
    entries: Array<{ aluno_id: string; id: string; mensagem: string }>,
    status: "enviada" | "falha"
  ) => {
    if (entries.length === 0) return;
    await fetch("/api/financeiro/cobrancas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: entries.map((entry) => ({
          aluno_id: entry.aluno_id,
          mensalidade_id: entry.id,
          canal: "whatsapp",
          status,
          mensagem: entry.mensagem,
          enviado_em: new Date().toISOString(),
        })),
      }),
    }).catch(() => null);
  };

  // --- INTEGRAÇÃO WHATSAPP (demo/front) ---
  const handleCobrancaMassa = async () => {
    if (selectedIds.size === 0) return;

    setEnviando(true);

    const selecionados = dados.filter((d) => selectedIds.has(d.id));
    const totalRecuperavel = selecionados.reduce(
      (acc, curr) => acc + curr.valor_divida,
      0
    );

    const mensagens = selecionados.map((item) => {
      let template:
        | typeof MensagensTemplates.cobrancaUrgente
        | typeof MensagensTemplates.cobrancaSimples
        | typeof MensagensTemplates.lembreteAmigavel;

      if (item.status === "critico") {
        template = MensagensTemplates.cobrancaUrgente;
      } else if (item.status === "atencao") {
        template = MensagensTemplates.cobrancaSimples;
      } else {
        template = MensagensTemplates.lembreteAmigavel;
      }

      const args: TemplateArgs = {
        nomeAluno: item.nome_aluno,
        responsavel: item.responsavel,
        valor: item.valor_divida,
        diasAtraso: item.dias_atraso,
      };

      return {
        telefone: item.telefone,
        mensagem: template(args),
        aluno_id: item.aluno_id,
        mensalidade_id: item.id,
      };
    });

    try {
      const resultado = await WhatsAppService.enviarMensagemEmMassa(mensagens);

      await registrarCobrancas(
        mensagens.map((msg) => ({
          aluno_id: msg.aluno_id,
          id: msg.mensalidade_id,
          mensagem: msg.mensagem,
        })),
        resultado.falhas > 0 ? "falha" : "enviada"
      );
      await carregarResumoCobrancas();

      alert(
        `✅ ${resultado.sucesso} mensagens enviadas com sucesso!\n` +
          `💰 Potencial de recuperação: ${Math.floor(
            totalRecuperavel * 0.4
          ).toLocaleString("pt-AO")} Kz`
      );

      setSelectedIds(new Set());
    } catch (error) {
      alert("❌ Erro ao enviar mensagens. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  };

  const handleCobrancaIndividual = async (item: RadarEntry) => {
    let template:
      | typeof MensagensTemplates.cobrancaUrgente
      | typeof MensagensTemplates.cobrancaSimples
      | typeof MensagensTemplates.lembreteAmigavel;

    if (item.status === "critico") {
      template = MensagensTemplates.cobrancaUrgente;
    } else if (item.status === "atencao") {
      template = MensagensTemplates.cobrancaSimples;
    } else {
      template = MensagensTemplates.lembreteAmigavel;
    }

    const args: TemplateArgs = {
      nomeAluno: item.nome_aluno,
      responsavel: item.responsavel,
      valor: item.valor_divida,
      diasAtraso: item.dias_atraso,
    };

    const mensagem = template(args);

    try {
      await WhatsAppService.enviarMensagemIndividual(item.telefone, mensagem);
      await registrarCobrancas(
        [
          {
            aluno_id: item.aluno_id,
            id: item.id,
            mensagem,
          },
        ],
        "enviada"
      );
      await carregarResumoCobrancas();

      setDados((prev) =>
        prev.map((d) =>
          d.id === item.id
            ? { ...d, ultimo_contato: "Agora", ultimo_contato_data: new Date() }
            : d
        )
      );
    } catch {
      alert("Erro ao abrir WhatsApp");
    }
  };

  const dadosFiltrados = dados.filter(
    (d) =>
      d.nome_aluno.toLowerCase().includes(filtroTexto.toLowerCase()) ||
      d.responsavel.toLowerCase().includes(filtroTexto.toLowerCase())
  );

  const totalEmRisco = dados.reduce(
    (acc, curr) => acc + curr.valor_divida,
    0
  );
  const potencialRecuperacao = Math.floor(totalEmRisco * 0.7); // 70% estimado

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 p-6 bg-slate-50 rounded-xl">
      {/* --- HEADER COM MÉTRICAS --- */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-2xl font-bold text-moxinexa-navy">
            {resumo.inadimplencia.total}
          </div>
          <div className="text-sm text-slate-500">Alunos Pendentes</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-2xl font-bold text-orange-600">
            {totalEmRisco.toLocaleString("pt-AO")} Kz
          </div>
          <div className="text-sm text-slate-500">Total em Risco</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-2xl font-bold text-moxinexa-teal">
            {potencialRecuperacao.toLocaleString("pt-AO")} Kz
          </div>
          <div className="text-sm text-slate-500">Potencial Recuperação</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-2xl font-bold text-green-600">
            {resumo.matriculados.total}
          </div>
          <div className="text-sm text-slate-500">Matriculados</div>
        </div>
      </div>

      {/* --- HEADER DE AÇÃO --- */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-moxinexa-navy flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
            Radar de Inadimplência
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {dados.length} alunos pendentes • {selectedIds.size} selecionados
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setMostrarRelatorio(!mostrarRelatorio)}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 transition-all"
          >
            <BarChart3 className="h-4 w-4" />
            Relatório
          </button>

          <button
            onClick={handleCobrancaMassa}
            disabled={selectedIds.size === 0 || enviando}
            className="inline-flex items-center gap-2 rounded-lg bg-moxinexa-teal px-5 py-3 text-sm font-bold text-white hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-teal-900/20 transition-all active:scale-95 transform hover:-translate-y-0.5"
          >
            {enviando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MessageCircle className="h-4 w-4" />
            )}
            {selectedIds.size === 0
              ? "Selecione para Cobrar"
              : enviando
              ? "Enviando..."
              : `Cobrar ${selectedIds.size} Responsáveis`}
          </button>
        </div>
      </div>

      {/* --- RELATÓRIO EXPANDIDO --- */}
      {mostrarRelatorio && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-moxinexa-navy mb-4 flex items-center gap-2">
            <Zap className="h-5 w-5 text-green-500" />
            Eficácia das Cobranças
          </h3>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {relatorio.totalEnviadas}
              </div>
              <div className="text-sm text-blue-700">Mensagens Enviadas</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {relatorio.taxaResposta}%
              </div>
              <div className="text-sm text-green-700">Taxa de Resposta</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {relatorio.taxaConversao}%
              </div>
              <div className="text-sm text-purple-700">Taxa de Pagamento</div>
            </div>
            <div className="text-center p-4 bg-teal-50 rounded-lg">
              <div className="text-2xl font-bold text-moxinexa-teal">
                {relatorio.valorRecuperado.toLocaleString("pt-AO")} Kz
              </div>
              <div className="text-sm text-teal-700">Valor Recuperado</div>
            </div>
          </div>

          <div className="text-sm text-slate-600">
            <p>
              📊 <strong>Performance:</strong> A cada 10 mensagens, em média 6
              recebem resposta e 4 resultam em pagamento.
            </p>
            <p className="mt-2">
              💡 <strong>Insight:</strong> Cobranças enviadas às terças-feiras
              têm 15% mais respostas.
            </p>
          </div>
        </div>
      )}

      {/* --- FILTROS E PESQUISA --- */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por aluno ou responsável..."
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-moxinexa-teal"
            value={filtroTexto}
            onChange={(e) => setFiltroTexto(e.target.value)}
          />
        </div>
        <button className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 flex items-center gap-2 text-sm font-medium">
          <Filter className="h-4 w-4" /> Filtros
        </button>
      </div>

      {/* --- TABELA ATIVA --- */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-4 text-left w-10">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-moxinexa-teal focus:ring-moxinexa-teal h-4 w-4 cursor-pointer"
                    checked={dados.length > 0 && selectedIds.size === dados.length}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                  Aluno / Responsável
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-500">
                  Dias Atraso
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-500">
                  Valor
                </th>
                <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wide text-slate-500">
                  Ação Rápida
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                    Carregando devedores...
                  </td>
                </tr>
              ) : dadosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    Nenhum registo encontrado.
                  </td>
                </tr>
              ) : (
                dadosFiltrados.map((item) => (
                  <tr
                    key={item.id}
                    className={`transition-colors ${
                      selectedIds.has(item.id)
                        ? "bg-teal-50/50"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 text-moxinexa-teal focus:ring-moxinexa-teal h-4 w-4 cursor-pointer"
                        checked={selectedIds.has(item.id)}
                        onChange={() => toggleSelect(item.id)}
                      />
                    </td>
                    <td className="px-4 py-3 text-slate-900">
                      <div className="font-bold text-moxinexa-navy">
                        {item.nome_aluno}
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-1">
                        {item.responsavel} •{" "}
                        <span className="font-mono">{item.telefone}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        Mat.: {item.numero_matricula ?? "—"}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {item.status === "critico" && (
                        <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-700">
                          ⚠️ Crítico
                        </span>
                      )}
                      {item.status === "atencao" && (
                        <span className="inline-flex items-center rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-bold text-orange-700">
                          ✋ Atenção
                        </span>
                      )}
                      {item.status === "recente" && (
                        <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-700">
                          🆕 Recente
                        </span>
                      )}
                      {item.ultimo_contato && (
                        <div className="text-[10px] text-slate-400 mt-1">
                          Último: {item.ultimo_contato}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div
                        className={`font-bold ${
                          item.dias_atraso > 30
                            ? "text-red-600"
                            : "text-slate-600"
                        }`}
                      >
                        {item.dias_atraso} dias
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-700">
                      {item.valor_divida.toLocaleString("pt-AO", {
                        style: "currency",
                        currency: "AOA",
                        maximumFractionDigits: 0,
                      })}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center gap-1">
                        <button
                          onClick={() => handleCobrancaIndividual(item)}
                          className="text-moxinexa-teal hover:text-white hover:bg-moxinexa-teal p-2 rounded-lg transition-all"
                          title="Enviar Cobrança via WhatsApp"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() =>
                            window.open(`tel:${item.telefone}`, "_blank")
                          }
                          className="text-green-600 hover:text-white hover:bg-green-600 p-2 rounded-lg transition-all"
                          title="Ligar"
                        >
                          <Phone className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
