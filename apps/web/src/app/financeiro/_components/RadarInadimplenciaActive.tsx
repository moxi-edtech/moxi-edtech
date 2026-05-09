"use client";

import { Fragment, useEffect, useState } from "react";
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
  mensalidade_id: string | null;
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
  mensalidades?: Array<{
    mensalidade_id: string | null;
    data_vencimento: string | null;
    dias_em_atraso: number | null;
    valor_em_atraso: number | null;
    valor_previsto: number | null;
    status_mensalidade: string;
  }>;
};

// --- Tipos usados no componente ---
export type RadarEntry = {
  id: string;
  aluno_id: string;
  mensalidade_id?: string | null;
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
  mensalidades: Array<{
    mensalidade_id: string | null;
    data_vencimento: string | null;
    dias_em_atraso: number | null;
    valor_em_atraso: number | null;
    valor_previsto: number | null;
    status_mensalidade: string;
  }>;
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
    `Olá ${responsavel}! Lembramos que a mensalidade do(a) ${nomeAluno} está em atraso há ${diasAtraso} dias no valor de ${valor.toLocaleString(
      "pt-AO"
    )} Kz. Podemos ajudar com alguma questão?`,

  cobrancaUrgente: ({ nomeAluno, responsavel, valor, diasAtraso }: TemplateArgs) =>
    `*URGENTE* - ${responsavel}, a mensalidade do(a) ${nomeAluno} está em atraso há ${diasAtraso} dias (${valor.toLocaleString(
      "pt-AO"
    )} Kz). Entre em contacto connosco para regularizar. Obrigado!`,

  lembreteAmigavel: ({ nomeAluno, responsavel, valor }: TemplateArgs) =>
    `Olá ${responsavel}! Apenas um lembrete amigável sobre a mensalidade do(a) ${nomeAluno} no valor de ${valor.toLocaleString(
      "pt-AO"
    )} Kz. Precisando de ajuda, estamos aqui!`,
};

type RadarInadimplenciaActiveProps = {
  onSelectionChange?: (entries: RadarEntry[]) => void;
  disableActions?: boolean;
};

export default function RadarInadimplenciaActive({
  onSelectionChange,
  disableActions = false,
}: RadarInadimplenciaActiveProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

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
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
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
            id: row.aluno_id,
            aluno_id: row.aluno_id,
            mensalidade_id: row.mensalidade_id ?? null,
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
            mensalidades: row.mensalidades ?? [],
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

  useEffect(() => {
    if (!onSelectionChange) return;
    const selectedEntries = dados.filter((d) => selectedIds.has(d.id));
    onSelectionChange(selectedEntries);
  }, [dados, onSelectionChange, selectedIds]);

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

  const toggleExpanded = (id: string) => {
    const updated = new Set(expandedIds);
    if (updated.has(id)) {
      updated.delete(id);
    } else {
      updated.add(id);
    }
    setExpandedIds(updated);
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
    entries: Array<{ aluno_id: string; id: string; mensagem: string; mensalidade_id?: string | null }>,
    status: "enviada" | "falha"
  ) => {
    if (entries.length === 0) return;
    await fetch("/api/financeiro/cobrancas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: entries.map((entry) => ({
          aluno_id: entry.aluno_id,
          mensalidade_id: entry.mensalidade_id ?? null,
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
    if (disableActions) return;
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
        mensalidade_id: item.mensalidade_id ?? null,
      };
    });

    try {
      const resultado = await WhatsAppService.enviarMensagemEmMassa(mensagens);

      await registrarCobrancas(
        mensagens.map((msg) => ({
          aluno_id: msg.aluno_id,
          id: msg.aluno_id,
          mensagem: msg.mensagem,
          mensalidade_id: msg.mensalidade_id,
        })),
        resultado.falhas > 0 ? "falha" : "enviada"
      );
      await carregarResumoCobrancas();

      alert(
        `${resultado.sucesso} mensagens enviadas com sucesso.\n` +
          `Potencial de recuperação: ${Math.floor(
            totalRecuperavel * 0.4
          ).toLocaleString("pt-AO")} Kz`
      );

      setSelectedIds(new Set());
    } catch (error) {
      alert("Erro ao enviar mensagens. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  };

  const handleCobrancaIndividual = async (item: RadarEntry) => {
    if (disableActions) return;
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
            mensalidade_id: item.mensalidade_id ?? null,
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
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* --- HEADER COM MÉTRICAS --- */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-2xl font-bold text-slate-900">
            {resumo.inadimplencia.total}
          </div>
          <div className="text-sm text-slate-500">Alunos Pendentes</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-2xl font-bold text-[#7A5200]">
            {mounted ? totalEmRisco.toLocaleString("pt-AO") : "—"} Kz
          </div>
          <div className="text-sm text-slate-500">Total em Risco</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-2xl font-bold text-[#1F6B3B]">
            {mounted ? potencialRecuperacao.toLocaleString("pt-AO") : "—"} Kz
          </div>
          <div className="text-sm text-slate-500">Potencial Recuperação</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-2xl font-bold text-slate-900">
            {resumo.matriculados.total}
          </div>
          <div className="text-sm text-slate-500">Matriculados</div>
        </div>
      </div>

      {/* --- HEADER DE AÇÃO --- */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#E3B23C] animate-pulse" />
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
            disabled={selectedIds.size === 0 || enviando || disableActions}
            className="inline-flex items-center gap-2 rounded-lg bg-[#1F6B3B] px-5 py-3 text-sm font-bold text-white hover:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#1F6B3B]/20 transition-all active:scale-95 transform hover:-translate-y-0.5"
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
          <h3 className="text-lg font-bold text-slate-900 mb-4">
            Eficácia das Cobranças
          </h3>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center p-4 bg-slate-50 rounded-lg">
              <div className="text-2xl font-bold text-slate-700">
                {relatorio.totalEnviadas}
              </div>
              <div className="text-sm text-slate-600">Mensagens Enviadas</div>
            </div>
            <div className="text-center p-4 bg-[#1F6B3B]/10 rounded-lg">
              <div className="text-2xl font-bold text-[#1F6B3B]">
                {relatorio.taxaResposta}%
              </div>
              <div className="text-sm text-[#1F6B3B]">Taxa de Resposta</div>
            </div>
            <div className="text-center p-4 bg-slate-50 rounded-lg">
              <div className="text-2xl font-bold text-slate-700">
                {relatorio.taxaConversao}%
              </div>
              <div className="text-sm text-slate-600">Taxa de Pagamento</div>
            </div>
            <div className="text-center p-4 bg-[#E3B23C]/10 rounded-lg">
              <div className="text-2xl font-bold text-[#7A5200]">
                {mounted ? relatorio.valorRecuperado.toLocaleString("pt-AO") : "—"} Kz
              </div>
              <div className="text-sm text-[#7A5200]">Valor Recuperado</div>
            </div>
          </div>

          {relatorio.totalEnviadas > 0 && (
            <div className="text-sm text-slate-600">
              <p>
                <strong>Performance:</strong> {relatorio.taxaResposta.toFixed(1)}% das mensagens recebem resposta e {relatorio.taxaConversao.toFixed(1)}% resultam em pagamento.
              </p>
            </div>
          )}
        </div>
      )}

      {/* --- FILTROS E PESQUISA --- */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por aluno ou responsável..."
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#E3B23C]/40"
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
                    className="rounded border-slate-300 text-[#1F6B3B] focus:ring-[#1F6B3B] h-4 w-4 cursor-pointer"
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

            <tbody className="divide-y divide-slate-200">
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
                  <Fragment key={item.id}>
                    <tr
                      className={`transition-colors ${
                        selectedIds.has(item.id) ? "bg-[#1F6B3B]/5" : "hover:bg-slate-50"
                      }`}
                    >
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300 text-[#1F6B3B] focus:ring-[#1F6B3B] h-4 w-4 cursor-pointer"
                        checked={selectedIds.has(item.id)}
                        onChange={() => toggleSelect(item.id)}
                      />
                    </td>
                    <td className="px-4 py-3 text-slate-900">
                      <div className="font-bold text-slate-900">
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
                        <span className="inline-flex items-center rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-bold text-rose-700 border border-rose-200">
                          Crítico
                        </span>
                      )}
                      {item.status === "atencao" && (
                        <span className="inline-flex items-center rounded-full bg-[#E3B23C]/15 px-2.5 py-0.5 text-xs font-bold text-[#7A5200] border border-[#E3B23C]/30">
                          Atenção
                        </span>
                      )}
                      {item.status === "recente" && (
                        <span className="inline-flex items-center rounded-full bg-slate-50 px-2.5 py-0.5 text-xs font-bold text-slate-600 border border-slate-200">
                          Recente
                        </span>
                      )}
                      {item.ultimo_contato && (
                        <div className="text-[10px] text-slate-400 mt-1">
                          Último: {item.ultimo_contato}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="font-bold text-slate-700">
                        {item.dias_atraso} dias
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-700">
                      {mounted ? item.valor_divida.toLocaleString("pt-AO", {
                        style: "currency",
                        currency: "AOA",
                        maximumFractionDigits: 0,
                      }) : "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center gap-1">
                        <button
                          onClick={() => handleCobrancaIndividual(item)}
                          disabled={disableActions}
                          className="p-2 rounded-lg text-[#1F6B3B] hover:bg-[#1F6B3B]/10 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                          title="Enviar Cobrança via WhatsApp"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() =>
                            window.open(`tel:${item.telefone}`, "_blank")
                          }
                          disabled={disableActions}
                          className="p-2 rounded-lg text-[#1F6B3B] hover:bg-[#1F6B3B]/10 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                          title="Ligar"
                        >
                          <Phone className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => toggleExpanded(item.id)}
                          className="px-2 py-1 text-xs font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                        >
                          {expandedIds.has(item.id) ? "Ocultar" : "Detalhes"}
                        </button>
                      </div>
                    </td>
                    </tr>
                    {expandedIds.has(item.id) && (
                      <tr className="bg-slate-50/60">
                        <td colSpan={6} className="px-4 py-4">
                          <div className="text-xs font-semibold text-slate-600 mb-2">
                            Mensalidades em atraso
                          </div>
                          <div className="overflow-x-auto">
                            <table className="min-w-full text-xs">
                              <thead>
                                <tr className="text-left text-slate-500">
                                  <th className="py-1">Vencimento</th>
                                  <th className="py-1">Dias atraso</th>
                                  <th className="py-1">Valor previsto</th>
                                  <th className="py-1">Valor em atraso</th>
                                  <th className="py-1">Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(item.mensalidades ?? []).map((mensalidade, index) => (
                                  <tr key={mensalidade.mensalidade_id ?? `${item.id}-${index}`}>
                                    <td className="py-1 pr-4">
                                      {mounted && mensalidade.data_vencimento
                                        ? new Date(mensalidade.data_vencimento).toLocaleDateString()
                                        : "—"}
                                    </td>
                                    <td className="py-1 pr-4">
                                      {mensalidade.dias_em_atraso ?? 0}
                                    </td>
                                    <td className="py-1 pr-4">
                                      {mounted ? (mensalidade.valor_previsto ?? 0).toLocaleString("pt-AO", {
                                        style: "currency",
                                        currency: "AOA",
                                        maximumFractionDigits: 0,
                                      }) : "—"}
                                    </td>
                                    <td className="py-1 pr-4">
                                      {mounted ? (mensalidade.valor_em_atraso ?? 0).toLocaleString("pt-AO", {
                                        style: "currency",
                                        currency: "AOA",
                                        maximumFractionDigits: 0,
                                      }) : "—"}
                                    </td>
                                    <td className="py-1">{mensalidade.status_mensalidade}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
