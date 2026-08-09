"use client";

import { useEffect, useState, useMemo } from "react";
import {
  GraduationCap,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Archive,
  UserCheck,
  Search,
  X,
  ChevronRight,
  Loader2,
  Info,
} from "lucide-react";
import { useEscolaId } from "@/hooks/useEscolaId";

type ReclassificacaoRecord = {
  id: string;
  aluno_id: string;
  matricula_id: string;
  tipo: "FIM_PRIMARIO" | "FIM_I_CICLO" | "PRE_ESCOLAR" | string;
  status: "aguardando_destino" | "matriculado_novo_ciclo" | "concluido_arquivado" | string;
  motivo?: string | null;
  created_at: string;
  aluno?: {
    id: string;
    nome: string;
    nome_completo?: string;
    bi_numero?: string | null;
  } | null;
  origem_turma?: {
    id: string;
    nome: string;
  } | null;
  destino_turma?: {
    id: string;
    nome: string;
  } | null;
  matricula?: {
    session_id?: string;
    ativo?: boolean;
    ano_letivo?: number;
  } | null;
};

type TurmaOption = {
  id: string;
  nome: string;
  turno?: string | null;
  capacidade_maxima?: number;
  ocupacao_atual?: number;
};

const TIPO_LABELS: Record<string, { label: string; badgeCls: string }> = {
  FIM_PRIMARIO: { label: "Fim do Primário (6.ª)", badgeCls: "bg-blue-50 text-blue-700 border-blue-200" },
  FIM_I_CICLO: { label: "Fim do I Ciclo (9.ª)", badgeCls: "bg-[#E3B23C]/10 text-[#9a7010] border-[#E3B23C]/20" },
  PRE_ESCOLAR: { label: "Pré-Escolar", badgeCls: "bg-purple-50 text-purple-700 border-purple-200" },
};

export function ReclassificacaoFinalistasClient({
  initialAlunoId,
  onResolved,
  onPaymentRequired,
  isModalContext = false,
}: {
  initialAlunoId?: string;
  onResolved?: () => void;
  onPaymentRequired?: (alunoId: string) => void;
  isModalContext?: boolean;
}) {
  const { escolaId } = useEscolaId();
  const [records, setRecords] = useState<ReclassificacaoRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [filterTipo, setFilterTipo] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Seleção em massa
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Drawer/Modal de Resolução
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [actionType, setActionType] = useState<"enroll" | "archive">("enroll");
  const [targetTurmaId, setTargetTurmaId] = useState<string>("");
  const [motivo, setMotivo] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [paymentRequired, setPaymentRequired] = useState(false);

  // Turmas disponíveis para destino
  const [turmas, setTurmas] = useState<TurmaOption[]>([]);
  const [loadingTurmas, setLoadingTurmas] = useState(false);

  // Sucesso feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchRecords = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = new URL("/api/secretaria/operacoes-academicas/reclassificacao-finalistas", window.location.origin);
      url.searchParams.set("status", "aguardando_destino");
      url.searchParams.set("limit", "200");
      if (filterTipo !== "all") {
        url.searchParams.set("tipo", filterTipo);
      }

      const res = await fetch(url.toString(), { cache: "no-store" });
      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Falha ao carregar lista de finalistas pendentes.");
      }

      setRecords(json.records || []);

      if (initialAlunoId && json.records) {
        const found = (json.records as ReclassificacaoRecord[]).filter((r) => r.aluno_id === initialAlunoId);
        if (found.length > 0) {
          setSelectedIds(new Set(found.map((r) => r.id)));
        }
      }
    } catch (err: any) {
      setError(err.message || "Erro de conexão ao procurar reclassificações.");
    } finally {
      setLoading(false);
    }
  };

  const fetchTurmas = async () => {
    if (!escolaId) return;
    setLoadingTurmas(true);
    try {
      const res = await fetch(`/api/escolas/${escolaId}/turmas`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.ok) {
        setTurmas(json.items || json.turmas || []);
      }
    } catch {
      // silencioso
    } finally {
      setLoadingTurmas(false);
    }
  };

  useEffect(() => {
    fetchRecords();
    fetchTurmas();
  }, [filterTipo, escolaId]);

  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const nome = r.aluno?.nome_completo || r.aluno?.nome || "";
      const bi = r.aluno?.bi_numero || "";
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return nome.toLowerCase().includes(q) || bi.toLowerCase().includes(q);
    });
  }, [records, searchQuery]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(new Set(filteredRecords.map((r) => r.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleToggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleOpenDrawer = (action: "enroll" | "archive", singleId?: string) => {
    if (singleId) {
      setSelectedIds(new Set([singleId]));
    }
    setActionType(action);
    setActionError(null);
    setPaymentRequired(false);
    setTargetTurmaId("");
    setMotivo("");
    setDrawerOpen(true);
  };

  const handleSubmitAction = async () => {
    if (selectedIds.size === 0) return;
    if (actionType === "enroll" && !targetTurmaId) {
      setActionError("Por favor, selecione a turma de destino para a matrícula.");
      return;
    }

    setSubmitting(true);
    setActionError(null);

    try {
      const payload = {
        action: actionType,
        reclassificacao_ids: Array.from(selectedIds),
        turma_destino_id: actionType === "enroll" ? targetTurmaId : undefined,
        motivo: motivo.trim() || undefined,
      };

      const res = await fetch("/api/secretaria/operacoes-academicas/reclassificacao-finalistas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        if (json.code === "FINALISTA_PAYMENT_REQUIRED") setPaymentRequired(true);
        throw new Error(json.error || "Falha ao processar reclassificação dos finalistas.");
      }

      const count = selectedIds.size;
      const certificados = Array.isArray(json.certificados) ? json.certificados : [];
      const certificadosComNotas = certificados.filter((item: any) => item.modo === "com_notas").length;
      const certificadosSemNotas = certificados.filter((item: any) => item.modo === "sem_notas").length;
      const certificadosPendentes = certificados.filter((item: any) => item.status === "pendente").length;
      const certificadoMsg = certificados.length > 0
        ? ` Certificados: ${certificadosComNotas} com notas, ${certificadosSemNotas} sem notas${certificadosPendentes ? `, ${certificadosPendentes} pendente(s)` : ""}.`
        : "";
      const msg = `${count} ${count === 1 ? "aluno resolvido" : "alunos resolvidos"} com sucesso.${certificadoMsg}`;
      setToastMessage(msg);
      setTimeout(() => setToastMessage(null), 4000);

      setDrawerOpen(false);
      setSelectedIds(new Set());
      await fetchRecords();

      if (onResolved) onResolved();
    } catch (err: any) {
      setActionError(err.message || "Erro inesperado ao salvar.");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedCount = selectedIds.size;
  const selectedRecords = useMemo(
    () => records.filter((r) => selectedIds.has(r.id)),
    [records, selectedIds]
  );

  return (
    <div className="space-y-6">
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-3 rounded-2xl bg-emerald-950 px-4 py-3 text-emerald-100 shadow-xl border border-emerald-800 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0" />
          <span className="text-sm font-semibold">{toastMessage}</span>
        </div>
      )}

      {!isModalContext && (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="h-10 w-10 rounded-xl bg-[#E3B23C]/10 border border-[#E3B23C]/20 flex items-center justify-center">
                <GraduationCap className="h-5 w-5 text-[#9a7010]" />
              </div>
              <h1 className="text-xl font-bold text-slate-900 font-sora">Reclassificação de Finalistas</h1>
            </div>
            <p className="text-xs text-slate-500 max-w-2xl">
              Resolva alunos que terminaram um ciclo antes de emitir novos recibos ou concluir a matrícula no próximo ano letivo.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold">
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              {records.length} {records.length === 1 ? "aluno aguardando" : "alunos aguardando"}
            </span>

            <button
              onClick={fetchRecords}
              disabled={loading}
              className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition flex items-center gap-2 text-xs font-semibold"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin text-[#1F6B3B]" : ""}`} />
              <span className="hidden md:inline">Atualizar</span>
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <button
            onClick={() => setFilterTipo("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              filterTipo === "all"
                ? "bg-slate-900 text-white"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            Todos ({records.length})
          </button>
          <button
            onClick={() => setFilterTipo("FIM_PRIMARIO")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
              filterTipo === "FIM_PRIMARIO"
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white border-slate-200 text-slate-600 hover:bg-blue-50"
            }`}
          >
            6.ª classe (Primário)
          </button>
          <button
            onClick={() => setFilterTipo("FIM_I_CICLO")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
              filterTipo === "FIM_I_CICLO"
                ? "bg-[#E3B23C] text-slate-950 border-[#E3B23C]"
                : "bg-white border-slate-200 text-slate-600 hover:bg-amber-50"
            }`}
          >
            9.ª classe (I Ciclo)
          </button>
          <button
            onClick={() => setFilterTipo("PRE_ESCOLAR")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
              filterTipo === "PRE_ESCOLAR"
                ? "bg-purple-600 text-white border-purple-600"
                : "bg-white border-slate-200 text-slate-600 hover:bg-purple-50"
            }`}
          >
            Pré-Escolar
          </button>
        </div>

        <div className="relative min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por aluno ou BI..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#1F6B3B]/20 focus:border-[#1F6B3B]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {selectedCount > 0 && (
        <div className="flex items-center justify-between p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="h-7 w-7 rounded-lg bg-[#E3B23C] text-slate-950 font-black text-xs flex items-center justify-center">
              {selectedCount}
            </span>
            <span className="text-xs font-bold">
              {selectedCount === 1 ? "1 aluno selecionado" : `${selectedCount} alunos selecionados`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleOpenDrawer("archive")}
              className="px-3.5 py-2 rounded-xl bg-white border border-amber-300 hover:bg-amber-100/50 text-slate-800 text-xs font-bold transition flex items-center gap-2"
            >
              <Archive className="h-4 w-4 text-slate-600" />
              <span>Concluir e Arquivar</span>
            </button>

            <button
              onClick={() => handleOpenDrawer("enroll")}
              className="px-4 py-2 rounded-xl bg-[#E3B23C] hover:bg-[#d8a733] text-slate-950 text-xs font-bold transition shadow-sm flex items-center gap-2"
            >
              <UserCheck className="h-4 w-4" />
              <span>Matricular no Novo Ciclo</span>
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-16 text-center text-slate-500 space-y-3">
            <Loader2 className="h-8 w-8 text-[#1F6B3B] animate-spin mx-auto" />
            <p className="text-sm font-semibold">Carregando lista de finalistas...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-700 bg-rose-50 border-b border-rose-100 flex flex-col items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-rose-600" />
            <p className="text-sm font-bold">{error}</p>
            <button
              onClick={fetchRecords}
              className="mt-2 px-3 py-1.5 rounded-xl bg-white border border-rose-200 text-xs font-bold text-rose-800 hover:bg-rose-100"
            >
              Tentar novamente
            </button>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="p-16 text-center text-slate-500 space-y-2">
            <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto opacity-80" />
            <h3 className="text-base font-bold text-slate-800">Nenhum finalista pendente</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Todos os alunos que terminaram o ciclo primário ou secundário já foram reclassificados com sucesso.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="p-4 w-10">
                    <input
                      type="checkbox"
                      checked={selectedCount > 0 && selectedCount === filteredRecords.length}
                      onChange={handleSelectAll}
                      className="h-4 w-4 rounded border-slate-300 text-[#1F6B3B] focus:ring-[#1F6B3B]"
                    />
                  </th>
                  <th className="p-4">Aluno</th>
                  <th className="p-4">Origem Académica</th>
                  <th className="p-4">Tipo de Finalista</th>
                  <th className="p-4">Estado</th>
                  <th className="p-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecords.map((record) => {
                  const isSelected = selectedIds.has(record.id);
                  const alunoNome = record.aluno?.nome_completo || record.aluno?.nome || "Aluno sem nome";
                  const bi = record.aluno?.bi_numero;
                  const tipoConfig = TIPO_LABELS[record.tipo] || {
                    label: record.tipo,
                    badgeCls: "bg-slate-100 text-slate-700 border-slate-200",
                  };

                  return (
                    <tr
                      key={record.id}
                      className={`hover:bg-slate-50/70 transition ${
                        isSelected ? "bg-amber-50/40" : ""
                      }`}
                    >
                      <td className="p-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(record.id)}
                          className="h-4 w-4 rounded border-slate-300 text-[#1F6B3B] focus:ring-[#1F6B3B]"
                        />
                      </td>
                      <td className="p-4">
                        <p className="font-bold text-slate-900 text-sm">{alunoNome}</p>
                        {bi && <p className="text-[11px] text-slate-400 font-mono">BI: {bi}</p>}
                      </td>
                      <td className="p-4">
                        <p className="font-semibold text-slate-700">
                          {record.origem_turma?.nome || "Turma de origem"}
                        </p>
                        {record.matricula?.ano_letivo && (
                          <p className="text-[10px] text-slate-400">Ano: {record.matricula.ano_letivo}</p>
                        )}
                      </td>
                      <td className="p-4">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${tipoConfig.badgeCls}`}
                        >
                          {tipoConfig.label}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold text-amber-800">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                          Aguardando destino
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleOpenDrawer("enroll", record.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 font-bold transition text-xs shadow-2xs"
                        >
                          <span>Resolver</span>
                          <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-lg bg-white h-full shadow-2xl border-l border-slate-200 flex flex-col justify-between">
            <div className="p-6 border-b border-slate-100 flex items-start justify-between bg-slate-50/50">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-100 border border-amber-200 text-amber-900 text-[10px] font-bold">
                    {selectedCount} {selectedCount === 1 ? "aluno selecionado" : "alunos selecionados"}
                  </span>
                  <span className="text-xs text-slate-400 font-semibold">• Reclassificação</span>
                </div>
                <h2 className="text-lg font-bold text-slate-900 font-sora">
                  {actionType === "enroll" ? "Matricular no Novo Ciclo" : "Concluir e Arquivar"}
                </h2>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Alunos em resolução ({selectedCount})
                </p>
                <div className="max-h-32 overflow-y-auto space-y-1 pr-1">
                  {selectedRecords.map((r) => (
                    <div key={r.id} className="text-xs font-semibold text-slate-800 flex justify-between">
                      <span>{r.aluno?.nome_completo || r.aluno?.nome}</span>
                      <span className="text-slate-400 text-[10px]">{r.origem_turma?.nome}</span>
                    </div>
                  ))}
                </div>
              </div>

              {actionError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-rose-600 flex-shrink-0" />
                  <span>{actionError}</span>
                </div>
              )}

              {paymentRequired && onPaymentRequired && selectedRecords[0]?.aluno_id && (
                <button
                  type="button"
                  onClick={() => onPaymentRequired(selectedRecords[0].aluno_id)}
                  className="w-full rounded-xl border border-[#E3B23C] bg-[#E3B23C]/10 px-4 py-3 text-left text-xs font-bold text-[#795b08] hover:bg-[#E3B23C]/20"
                >
                  Abrir o Balcão para pagar a taxa no ano correto
                </button>
              )}

              {actionType === "enroll" && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-900">
                      Turma de Destino <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={targetTurmaId}
                      onChange={(e) => setTargetTurmaId(e.target.value)}
                      disabled={loadingTurmas || submitting}
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-semibold text-slate-900 outline-none focus:border-[#1F6B3B] focus:ring-2 focus:ring-[#1F6B3B]/20 bg-white"
                    >
                      <option value="">-- Selecionar Turma de Destino --</option>
                      {turmas.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.nome} {t.turno ? `(${t.turno})` : ""}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-slate-400">
                      Apenas turmas do novo ano letivo e com vagas disponíveis são exibidas.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-900">
                      Observação/Motivo <span className="text-slate-400 font-normal">(opcional)</span>
                    </label>
                    <textarea
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}
                      maxLength={500}
                      rows={3}
                      placeholder="Ex: Escolha de curso confirmada pela encarregada..."
                      className="w-full rounded-xl border border-slate-200 p-3 text-xs text-slate-900 outline-none focus:border-[#1F6B3B] focus:ring-2 focus:ring-[#1F6B3B]/20 bg-white resize-none"
                    />
                  </div>
                </div>
              )}

              {actionType === "archive" && (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-2">
                    <div className="flex items-center gap-2 font-bold text-amber-950">
                      <Info className="h-4 w-4 text-amber-700" />
                      <span>Confirmação Importante</span>
                    </div>
                    <p>
                      Estes alunos deixarão de ocupar uma vaga ativa na escola e passarão ao estado oficial de{" "}
                      <strong>“Concluído”</strong>. O sistema tentará emitir automaticamente o certificado; se as notas existirem, sairá com notas, caso contrário ficará disponível sem notas para regularização posterior.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-900">
                      Motivo da Conclusão/Saída <span className="text-slate-400 font-normal">(opcional)</span>
                    </label>
                    <select
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-semibold text-slate-900 outline-none focus:border-[#1F6B3B] bg-white"
                    >
                      <option value="">Concluiu o percurso da escola</option>
                      <option value="Transferência para outra instituição">Transferência para outra instituição</option>
                      <option value="Não continuará no próximo ano">Não continuará no próximo ano</option>
                      <option value="Outro motivo auditado">Outro motivo auditado</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-3">
              <button
                onClick={() => setDrawerOpen(false)}
                disabled={submitting}
                className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition"
              >
                Cancelar
              </button>

              <button
                onClick={handleSubmitAction}
                disabled={submitting || (actionType === "enroll" && !targetTurmaId)}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-2 disabled:opacity-50 ${
                  actionType === "enroll"
                    ? "bg-[#E3B23C] hover:bg-[#d8a733] text-slate-950"
                    : "bg-slate-900 hover:bg-slate-800 text-white"
                }`}
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>
                  {submitting
                    ? "Salvando..."
                    : actionType === "enroll"
                    ? "Confirmar Matrícula no Novo Ciclo"
                    : "Confirmar Conclusão"}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function ReceiptBlockReclassificacaoModal({
  open,
  alunoId,
  onClose,
  onResolved,
}: {
  open: boolean;
  alunoId?: string;
  onClose: () => void;
  onResolved: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 bg-amber-50 border-b border-amber-200 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500/20 border border-amber-300 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-amber-900" />
            </div>
            <div>
              <h2 className="text-base font-bold text-amber-950 font-sora">Ação Necessária: Aluno Aguardando Destino</h2>
              <p className="text-xs text-amber-800">
                Este aluno concluiu um ciclo lectivo e necessita de definição de destino antes de emitir recibo.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-amber-800 hover:bg-amber-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <ReclassificacaoFinalistasClient initialAlunoId={alunoId} onResolved={onResolved} isModalContext />
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-xs font-bold text-slate-700"
          >
            Fechar e Resolver Depois
          </button>
        </div>
      </div>
    </div>
  );
}
