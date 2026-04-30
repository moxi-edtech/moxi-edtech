"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Calendar,
  CheckCircle2,
  CreditCard,
  Loader2,
  Mail,
  Printer,
  Search,
  UserCheck,
  UserPlus,
} from "lucide-react";
import { toast } from "@/lib/toast";

type CohortOption = {
  id: string;
  codigo: string | null;
  nome: string;
  curso_nome: string;
  vagas: number | null;
  data_inicio: string | null;
  data_fim: string | null;
  status: string;
  valor_referencia: number;
  moeda: string;
};

type Candidate = {
  user_id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  bi_numero: string | null;
  label?: string;
};

type LookupState = {
  loading: boolean;
  candidates: Candidate[];
  error: string | null;
};

type Receipt = {
  referencia: string | null;
  total: number;
  aluno: {
    nome: string;
    email: string;
    bi_numero: string;
    telefone: string;
  };
  parcelas: Array<{
    referencia: string;
    vencimento_em: string;
    valor: number;
    descricao: string;
  }>;
};

type SubmitResult = {
  ok: boolean;
  inscricao?: { id?: string };
  cobrancas?: unknown[];
  receipt?: Receipt;
  credentials?: {
    email: string;
    temporary_password?: string;
  } | null;
};

type Step = "form" | "confirm" | "success";
type PaymentMode = "avista" | "parcelado" | "sem_cobranca";

const todayIso = new Date().toISOString().split("T")[0];

function formatCurrency(value: number, currency = "AOA") {
  return new Intl.NumberFormat("pt-AO", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));
}

function splitInstallments(total: number, count: number, firstDueDate: string) {
  const safeCount = Math.max(1, count);
  const base = Math.floor(total / safeCount);
  const remainder = total - base * safeCount;
  const firstDue = firstDueDate ? new Date(`${firstDueDate}T00:00:00`) : new Date();

  return Array.from({ length: safeCount }, (_, index) => {
    const due = new Date(firstDue);
    due.setMonth(firstDue.getMonth() + index);
    return {
      descricao: `Parcela ${index + 1}/${safeCount}`,
      valor: index === safeCount - 1 ? base + remainder : base,
      vencimento_em: due.toISOString().split("T")[0],
    };
  });
}

export function InscricaoDiretaClient() {
  const [step, setStep] = useState<Step>("form");
  const [loading, setLoading] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [cohorts, setCohorts] = useState<CohortOption[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [lookup, setLookup] = useState<LookupState>({ loading: false, candidates: [], error: null });
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("avista");
  const [parcelasCount, setParcelasCount] = useState(2);
  const [form, setForm] = useState({
    cohort_id: "",
    nome: "",
    email: "",
    bi_numero: "",
    telefone: "",
    modalidade: "presencial" as "presencial" | "online_live",
    valor_cobrado: "",
    vencimento_em: todayIso,
    reenviar_acesso: true,
  });

  useEffect(() => {
    async function loadOptions() {
      try {
        const res = await fetch("/api/formacao/secretaria/inscricoes?purpose=options", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok || !json?.ok || !Array.isArray(json.items)) {
          throw new Error(json?.error || "Falha ao carregar turmas");
        }
        setCohorts(json.items);
      } catch (error) {
        toast({
          title: "Erro ao carregar turmas",
          description: error instanceof Error ? error.message : "Tente novamente.",
          variant: "destructive",
        });
      } finally {
        setLoadingOptions(false);
      }
    }
    loadOptions();
  }, []);

  const selectedCohort = useMemo(
    () => cohorts.find((cohort) => cohort.id === form.cohort_id) ?? null,
    [cohorts, form.cohort_id]
  );

  const valorCobrado = Number(form.valor_cobrado || 0);
  const parcelas = useMemo(() => {
    if (paymentMode === "sem_cobranca" || valorCobrado <= 0) return [];
    if (paymentMode === "avista") {
      return [
        {
          descricao: `Inscrição - ${selectedCohort?.curso_nome ?? "Curso"}`,
          valor: valorCobrado,
          vencimento_em: form.vencimento_em,
        },
      ];
    }
    return splitInstallments(valorCobrado, parcelasCount, form.vencimento_em);
  }, [form.vencimento_em, parcelasCount, paymentMode, selectedCohort?.curso_nome, valorCobrado]);

  useEffect(() => {
    if (!selectedCohort) return;
    if (!form.valor_cobrado || Number(form.valor_cobrado) === 0) {
      setForm((current) => ({
        ...current,
        valor_cobrado: String(Number(selectedCohort.valor_referencia ?? 0)),
      }));
    }
  }, [selectedCohort, form.valor_cobrado]);

  useEffect(() => {
    const email = form.email.trim();
    const bi = form.bi_numero.trim();
    const telefone = form.telefone.trim();
    const canLookup = email.length >= 5 || bi.length >= 6 || telefone.length >= 6;

    setSelectedCandidate(null);
    if (!canLookup) {
      setLookup({ loading: false, candidates: [], error: null });
      return;
    }

    const timer = window.setTimeout(async () => {
      setLookup((current) => ({ ...current, loading: true, error: null }));
      const params = new URLSearchParams({ purpose: "lookup" });
      if (email) params.set("email", email);
      if (bi) params.set("bi_numero", bi);
      if (telefone) params.set("telefone", telefone);

      try {
        const res = await fetch(`/api/formacao/secretaria/inscricoes?${params.toString()}`, { cache: "no-store" });
        const json = await res.json();
        if (!res.ok || !json?.ok) throw new Error(json?.error || "Falha ao verificar duplicados");
        setLookup({ loading: false, candidates: Array.isArray(json.candidates) ? json.candidates : [], error: null });
      } catch (error) {
        setLookup({
          loading: false,
          candidates: [],
          error: error instanceof Error ? error.message : "Falha ao verificar duplicados",
        });
      }
    }, 350);

    return () => window.clearTimeout(timer);
  }, [form.bi_numero, form.email, form.telefone]);

  function applyCohort(cohortId: string) {
    const cohort = cohorts.find((item) => item.id === cohortId);
    setForm((current) => ({
      ...current,
      cohort_id: cohortId,
      valor_cobrado: cohort ? String(Number(cohort.valor_referencia ?? 0)) : current.valor_cobrado,
    }));
  }

  function validateBeforeConfirm() {
    if (!form.cohort_id) return "Selecione uma turma.";
    if (!form.nome.trim()) return "Informe o nome completo.";
    if (!form.bi_numero.trim()) return "Informe o número do BI.";
    if (!form.email.trim()) return "Informe o email.";
    if (paymentMode !== "sem_cobranca" && valorCobrado <= 0) return "Informe um valor a cobrar.";
    if (paymentMode !== "sem_cobranca" && parcelas.some((parcela) => !parcela.vencimento_em || parcela.valor <= 0)) {
      return "Revise as parcelas.";
    }
    return null;
  }

  function goToConfirmation() {
    const validation = validateBeforeConfirm();
    if (validation) {
      toast({ title: "Revise o formulário", description: validation, variant: "destructive" });
      return;
    }
    setStep("confirm");
  }

  async function handleSubmit(selectedUserId?: string) {
    setLoading(true);
    try {
      const criarCobranca = paymentMode !== "sem_cobranca" && valorCobrado > 0;
      const res = await fetch("/api/formacao/secretaria/inscricoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          formando_user_id: selectedUserId ?? selectedCandidate?.user_id,
          valor_cobrado: valorCobrado,
          origem: "balcao",
          criar_cobranca: criarCobranca,
          parcelas: criarCobranca ? parcelas : [],
          descricao_cobranca: `Inscrição - ${selectedCohort?.curso_nome ?? "Curso"}`,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        if (json.code === "FORMANDO_RESOLUTION_REQUIRED") {
          setLookup({ loading: false, candidates: json.resolution?.candidates ?? [], error: null });
          setStep("form");
          toast({ title: "Perfil duplicado", description: "Selecione o formando correto antes de continuar." });
          return;
        }
        throw new Error(json.error || "Falha na inscrição");
      }

      setResult(json);
      setStep("success");
      toast({ title: "Inscrição concluída", description: "Balcão finalizado com sucesso." });
    } catch (error) {
      toast({
        title: "Erro na inscrição",
        description: error instanceof Error ? error.message : "Falha na inscrição",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setStep("form");
    setSelectedCandidate(null);
    setLookup({ loading: false, candidates: [], error: null });
    setResult(null);
    setPaymentMode("avista");
    setParcelasCount(2);
    setForm({
      cohort_id: "",
      nome: "",
      email: "",
      bi_numero: "",
      telefone: "",
      modalidade: "presencial",
      valor_cobrado: "",
      vencimento_em: todayIso,
      reenviar_acesso: true,
    });
  }

  return (
    <div className="space-y-6 pb-12">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">secretaria</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Balcão de Inscrição</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
              Registo direto com verificação de duplicados, preço sugerido, cobrança parcelada e comprovante de atendimento.
            </p>
          </div>
          <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
            {step === "form" ? "1. Dados" : step === "confirm" ? "2. Confirmação" : "3. Concluído"}
          </div>
        </div>
      </header>

      {step === "success" && result?.receipt ? (
        <SuccessPanel receipt={result.receipt} credentials={result.credentials ?? null} onPrint={() => window.print()} onNew={resetForm} />
      ) : null}

      {step === "confirm" ? (
        <ConfirmationPanel
          form={form}
          cohort={selectedCohort}
          candidate={selectedCandidate}
          paymentMode={paymentMode}
          parcelas={parcelas}
          total={valorCobrado}
          loading={loading}
          onBack={() => setStep("form")}
          onConfirm={() => handleSubmit()}
        />
      ) : null}

      {step === "form" ? (
        <main className="grid gap-5 xl:grid-cols-[1fr_380px]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                goToConfirmation();
              }}
              className="space-y-5"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Turma / Cohort">
                  <div className="relative">
                    <select
                      required
                      value={form.cohort_id}
                      onChange={(event) => applyCohort(event.target.value)}
                      className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 pr-10 text-sm font-semibold outline-none transition-colors focus:border-klasse-green focus:bg-white disabled:opacity-50"
                      disabled={loadingOptions}
                    >
                      <option value="">Selecione uma turma ativa...</option>
                      {cohorts.map((cohort) => (
                        <option key={cohort.id} value={cohort.id}>
                          {cohort.nome} - {cohort.curso_nome}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                      {loadingOptions ? <Loader2 size={18} className="animate-spin" /> : <Calendar size={18} />}
                    </div>
                  </div>
                </Field>

                <Field label="Modalidade">
                  <select
                    value={form.modalidade}
                    onChange={(event) => setForm({ ...form, modalidade: event.target.value as "presencial" | "online_live" })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-klasse-green focus:bg-white"
                  >
                    <option value="presencial">Presencial</option>
                    <option value="online_live">Online live</option>
                  </select>
                </Field>
              </div>

              {selectedCohort ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                  <div className="flex flex-wrap items-center gap-2 font-semibold">
                    <GraduationSummary cohort={selectedCohort} />
                  </div>
                  <p className="mt-1 text-xs text-emerald-700">
                    Preço sugerido: {formatCurrency(selectedCohort.valor_referencia, selectedCohort.moeda)}
                  </p>
                </div>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Nome completo">
                  <input
                    required
                    value={form.nome}
                    onChange={(event) => setForm({ ...form, nome: event.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-klasse-green focus:bg-white"
                    placeholder="Ex: João Silva"
                  />
                </Field>
                <Field label="Nº do BI">
                  <input
                    required
                    value={form.bi_numero}
                    onChange={(event) => setForm({ ...form, bi_numero: event.target.value.toUpperCase() })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-sm font-semibold outline-none focus:border-klasse-green focus:bg-white"
                    placeholder="000000000LA000"
                  />
                </Field>
                <Field label="Email">
                  <input
                    required
                    type="email"
                    value={form.email}
                    onChange={(event) => setForm({ ...form, email: event.target.value.toLowerCase() })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-klasse-green focus:bg-white"
                    placeholder="email@exemplo.com"
                  />
                </Field>
                <Field label="Telefone">
                  <input
                    value={form.telefone}
                    onChange={(event) => setForm({ ...form, telefone: event.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-klasse-green focus:bg-white"
                    placeholder="900 000 000"
                  />
                </Field>
              </div>

              <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">Cobrança</p>
                    <p className="mt-1 text-xs text-slate-500">Defina a cobrança antes de finalizar a inscrição.</p>
                  </div>
                  <CreditCard size={20} className="text-slate-500" />
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <ModeButton active={paymentMode === "avista"} title="À vista" onClick={() => setPaymentMode("avista")} />
                  <ModeButton active={paymentMode === "parcelado"} title="Parcelado" onClick={() => setPaymentMode("parcelado")} />
                  <ModeButton active={paymentMode === "sem_cobranca"} title="Sem cobrança" onClick={() => setPaymentMode("sem_cobranca")} />
                </div>

                {paymentMode !== "sem_cobranca" ? (
                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    <Field label="Valor total">
                      <input
                        type="number"
                        min={0}
                        value={form.valor_cobrado}
                        onChange={(event) => setForm({ ...form, valor_cobrado: event.target.value })}
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-klasse-green"
                      />
                    </Field>
                    <Field label="Primeiro vencimento">
                      <input
                        type="date"
                        value={form.vencimento_em}
                        onChange={(event) => setForm({ ...form, vencimento_em: event.target.value })}
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-klasse-green"
                      />
                    </Field>
                    {paymentMode === "parcelado" ? (
                      <Field label="Parcelas">
                        <select
                          value={parcelasCount}
                          onChange={(event) => setParcelasCount(Number(event.target.value))}
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-klasse-green"
                        >
                          {[2, 3, 4, 5, 6].map((count) => (
                            <option key={count} value={count}>
                              {count} parcelas
                            </option>
                          ))}
                        </select>
                      </Field>
                    ) : null}
                  </div>
                ) : null}

                {parcelas.length > 0 ? (
                  <div className="mt-4 divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
                    {parcelas.map((parcela) => (
                      <div key={`${parcela.descricao}-${parcela.vencimento_em}`} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                        <span className="font-medium text-slate-700">{parcela.descricao}</span>
                        <span className="text-slate-500">{parcela.vencimento_em}</span>
                        <span className="font-semibold text-slate-950">{formatCurrency(parcela.valor)}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </section>

              <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={form.reenviar_acesso}
                  onChange={(event) => setForm({ ...form, reenviar_acesso: event.target.checked })}
                  className="h-5 w-5 rounded border-slate-300 text-klasse-green focus:ring-klasse-green"
                />
                Enviar acesso ao formando automaticamente após finalizar
              </label>

              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-klasse-green px-5 py-4 text-sm font-semibold text-white hover:bg-klasse-green/90 disabled:opacity-50"
              >
                Rever e confirmar <ArrowRight size={18} />
              </button>
            </form>
          </section>

          <aside className="space-y-4">
            <DuplicatePanel lookup={lookup} selectedCandidate={selectedCandidate} onSelect={setSelectedCandidate} />
            <FinanceStatePanel paymentMode={paymentMode} total={valorCobrado} parcelas={parcelas} />
          </aside>
        </main>
      ) : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="ml-1 text-[11px] font-semibold uppercase tracking-widest text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function ModeButton({ active, title, onClick }: { active: boolean; title: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
        active ? "border-klasse-green bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-600"
      }`}
    >
      {title}
    </button>
  );
}

function DuplicatePanel({
  lookup,
  selectedCandidate,
  onSelect,
}: {
  lookup: LookupState;
  selectedCandidate: Candidate | null;
  onSelect: (candidate: Candidate | null) => void;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-950">Duplicados</p>
          <p className="mt-1 text-xs text-slate-500">Verificação automática por email, BI e telefone.</p>
        </div>
        {lookup.loading ? <Loader2 size={18} className="animate-spin text-slate-500" /> : <Search size={18} className="text-slate-500" />}
      </div>

      {lookup.error ? (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{lookup.error}</div>
      ) : null}

      {!lookup.loading && lookup.candidates.length === 0 && !lookup.error ? (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          Nenhum perfil compatível encontrado.
        </div>
      ) : null}

      {lookup.candidates.length > 0 ? (
        <div className="mt-4 space-y-2">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Existe perfil compatível. Selecione para associar e evitar duplicidade.
          </div>
          {lookup.candidates.map((candidate) => {
            const active = selectedCandidate?.user_id === candidate.user_id;
            return (
              <button
                key={candidate.user_id}
                type="button"
                onClick={() => onSelect(active ? null : candidate)}
                className={`w-full rounded-xl border p-3 text-left transition-colors ${
                  active ? "border-klasse-green bg-emerald-50" : "border-slate-200 bg-slate-50 hover:bg-white"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-semibold text-slate-950">{candidate.nome}</p>
                  {active ? <UserCheck size={16} className="text-emerald-700" /> : null}
                </div>
                <p className="mt-1 truncate text-xs text-slate-500">{candidate.label ?? candidate.email ?? candidate.telefone ?? candidate.bi_numero}</p>
              </button>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

function FinanceStatePanel({
  paymentMode,
  total,
  parcelas,
}: {
  paymentMode: PaymentMode;
  total: number;
  parcelas: Array<{ valor: number; vencimento_em: string; descricao: string }>;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-semibold text-slate-950">Estado financeiro</p>
      <div className="mt-4 grid gap-3">
        <StatusLine label="Modo" value={paymentMode === "sem_cobranca" ? "Sem cobrança" : paymentMode === "parcelado" ? "Parcelado" : "À vista"} />
        <StatusLine label="Total" value={paymentMode === "sem_cobranca" ? "AOA 0" : formatCurrency(total)} />
        <StatusLine label="Títulos" value={String(parcelas.length)} />
      </div>
      <p className="mt-4 text-xs leading-5 text-slate-500">
        Ao finalizar, o sistema cria a inscrição e emite os títulos financeiros correspondentes às parcelas configuradas.
      </p>
    </section>
  );
}

function StatusLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-950">{value}</span>
    </div>
  );
}

function ConfirmationPanel({
  form,
  cohort,
  candidate,
  paymentMode,
  parcelas,
  total,
  loading,
  onBack,
  onConfirm,
}: {
  form: {
    nome: string;
    email: string;
    bi_numero: string;
    telefone: string;
    modalidade: string;
    reenviar_acesso: boolean;
  };
  cohort: CohortOption | null;
  candidate: Candidate | null;
  paymentMode: PaymentMode;
  parcelas: Array<{ descricao: string; valor: number; vencimento_em: string }>;
  total: number;
  loading: boolean;
  onBack: () => void;
  onConfirm: () => void;
}) {
  return (
    <main className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Confirmar inscrição</h2>
          <p className="mt-1 text-sm text-slate-500">Revise dados, cobrança e envio de acesso antes de gravar.</p>
        </div>
        <AlertCircle size={22} className="text-amber-600" />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <SummaryCard title="Formando">
          <p className="font-semibold text-slate-950">{form.nome}</p>
          <p>{form.email}</p>
          <p>BI: {form.bi_numero}</p>
          {form.telefone ? <p>Tel: {form.telefone}</p> : null}
          <p className="mt-2 font-semibold text-slate-700">
            {candidate ? `Associado a perfil existente: ${candidate.nome}` : "Novo perfil será criado se necessário"}
          </p>
        </SummaryCard>
        <SummaryCard title="Turma">
          <p className="font-semibold text-slate-950">{cohort?.nome ?? "Turma"}</p>
          <p>{cohort?.curso_nome ?? "Curso"}</p>
          <p>Modalidade: {form.modalidade}</p>
          <p>Início: {cohort?.data_inicio ?? "-"}</p>
        </SummaryCard>
        <SummaryCard title="Financeiro">
          <p className="font-semibold text-slate-950">
            {paymentMode === "sem_cobranca" ? "Sem cobrança" : `${parcelas.length} título(s) - ${formatCurrency(total)}`}
          </p>
          {parcelas.map((parcela) => (
            <p key={parcela.descricao}>
              {parcela.descricao}: {formatCurrency(parcela.valor)} em {parcela.vencimento_em}
            </p>
          ))}
          <p className="mt-2 font-semibold text-slate-700">
            {form.reenviar_acesso ? "Acesso será enviado automaticamente" : "Acesso não será enviado automaticamente"}
          </p>
        </SummaryCard>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft size={16} />
          Voltar
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl bg-klasse-green px-5 py-3 text-sm font-semibold text-white hover:bg-klasse-green/90 disabled:opacity-50"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
          Finalizar inscrição
        </button>
      </div>
    </main>
  );
}

function SummaryCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
      <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">{title}</p>
      {children}
    </section>
  );
}

function SuccessPanel({
  receipt,
  credentials,
  onPrint,
  onNew,
}: {
  receipt: Receipt;
  credentials: SubmitResult["credentials"];
  onPrint: () => void;
  onNew: () => void;
}) {
  return (
    <main className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm print:shadow-none">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-emerald-700">
            <CheckCircle2 size={22} />
            <h2 className="text-lg font-semibold">Inscrição finalizada</h2>
          </div>
          <p className="mt-1 text-sm text-slate-500">Comprovante de atendimento gerado pelo balcão.</p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <button
            type="button"
            onClick={onPrint}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Printer size={16} />
            Imprimir
          </button>
          <button
            type="button"
            onClick={onNew}
            className="inline-flex items-center gap-2 rounded-xl bg-klasse-green px-4 py-2 text-sm font-semibold text-white hover:bg-klasse-green/90"
          >
            <UserPlus size={16} />
            Nova inscrição
          </button>
        </div>
      </div>

      <section className="mt-5 rounded-xl border border-slate-200 p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Formando</p>
            <p className="mt-2 text-base font-semibold text-slate-950">{receipt.aluno.nome}</p>
            <p className="text-sm text-slate-600">{receipt.aluno.email}</p>
            <p className="text-sm text-slate-600">BI: {receipt.aluno.bi_numero}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Cobrança</p>
            <p className="mt-2 text-base font-semibold text-slate-950">{formatCurrency(receipt.total)}</p>
            <p className="text-sm text-slate-600">Referência inicial: {receipt.referencia ?? "-"}</p>
          </div>
        </div>

        {receipt.parcelas.length > 0 ? (
          <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
            {receipt.parcelas.map((parcela) => (
              <div key={parcela.referencia} className="grid gap-2 border-b border-slate-100 px-4 py-3 text-sm last:border-0 md:grid-cols-4">
                <span className="font-semibold text-slate-950">{parcela.descricao}</span>
                <span className="text-slate-600">{parcela.referencia}</span>
                <span className="text-slate-600">{parcela.vencimento_em}</span>
                <span className="font-semibold text-slate-950">{formatCurrency(parcela.valor)}</span>
              </div>
            ))}
          </div>
        ) : null}

        <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
          <div className="flex items-start gap-3">
            <Mail size={18} className="mt-0.5 shrink-0" />
            <p>
              {credentials?.temporary_password
                ? `Credenciais enviadas para ${credentials.email}. Senha temporária: ${credentials.temporary_password}`
                : "Acesso enviado ao formando quando solicitado. Para usuário existente, o email indica o login já cadastrado."}
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

function GraduationSummary({ cohort }: { cohort: CohortOption }) {
  return (
    <>
      <span>{cohort.nome}</span>
      <span className="text-emerald-700">·</span>
      <span>{cohort.curso_nome}</span>
      <span className="text-emerald-700">·</span>
      <span>{cohort.status}</span>
    </>
  );
}
