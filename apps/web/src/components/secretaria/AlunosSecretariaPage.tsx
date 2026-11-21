"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { StatusPill as StatusBadge } from "@/components/ui/StatusPill";
import { useToast } from "@/components/feedback/FeedbackSystem";
import { formatTurmaDisplayName } from "@/utils/formatters";
import { ACADEMIC_YEAR_PARAM } from "@/lib/academic-year/context";
import { OperationalCursorPagination, OperationalTableEmptyState, OperationalTableErrorState } from "@/components/ui/OperationalTableStates";
import {
  AlertCircle,
  Archive,
  ArrowUpDown,
  Banknote,
  CheckCircle2,
  Clock,
  CreditCard,
  DollarSign,
  Download,
  Eye,
  FileCheck,
  Loader2,
  Mail,
  Minus,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Receipt,
  Search,
  SlidersHorizontal,
  Slash,
  Smartphone,
  UserCheck,
  X,
} from "lucide-react";

type TabStatus = "leads" | "ativos" | "inadimplentes" | "inativos" | "arquivados";
type SituacaoFinanceira = "em_dia" | "em_atraso" | "sem_registo";
type MetodoPagamento = "numerario" | "transferencia" | "multicaixa" | "referencia";

type Aluno = {
  id: string;
  nome: string;
  email?: string | null;
  responsavel?: string | null;
  telefone_responsavel?: string | null;
  status?: string | null;
  created_at: string;
  numero_processo_login?: string | null;
  numero_processo?: string | null;
  origem?: "aluno" | "candidatura" | null;
  candidatura_id?: string | null;
  situacao_financeira?: SituacaoFinanceira;
  meses_atraso?: number;
  valor_em_divida?: number;
};

type Cursor = { created_at: string; id: string };

type ApiResponse = {
  ok: boolean;
  items: Aluno[];
  total?: number;
  page?: { hasMore?: boolean; nextCursor?: Cursor | null };
  error?: string;
};

type AlunoDetail = {
  id: string;
  nome?: string | null;
  email?: string | null;
  telefone?: string | null;
  status?: string | null;
  numero_processo_login?: string | null;
  turma_id?: string | null;
  turma_nome?: string | null;
  turma_curso?: string | null;
  data_nascimento?: string | null;
  sexo?: string | null;
  bi_numero?: string | null;
  tipo_documento?: string | null;
  numero_documento?: string | null;
  naturalidade?: string | null;
  provincia?: string | null;
  pai_nome?: string | null;
  mae_nome?: string | null;
  nif?: string | null;
  endereco?: string | null;
  responsavel?: string | null;
  telefone_responsavel?: string | null;
  encarregado_email?: string | null;
  encarregado_relacao?: string | null;
  responsavel_financeiro_nome?: string | null;
  responsavel_financeiro_nif?: string | null;
  mesmo_que_encarregado?: boolean | null;
  documentos?: Record<string, string> | null;
  campos_extras?: Record<string, unknown> | null;
};

type OfflineMeta = { fromCache: boolean; updatedAt: string | null };
type Filters = { ano: string; turmaId: string };
type TurmaOption = { id: string; nome: string; ano_letivo?: number | null };

function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

type BreadcrumbItem = { label: string; href?: string };

function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="breadcrumb">
      <ol className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
        {items.map((item, index) => (
          <li key={index} className="flex items-center gap-1">
            {index > 0 && <Slash size={10} className="text-muted-foreground" />}
            {item.href ? (
              <Link href={item.href} className="hover:text-klasse-green transition-colors">
                {item.label}
              </Link>
            ) : (
              <span className="text-muted-foreground">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

type TabDef = {
  id: TabStatus;
  label: string;
  icon: React.ReactNode;
  color: string;
};

const TABS: TabDef[] = [
  { id: "leads", label: "Leads", icon: <Clock size={13} />, color: "bg-amber-100 text-amber-800" },
  {
    id: "ativos",
    label: "Activos",
    icon: <UserCheck size={13} />,
    color: "bg-klasse-green/10 text-klasse-green",
  },
  {
    id: "inadimplentes",
    label: "Inadimplentes",
    icon: <DollarSign size={13} />,
    color: "bg-rose-100 text-rose-600",
  },
  {
    id: "inativos",
    label: "Inativos",
    icon: <AlertCircle size={13} />,
    color: "bg-muted text-muted-foreground",
  },
  {
    id: "arquivados",
    label: "Arquivados",
    icon: <Archive size={13} />,
    color: "bg-rose-100 text-rose-600",
  },
];

function TabBar({
  active,
  onChange,
}: {
  active: TabStatus;
  onChange: (tab: TabStatus) => void;
}) {
  return (
    <div className="-mb-px flex min-w-0 items-center gap-1 overflow-x-auto border-b border-border">
      {TABS.map((tab) => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(tab.id)}
            className={[
              "inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-klasse-gold/20",
              isActive
                ? "border-klasse-green text-klasse-green"
                : "border-transparent text-muted-foreground hover:text-muted-foreground hover:border-border",
            ].join(" ")}
          >
            {tab.icon}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}


function formatKz(valor?: number) {
  if (!valor) return null;
  return new Intl.NumberFormat("pt-AO", { style: "currency", currency: "AOA", maximumFractionDigits: 0 })
    .format(valor);
}

function SituacaoFinanceiraChip({ situacao, meses, valor }: {
  situacao: SituacaoFinanceira;
  meses?: number;
  valor?: number;
}) {
  if (situacao === "em_dia") return (
    <span className="inline-flex items-center gap-1 rounded-full bg-klasse-green/10
      px-2.5 py-1 text-[11px] font-bold text-klasse-green">
      <CheckCircle2 size={10} /> Em dia
    </span>
  );

  if (situacao === "em_atraso") return (
    <div>
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-100
        px-2.5 py-1 text-[11px] font-bold text-rose-700">
        <AlertCircle size={10} />
        {meses ? `${meses} ${meses === 1 ? "mês" : "meses"}` : "Em atraso"}
      </span>
      {valor ? (
        <p className="text-[10px] text-rose-500 mt-0.5 font-semibold">{formatKz(valor)}</p>
      ) : null}
    </div>
  );

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted
      px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
      <Minus size={10} /> Sem registo
    </span>
  );
}

function RowActions({
  aluno,
  secretariaBase,
  onArchive,
  onView,
  onPagamento,
}: {
  aluno: Aluno;
  secretariaBase: string;
  onArchive: (a: Aluno) => void;
  onView: (a: Aluno) => void;
  onPagamento: (a: Aluno) => void;
}) {
  const isLead = aluno.origem === "candidatura";
  const matriculaHref =
    isLead && aluno.candidatura_id
      ? `${secretariaBase}/admissoes/nova?candidaturaId=${aluno.candidatura_id}`
      : !isLead
        ? `${secretariaBase}/admissoes/nova?alunoId=${aluno.id}`
        : null;

  return (
    <div className="flex items-center justify-end gap-1 opacity-100 transition-opacity lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100">
      {!isLead && (
        <button
          type="button"
          onClick={() => onView(aluno)}
          title="Ver perfil"
          className="flex items-center gap-1 rounded-xl border border-border px-2 py-1.5 text-xs font-semibold text-muted-foreground hover:border-klasse-green hover:text-klasse-green transition-colors"
        >
          <Eye size={12} />
        </button>
      )}

      {!isLead && (
        <Link
          href={`${secretariaBase}/alunos/${aluno.id}/editar`}
          title="Editar"
          className="flex items-center gap-1 rounded-xl border border-border px-2 py-1.5 text-xs font-semibold text-muted-foreground hover:border-border hover:text-foreground transition-colors"
        >
          <Pencil size={12} />
        </Link>
      )}

      {matriculaHref && (aluno.status || "").toLowerCase() !== "ativo" && (
        <Link
          href={matriculaHref}
          title="Abrir matrícula"
          className="flex items-center gap-1.5 rounded-xl border border-klasse-gold/40 px-2 py-1.5 text-xs font-bold text-amber-800 bg-klasse-gold/5 hover:bg-klasse-gold/10 transition-colors"
        >
          <FileCheck size={12} />
          <span>Matricular</span>
        </Link>
      )}

      {!isLead && (aluno.status || "").toLowerCase() === "ativo" && (
        <button
          type="button"
          onClick={() => onPagamento(aluno)}
          title="Registar pagamento"
          className="flex items-center gap-1 rounded-xl border border-border px-2 py-1.5 text-xs font-semibold text-muted-foreground hover:border-klasse-gold hover:text-amber-800 transition-colors"
        >
          <DollarSign size={12} />
        </button>
      )}

      {!isLead && (
        <button
          onClick={() => onArchive(aluno)}
          title="Arquivar"
          className="flex items-center gap-1 rounded-xl border border-border px-2 py-1.5 text-xs font-semibold text-muted-foreground hover:border-rose-300 hover:text-rose-600 transition-colors"
        >
          <Archive size={12} />
        </button>
      )}
    </div>
  );
}

function ProfileDrawer({
  aluno,
  secretariaBase,
  onClose,
  onPagamento,
}: {
  aluno: Aluno | null;
  secretariaBase: string;
  onClose: () => void;
  onPagamento: (aluno: Aluno) => void;
}) {
  const [data, setData] = useState<AlunoDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!aluno) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const loadProfile = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/secretaria/alunos/${aluno.id}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.ok) throw new Error(json.error || "Falha ao carregar perfil.");
        setData(json.item ?? null);
      } catch (err: any) {
        if (err.name === "AbortError") return;
        setError(err.message || "Erro inesperado.");
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
    return () => controller.abort();
  }, [aluno]);

  useEffect(() => {
    if (!aluno) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [aluno, onClose]);

  const detail = data;
  const displayName = detail?.nome ?? aluno?.nome ?? "—";
  const displayStatus = detail?.status ?? aluno?.status ?? null;
  const turmaNome = detail?.turma_nome ?? null;
  const turmaCurso = detail?.turma_curso ?? null;
  const turmaId = detail?.turma_id ?? null;

  return (
    <>
      {aluno ? (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm transition-opacity opacity-100"
          onClick={onClose}
        />
      ) : null}

      {aluno ? (
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-card shadow-2xl
        border-l border-border flex flex-col transition-transform duration-300 translate-x-0">

        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <div>
            <p className="text-sm font-black text-foreground">Perfil do aluno</p>
            <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[220px]">
              {displayName}
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-muted-foreground transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 size={14} className="animate-spin" /> A carregar perfil…
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          {!loading && !error && (
            <>
              <div className="rounded-xl border border-border bg-muted/50 px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-semibold uppercase tracking-widest">Estado</p>
                    <p className="text-sm font-bold text-foreground mt-1">
                      {displayName}
                    </p>
                  </div>
                  <StatusBadge status={displayStatus} />
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Académico</p>
                <div className="grid grid-cols-1 gap-3 text-sm">
                  <div className="rounded-xl border border-border px-4 py-3">
                    <p className="text-[11px] text-muted-foreground font-semibold">Turma</p>
                    <p className="font-semibold text-foreground mt-1">{turmaNome ?? "—"}</p>
                  </div>
                  <div className="rounded-xl border border-border px-4 py-3">
                    <p className="text-[11px] text-muted-foreground font-semibold">Curso</p>
                    <p className="font-semibold text-foreground mt-1">{turmaCurso ?? "—"}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Contacto</p>
                <div className="grid grid-cols-1 gap-3 text-sm">
                  <div className="rounded-xl border border-border px-4 py-3">
                    <p className="text-[11px] text-muted-foreground font-semibold">Email</p>
                    <p className="font-semibold text-foreground mt-1">{detail?.email ?? "—"}</p>
                  </div>
                  <div className="rounded-xl border border-border px-4 py-3">
                    <p className="text-[11px] text-muted-foreground font-semibold">Telefone</p>
                    <p className="font-semibold text-foreground mt-1">{detail?.telefone ?? "—"}</p>
                  </div>
                  <div className="rounded-xl border border-border px-4 py-3">
                    <p className="text-[11px] text-muted-foreground font-semibold">Endereço</p>
                    <p className="font-semibold text-foreground mt-1">{detail?.endereco ?? "—"}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Filiação</p>
                <div className="grid grid-cols-1 gap-3 text-sm">
                  <div className="rounded-xl border border-border px-4 py-3">
                    <p className="text-[11px] text-muted-foreground font-semibold">Nome do pai</p>
                    <p className="font-semibold text-foreground mt-1">{detail?.pai_nome ?? "—"}</p>
                  </div>
                  <div className="rounded-xl border border-border px-4 py-3">
                    <p className="text-[11px] text-muted-foreground font-semibold">Nome da mãe</p>
                    <p className="font-semibold text-foreground mt-1">{detail?.mae_nome ?? "—"}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Responsável</p>
                <div className="grid grid-cols-1 gap-3 text-sm">
                  <div className="rounded-xl border border-border px-4 py-3">
                    <p className="text-[11px] text-muted-foreground font-semibold">Nome</p>
                    <p className="font-semibold text-foreground mt-1">{detail?.responsavel ?? "—"}</p>
                  </div>
                  <div className="rounded-xl border border-border px-4 py-3">
                    <p className="text-[11px] text-muted-foreground font-semibold">Telefone</p>
                    <p className="font-semibold text-foreground mt-1">{detail?.telefone_responsavel ?? "—"}</p>
                  </div>
                  <div className="rounded-xl border border-border px-4 py-3">
                    <p className="text-[11px] text-muted-foreground font-semibold">Email</p>
                    <p className="font-semibold text-foreground mt-1">{detail?.encarregado_email ?? "—"}</p>
                  </div>
                  <div className="rounded-xl border border-border px-4 py-3">
                    <p className="text-[11px] text-muted-foreground font-semibold">Relação</p>
                    <p className="font-semibold text-foreground mt-1">{detail?.encarregado_relacao ?? "—"}</p>
                  </div>
                  <div className="rounded-xl border border-border px-4 py-3">
                    <p className="text-[11px] text-muted-foreground font-semibold">Responsável financeiro</p>
                    <p className="font-semibold text-foreground mt-1">{detail?.responsavel_financeiro_nome ?? "—"}</p>
                  </div>
                  <div className="rounded-xl border border-border px-4 py-3">
                    <p className="text-[11px] text-muted-foreground font-semibold">NIF financeiro</p>
                    <p className="font-semibold text-foreground mt-1">{detail?.responsavel_financeiro_nif ?? "—"}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Documentos</p>
                <div className="grid grid-cols-1 gap-3 text-sm">
                  <div className="rounded-xl border border-border px-4 py-3">
                    <p className="text-[11px] text-muted-foreground font-semibold">Tipo</p>
                    <p className="font-semibold text-foreground mt-1">{detail?.tipo_documento ?? "—"}</p>
                  </div>
                  <div className="rounded-xl border border-border px-4 py-3">
                    <p className="text-[11px] text-muted-foreground font-semibold">Número</p>
                    <p className="font-semibold text-foreground mt-1">{detail?.numero_documento ?? detail?.bi_numero ?? "—"}</p>
                  </div>
                  <div className="rounded-xl border border-border px-4 py-3">
                    <p className="text-[11px] text-muted-foreground font-semibold">NIF</p>
                    <p className="font-semibold text-foreground mt-1">{detail?.nif ?? "—"}</p>
                  </div>
                  <div className="rounded-xl border border-border px-4 py-3">
                    <p className="text-[11px] text-muted-foreground font-semibold">Data de nascimento</p>
                    <p className="font-semibold text-foreground mt-1">
                      {detail?.data_nascimento
                        ? new Date(detail.data_nascimento).toLocaleDateString("pt-AO")
                        : "—"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border px-4 py-3">
                    <p className="text-[11px] text-muted-foreground font-semibold">Sexo</p>
                    <p className="font-semibold text-foreground mt-1">{detail?.sexo ?? "—"}</p>
                  </div>
                  <div className="rounded-xl border border-border px-4 py-3">
                    <p className="text-[11px] text-muted-foreground font-semibold">Naturalidade</p>
                    <p className="font-semibold text-foreground mt-1">{detail?.naturalidade ?? "—"}</p>
                  </div>
                  <div className="rounded-xl border border-border px-4 py-3">
                    <p className="text-[11px] text-muted-foreground font-semibold">Província</p>
                    <p className="font-semibold text-foreground mt-1">{detail?.provincia ?? "—"}</p>
                  </div>
                  <div className="rounded-xl border border-border px-4 py-3">
                    <p className="text-[11px] text-muted-foreground font-semibold">Anexos</p>
                    <p className="font-semibold text-foreground mt-1">
                      {Object.keys(detail?.documentos ?? {}).length > 0
                        ? Object.keys(detail?.documentos ?? {}).join(", ")
                        : "—"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border px-4 py-3">
                    <p className="text-[11px] text-muted-foreground font-semibold">Campos extras</p>
                    <p className="font-semibold text-foreground mt-1">
                      {Object.entries(detail?.campos_extras ?? {}).length > 0
                        ? Object.entries(detail?.campos_extras ?? {})
                            .map(([key, value]) => `${key}: ${String(value ?? "—")}`)
                            .join(", ")
                        : "—"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    href={`${secretariaBase}/alunos/${detail?.id ?? aluno?.id ?? ""}`}
                    scroll={false}
                    className="inline-flex items-center justify-center rounded-xl border border-border px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-muted/50 transition-colors"
                  >
                    Perfil completo
                  </Link>
                  <Link
                    href={`${secretariaBase}/alunos/${detail?.id ?? aluno?.id ?? ""}/editar`}
                    scroll={false}
                    className="inline-flex items-center justify-center rounded-xl border border-border px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-muted/50 transition-colors"
                  >
                    Editar
                  </Link>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => (aluno ? onPagamento(aluno) : null)}
                    disabled={!aluno || (aluno.status || "").toLowerCase() !== "ativo"}
                    className="inline-flex items-center justify-center rounded-xl border border-border px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-muted/50 transition-colors disabled:opacity-50"
                  >
                    Registar pagamento
                  </button>
                  {turmaId ? (
                    <Link
                      href={`${secretariaBase}/turmas/${turmaId}`}
                      scroll={false}
                      className="inline-flex items-center justify-center rounded-xl border border-border px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-muted/50 transition-colors"
                    >
                      Ver turma
                    </Link>
                  ) : (
                    <span className="inline-flex items-center justify-center rounded-xl border border-border px-4 py-2 text-xs font-bold text-muted-foreground">
                      Sem turma
                    </span>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      ) : null}
    </>
  );
}

function PagamentoDrawer({ aluno, onClose, onSuccess }: {
  aluno: Aluno | null;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}) {
  const { error } = useToast();
  const [valor, setValor] = useState("");
  const [metodo, setMetodo] = useState<MetodoPagamento>("numerario");
  const [ref, setRef] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (aluno) {
      setValor(aluno.valor_em_divida ? String(aluno.valor_em_divida) : "");
      setMetodo("numerario");
      setRef("");
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [aluno]);

  useEffect(() => {
    if (!aluno) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [aluno, onClose]);

  const metodos: Array<{ id: MetodoPagamento; label: string; icon: React.ReactNode }> = [
    { id: "numerario", label: "Numerário", icon: <Banknote size={14} /> },
    { id: "transferencia", label: "Transferência", icon: <ArrowUpDown size={14} /> },
    { id: "multicaixa", label: "Multicaixa", icon: <CreditCard size={14} /> },
    { id: "referencia", label: "Referência", icon: <Smartphone size={14} /> },
  ];

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!aluno || !valor || Number(valor) <= 0) return;
    setLoading(true);
    try {
      const idempotencyKey = `pag-${aluno.id}-${Date.now()}`;
      const res = await fetch(`/api/secretaria/alunos/${aluno.id}/pagamento-rapido`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          valor: Number(valor),
          metodo_pagamento: metodo,
          referencia: ref || null,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Falha ao registar pagamento.");
      onSuccess(`Pagamento registado com sucesso.`);
      onClose();
    } catch (err: any) {
      error("Erro no pagamento", "Não foi possível registar o pagamento no momento. Por favor, tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const situacao = aluno?.situacao_financeira ?? "sem_registo";

  return (
    <>
      {aluno ? (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm transition-opacity opacity-100"
          onClick={onClose}
        />
      ) : null}

      {aluno ? (
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm bg-card shadow-2xl
        border-l border-border flex flex-col transition-transform duration-300 translate-x-0">

        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-klasse-green/10">
              <Receipt size={16} className="text-klasse-green" />
            </div>
            <div>
              <p className="text-sm font-black text-foreground">Registar Pagamento</p>
              <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[180px]">
                {aluno?.nome ?? "—"}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-muted-foreground transition-colors">
            <X size={18} />
          </button>
        </div>

        {aluno && (
          <div className={`mx-5 mt-5 rounded-xl px-4 py-3
            ${situacao === "em_atraso"
              ? "bg-rose-50 border border-rose-200"
              : "bg-muted/50 border border-border"}`}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">
              Situação actual
            </p>
            <div className="flex items-center justify-between">
              <SituacaoFinanceiraChip
                situacao={situacao}
                meses={aluno.meses_atraso}
                valor={aluno.valor_em_divida}
              />
              {aluno.valor_em_divida ? (
                <span className="text-sm font-black text-rose-700">
                  {formatKz(aluno.valor_em_divida)}
                </span>
              ) : null}
            </div>
          </div>
        )}

        <form onSubmit={submit} className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          <div>
            <label className="block text-xs font-bold text-muted-foreground mb-2">
              Valor a registar (Kz) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">
                Kz
              </span>
              <input
                ref={inputRef}
                type="number"
                min="1"
                step="1"
                required
                value={valor}
                onChange={(event) => setValor(event.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-border
                  text-base font-bold focus:outline-none focus:ring-2
                  focus:ring-klasse-gold/20 focus:border-klasse-green"
                placeholder="0"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-muted-foreground mb-2">Método de pagamento</label>
            <div className="grid grid-cols-2 gap-3">
              {metodos.map((item) => {
                const active = metodo === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setMetodo(item.id)}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition-colors
                      ${active
                        ? "border-klasse-green bg-klasse-green/10 text-klasse-green"
                        : "border-border text-muted-foreground hover:bg-muted/50"}`}
                  >
                    {item.icon}
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-muted-foreground mb-2">Referência</label>
            <input
              value={ref}
              onChange={(event) => setRef(event.target.value)}
              placeholder="Opcional"
              className="w-full rounded-xl border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2
                focus:ring-klasse-gold/20 focus:border-klasse-green"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-klasse-green px-5 py-3 text-sm font-bold text-white hover:brightness-95 transition-colors disabled:opacity-50"
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            Confirmar pagamento
          </button>
        </form>
      </div>
      ) : null}
    </>
  );
}

function ArchiveModal({
  aluno,
  onClose,
  onSuccess,
}: {
  aluno: Aluno;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => textareaRef.current?.focus(), 80);
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", handler);
    };
  }, [onClose]);

  const submit = async () => {
    const trimmed = reason.trim();
    if (!trimmed) {
      setError("Motivo obrigatório.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/secretaria/alunos/${aluno.id}/delete`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: trimmed }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error || "Falha ao arquivar.");
      onSuccess(`${aluno.nome} arquivado.`);
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card rounded-2xl shadow-2xl border border-border w-full max-w-md p-6 animate-in zoom-in-95 duration-150">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="text-base font-black text-foreground">Arquivar aluno</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Confirma arquivar <span className="font-bold text-foreground">{aluno.nome}</span>?
              O histórico financeiro e académico é preservado.
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-muted-foreground flex-shrink-0">
            <X size={16} />
          </button>
        </div>

        <div>
          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">
            Motivo <span className="text-rose-500">*</span>
          </label>
          <textarea
            ref={textareaRef}
            rows={3}
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
              setError(null);
            }}
            placeholder="Ex.: transferência, desistência, duplicado…"
            className="w-full rounded-xl border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-klasse-gold/20 focus:border-klasse-green resize-none"
          />
          {error && (
            <p className="text-xs text-rose-500 font-semibold mt-1.5 flex items-center gap-1">
              <AlertCircle size={11} /> {error}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-5">
          <button
            onClick={onClose}
            disabled={loading}
            className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted/50 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-2 text-sm font-bold text-white hover:bg-rose-700 transition-colors disabled:opacity-50"
          >
            {loading && <Loader2 size={13} className="animate-spin" />}
            Arquivar
          </button>
        </div>
      </div>
    </div>
  );
}

function BulkArchiveModal({
  count,
  onClose,
  onSubmit,
  loading,
}: {
  count: number;
  onClose: () => void;
  onSubmit: (reason: string) => void;
  loading: boolean;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => textareaRef.current?.focus(), 80);
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", handler);
    };
  }, [onClose]);

  const submit = () => {
    const trimmed = reason.trim();
    if (!trimmed) {
      setError("Motivo obrigatório.");
      return;
    }
    onSubmit(trimmed);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card rounded-2xl shadow-2xl border border-border w-full max-w-md p-6 animate-in zoom-in-95 duration-150">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="text-base font-black text-foreground">Arquivar alunos</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Confirma arquivar <span className="font-bold text-foreground">{count}</span> aluno(s)?
              O histórico financeiro e académico é preservado.
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-muted-foreground flex-shrink-0">
            <X size={16} />
          </button>
        </div>

        <div>
          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">
            Motivo <span className="text-rose-500">*</span>
          </label>
          <textarea
            ref={textareaRef}
            rows={3}
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
              setError(null);
            }}
            placeholder="Ex.: transferência, desistência, duplicado…"
            className="w-full rounded-xl border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-klasse-gold/20 focus:border-klasse-green resize-none"
          />
          {error && (
            <p className="text-xs text-rose-500 font-semibold mt-1.5 flex items-center gap-1">
              <AlertCircle size={11} /> {error}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-5">
          <button
            onClick={onClose}
            disabled={loading}
            className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted/50 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-2 text-sm font-bold text-white hover:bg-rose-700 transition-colors disabled:opacity-50"
          >
            {loading && <Loader2 size={13} className="animate-spin" />}
            Arquivar
          </button>
        </div>
      </div>
    </div>
  );
}

function OfflineBanner({ fromCache, updatedAt }: { fromCache: boolean; updatedAt: string | null }) {
  if (!fromCache) return null;
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
      <AlertCircle size={14} className="flex-shrink-0 text-amber-500" />
      <span className="font-semibold">Sem ligação</span>
      <span className="text-amber-600">
        — a mostrar dados em cache
        {updatedAt ? ` de ${new Date(updatedAt).toLocaleTimeString("pt-AO")}` : "."}
      </span>
    </div>
  );
}

function SkeletonRow() {
  return (
    <tr className="animate-pulse border-b border-border">
      {[20, 200, 160, 140, 80, 100].map((width, index) => (
        <td key={index} className="px-5 py-4">
          <div className="h-4 rounded-xl bg-muted" style={{ width }} />
        </td>
      ))}
    </tr>
  );
}

const TAB_TO_STATUS: Record<TabStatus, string> = {
  leads: "pendente",
  ativos: "ativo",
  inadimplentes: "ativo",
  inativos: "inativo",
  arquivados: "arquivado",
};

export default function AlunosSecretariaPage({ escolaId }: { escolaId?: string | null }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const academicYearId = searchParams?.get(ACADEMIC_YEAR_PARAM);
  const { success, error } = useToast();
  const slugFromPath = React.useMemo(() => {
    const match = pathname?.match(/^\/escola\/([^/]+)/);
    return match?.[1] ?? null;
  }, [pathname]);
  const portalBase = pathname?.includes("/operacoes")
    ? "/operacoes"
    : "/secretaria";
  const secretariaBase = slugFromPath
    ? `/escola/${slugFromPath}${portalBase}`
    : portalBase;

  const [tab, setTab] = useState<TabStatus>("ativos");
  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q, 300);

  const [page, setPage] = useState(1);
  const pageCursors = useRef<Array<Cursor | null>>([null]);
  const requestSequence = useRef(0);
  const PAGE_SIZE = 20;

  const [filters, setFilters] = useState<Filters>({ ano: "", turmaId: "" });
  const [showFilters, setShowFilters] = useState(false);
  const [turmas, setTurmas] = useState<TurmaOption[]>([]);
  const [turmasLoading, setTurmasLoading] = useState(false);
  const [turmasError, setTurmasError] = useState<string | null>(null);

  const [items, setItems] = useState<Aluno[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [offlineMeta, setOfflineMeta] = useState<OfflineMeta>({
    fromCache: false,
    updatedAt: null,
  });

  const [archiveTarget, setArchiveTarget] = useState<Aluno | null>(null);
  const [profileTarget, setProfileTarget] = useState<Aluno | null>(null);
  const [drawerAluno, setDrawerAluno] = useState<Aluno | null>(null);
  const [bulkArchiveOpen, setBulkArchiveOpen] = useState(false);
  const [bulkArchiveLoading, setBulkArchiveLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showExport, setShowExport] = useState(false);
  const isInitialLoading = loading && items.length === 0;

  const isInadimplentesTab = (value: TabStatus) => value === "inadimplentes";

  const load = useCallback(
    async (
      currentPage: number,
      currentTab: TabStatus,
      currentQ: string,
      currentFilters: Filters,
      signal?: AbortSignal
    ) => {
    const requestId = ++requestSequence.current;
    setLoading(true);
    setFetchError(null);

    try {
      const cursor = pageCursors.current[currentPage - 1] ?? null;
      const params = new URLSearchParams({
        q: currentQ,
        status: TAB_TO_STATUS[currentTab],
        pageSize: String(PAGE_SIZE),
      });
      if (escolaId) {
        params.set("escolaId", escolaId);
      }
      if (academicYearId) params.set(ACADEMIC_YEAR_PARAM, academicYearId);
      if (currentFilters.ano) {
        params.set("ano", currentFilters.ano);
      }
      if (currentFilters.turmaId) {
        params.set("turma_id", currentFilters.turmaId);
      }
      if (isInadimplentesTab(currentTab)) {
        params.set("situacao_financeira", "em_atraso");
      }
      if (cursor) {
        params.set("cursor_created_at", cursor.created_at);
        params.set("cursor_id", cursor.id);
      } else {
        params.set("page", String(currentPage));
      }

      const res = await fetch(`/api/secretaria/alunos?${params.toString()}`, { cache: "no-store", signal });
      const json: ApiResponse = await res.json().catch(() => ({ ok: false, items: [] }));

      if (!json.ok) throw new Error(json.error || "Falha ao carregar.");

      if (requestId !== requestSequence.current || signal?.aborted) return;
      setItems(json.items ?? []);
      setOfflineMeta({ fromCache: false, updatedAt: null });
      setHasMore(Boolean(json.page?.hasMore));
      pageCursors.current[currentPage] = json.page?.nextCursor ?? null;
    } catch (cause) {
      if (requestId !== requestSequence.current || signal?.aborted) return;
      setFetchError(cause instanceof Error ? cause.message : "Erro inesperado.");
      setItems([]);
      setHasMore(false);
    } finally {
      if (requestId === requestSequence.current && !signal?.aborted) setLoading(false);
    }
  }, [academicYearId, escolaId]);

  // Reset the page and cursor *before* running a query with new filters.
  // Requests from old tabs / pages are aborted and cannot overwrite newer results.
  const filterKey = JSON.stringify([tab, debouncedQ, filters.ano, filters.turmaId, academicYearId, escolaId]);
  const previousFilterKey = useRef(filterKey);
  useEffect(() => {
    if (q !== debouncedQ) return;
    if (previousFilterKey.current !== filterKey) {
      previousFilterKey.current = filterKey;
      pageCursors.current = [null];
      setSelected(new Set());
      if (page !== 1) {
        setPage(1);
        return;
      }
    }
    setSelected(new Set());
    const controller = new AbortController();
    void load(page, tab, debouncedQ, filters, controller.signal);
    return () => {
      controller.abort();
      requestSequence.current += 1;
    };
  }, [filterKey, page, load, tab, debouncedQ, filters, q]);

  const loadTurmas = useCallback(async () => {
    if (turmasLoading || turmas.length > 0) return;
    setTurmasLoading(true);
    setTurmasError(null);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (escolaId) params.set("escolaId", escolaId);
      const res = await fetch(`/api/secretaria/turmas?${params.toString()}`, { cache: "no-store" });
      const json = await res.json().catch(() => ({ ok: false, items: [] }));
      if (!res.ok || !json.ok) throw new Error(json.error || "Falha ao carregar turmas.");
      const items = (json.items || []).map((row: any) => ({
        id: row.id,
        nome: row.nome || row.turma_nome || "Sem nome",
        ano_letivo: row.ano_letivo ?? null,
      }));
      setTurmas(items);
    } catch (err: any) {
      setTurmasError(err.message || "Erro ao carregar turmas.");
    } finally {
      setTurmasLoading(false);
    }
  }, [turmasLoading, turmas.length, escolaId]);

  useEffect(() => {
    if (showFilters) {
      loadTurmas();
    }
  }, [showFilters, loadTurmas]);

  const handleTabChange = (nextTab: TabStatus) => {
    setTab(nextTab);
    setQ("");
  };

  const handleArchiveSuccess = (message: string) => {
    success("Operação concluída", message);
    pageCursors.current = [null];
    if (page === 1) void load(1, tab, debouncedQ, filters);
    else setPage(1);
  };

  const handlePagamentoSuccess = (message: string) => {
    success("Pagamento registado", message);
    load(page, tab, debouncedQ, filters);
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelected((prev) => {
      const allSelected = items.length > 0 && items.every((item) => prev.has(item.id));
      if (allSelected) {
        return new Set();
      }
      return new Set(items.map((item) => item.id));
    });
  };

  const exportCsv = (rows: Aluno[], filename: string) => {
    if (rows.length === 0) return;
    const headers = [
      "nome",
      "email",
      "responsavel",
      "telefone_responsavel",
      "status",
      "numero_processo_login",
      "numero_processo",
      "origem",
      "created_at",
    ];
    const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const lines = [headers.join(",")].concat(
      rows.map((row) =>
        headers
          .map((key) => {
            const value = (row as Record<string, unknown>)[key];
            return escape(value === null || value === undefined ? "" : String(value));
          })
          .join(",")
      )
    );
    const blob = new Blob(["\ufeff", lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleExport = (mode: "page" | "all") => {
    const params = new URLSearchParams({
      q: debouncedQ,
      status: TAB_TO_STATUS[tab],
      pageSize: String(PAGE_SIZE),
    });
    if (escolaId) params.set("escolaId", escolaId);
    if (filters.ano) params.set("ano", filters.ano);
    if (filters.turmaId) params.set("turma_id", filters.turmaId);
    if (isInadimplentesTab(tab)) {
      params.set("situacao_financeira", "em_atraso");
    }
    params.set("order_by", "nome_asc");
    if (mode === "page") {
      params.set("page", String(page));
    } else {
      params.set("all", "1");
    }
    setShowExport(false);
    window.open(`/api/secretaria/alunos/exportar?${params.toString()}`, "_blank");
  };

  const handleBulkArchive = async (reason: string) => {
    if (selected.size === 0) return;
    setBulkArchiveLoading(true);
    const ids = Array.from(selected);
    const results = await Promise.all(
      ids.map(async (id) => {
        const params = new URLSearchParams();
        if (escolaId) params.set("escolaId", escolaId);
        const res = await fetch(
          `/api/secretaria/alunos/${id}/delete${params.toString() ? `?${params.toString()}` : ""}`,
          {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reason }),
          }
        );
        const json = await res.json().catch(() => ({}));
        return res.ok && json.ok;
      })
    );
    const successCount = results.filter(Boolean).length;
    const failureCount = ids.length - successCount;
    if (successCount > 0) {
      success("Alunos arquivados", `${successCount} aluno(s) arquivado(s).`);
    }
    if (failureCount > 0) {
      error("Falha ao arquivar", `${failureCount} falha(s) ao arquivar.`);
    }
    setBulkArchiveOpen(false);
    setBulkArchiveLoading(false);
    setSelected(new Set());
    pageCursors.current = [null];
    if (page === 1) void load(1, tab, debouncedQ, filters);
    else setPage(1);
  };

  const activeFilters = Number(Boolean(filters.ano)) + Number(Boolean(filters.turmaId));
  const yearOptions = [
    new Date().getFullYear() + 1,
    new Date().getFullYear(),
    new Date().getFullYear() - 1,
    new Date().getFullYear() - 2,
  ];

  const initials = (nome: string) =>
    nome
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("")
      .slice(0, 2);

  return (
    <>
      {archiveTarget && (
        <ArchiveModal
          aluno={archiveTarget}
          onClose={() => setArchiveTarget(null)}
          onSuccess={handleArchiveSuccess}
        />
      )}
      {bulkArchiveOpen && (
        <BulkArchiveModal
          count={selected.size}
          onClose={() => setBulkArchiveOpen(false)}
          onSubmit={handleBulkArchive}
          loading={bulkArchiveLoading}
        />
      )}

      <ProfileDrawer
        aluno={profileTarget}
        secretariaBase={secretariaBase}
        onClose={() => setProfileTarget(null)}
        onPagamento={(aluno) => {
          setProfileTarget(null);
          setDrawerAluno(aluno);
        }}
      />

      <PagamentoDrawer
        aluno={drawerAluno}
        onClose={() => setDrawerAluno(null)}
        onSuccess={handlePagamentoSuccess}
      />

      <div className="w-full max-w-6xl mx-auto px-6 py-8 space-y-6">
        <Breadcrumb
          items={[
            { label: pathname?.includes("/operacoes") ? "Operações" : "Secretaria", href: secretariaBase },
            { label: "Alunos" },
          ]}
        />

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-klasse-green tracking-tight">Gestão de Alunos</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Leads, matrículas e histórico — num único lugar.
            </p>
          </div>

          <Link
            href={`${secretariaBase}/admissoes/nova`}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-klasse-gold px-5 py-2.5 text-sm font-bold text-white transition-colors hover:brightness-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-klasse-gold/20"
          >
            <Plus size={14} />
            Nova Admissão
          </Link>
        </div>

        <OfflineBanner fromCache={offlineMeta.fromCache} updatedAt={offlineMeta.updatedAt} />

        {fetchError && (
          <div className="min-w-0">
            <OperationalTableErrorState description={fetchError} onRetry={() => void load(page, tab, debouncedQ, filters)} />
          </div>
        )}

        <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="px-5 pt-4">
            <TabBar active={tab} onChange={handleTabChange} />
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-3 border-b border-border bg-muted/50 px-3 py-4 sm:px-5">
            <div className="relative min-w-[190px] flex-1 sm:max-w-sm">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                aria-label="Pesquisar alunos"
                value={q}
                onChange={(event) => setQ(event.target.value)}
                placeholder="Nome, número de login, processo…"
                className="min-h-11 w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-10 text-sm text-foreground outline-none focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/20"
              />
              {q && (
                <button
                  type="button"
                  aria-label="Limpar pesquisa"
                  onClick={() => setQ("")}
                  className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            <div className="relative">
              <button
                type="button"
                aria-expanded={showFilters}
                aria-controls="secretaria-alunos-filters"
                onClick={() => setShowFilters((prev) => !prev)}
                className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-klasse-gold/20 ${
                  activeFilters > 0
                    ? "border-klasse-green bg-klasse-green/5 text-klasse-green"
                    : "border-border bg-card text-muted-foreground hover:bg-muted/50"
                }`}
              >
                <SlidersHorizontal size={12} /> Filtros
                {activeFilters > 0 && (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-klasse-green text-[9px] font-black text-white">
                    {activeFilters}
                  </span>
                )}
              </button>
              {showFilters && (
                <div id="secretaria-alunos-filters" className="absolute right-0 z-20 mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-card p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Filtros</p>
                    <button
                      onClick={() => setFilters({ ano: "", turmaId: "" })}
                      className="text-[11px] font-semibold text-muted-foreground hover:text-muted-foreground"
                    >
                      Limpar
                    </button>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-muted-foreground mb-1.5">Ano letivo</label>
                      <select
                        value={filters.ano}
                        onChange={(event) => setFilters((prev) => ({ ...prev, ano: event.target.value }))}
                        className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-klasse-gold/20 focus:border-klasse-green"
                      >
                        <option value="">Todos</option>
                        {yearOptions.map((year) => (
                          <option key={year} value={year}>
                            {year}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-muted-foreground mb-1.5">Turma</label>
                      <select
                        value={filters.turmaId}
                        onChange={(event) => setFilters((prev) => ({ ...prev, turmaId: event.target.value }))}
                        className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-klasse-gold/20 focus:border-klasse-green"
                      >
                        <option value="">Todas</option>
                        {turmas.map((turma) => (
                          <option key={turma.id} value={turma.id}>
                            {formatTurmaDisplayName(turma)}
                          </option>
                        ))}
                      </select>
                      {turmasLoading && (
                        <p className="text-[11px] text-muted-foreground mt-1">A carregar turmas…</p>
                      )}
                      {turmasError && (
                        <p className="text-[11px] text-rose-500 mt-1">{turmasError}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>


            <div className="ml-auto flex items-center gap-2">
              {!loading && (
                <span aria-live="polite" className="text-xs font-semibold text-muted-foreground">
                  {items.length} {items.length === 1 ? "registo" : "registos"} nesta página
                </span>
              )}
              {isInitialLoading && (
                <span className="inline-flex items-center gap-2">
                  <span className="h-3 w-20 animate-pulse rounded bg-slate-200" />
                </span>
              )}

              <div className="relative">
                <button
                  onClick={() => setShowExport((prev) => !prev)}
                  className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-bold text-muted-foreground hover:bg-muted/50 transition-colors"
                  title="Exportar CSV"
                >
                  <Download size={12} /> Exportar
                </button>
                {showExport && (
                  <div className="absolute right-0 mt-2 w-40 rounded-xl border border-border bg-card shadow-xl p-2 z-20">
                    <button
                      onClick={() => handleExport("page")}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-muted/50"
                    >
                      Página atual
                    </button>
                    <button
                      onClick={() => handleExport("all")}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-muted/50"
                    >
                      Tudo
                    </button>
                  </div>
                )}
              </div>

              <button
                onClick={() => {
                  pageCursors.current = [null];
                  if (page === 1) void load(1, tab, debouncedQ, filters);
                  else setPage(1);
                }}
                className="rounded-xl border border-border bg-card p-2.5 text-muted-foreground hover:bg-muted/50 transition-colors"
                title="Actualizar"
              >
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table aria-label="Alunos da Secretaria" className="min-w-[840px] w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-5 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={items.length > 0 && items.every((item) => selected.has(item.id))}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-border text-klasse-green focus:ring-klasse-gold/20"
                      aria-label="Selecionar todos"
                    />
                  </th>
                  {["Aluno", "Contacto", "Responsável", "Estado", "Acções"].map((header, index) => (
                    <th
                      key={header}
                      className={`px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground ${
                        index === 3 ? "text-center" : index === 4 ? "text-right" : "text-left"
                      }`}
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  Array.from({ length: isInitialLoading ? 8 : 5 }).map((_, index) => <SkeletonRow key={index} />)
                ) : fetchError ? null : items.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <OperationalTableEmptyState
                        title="Nenhum aluno encontrado"
                        description={q || filters.ano || filters.turmaId ? "Ajuste a pesquisa ou os filtros." : "Não existem registos para este estado."}
                      />
                    </td>
                  </tr>
                ) : (
                  items.map((aluno) => {
                    const isLead = aluno.origem === "candidatura";
                    const id = aluno.numero_processo
                      ? `Proc. ${aluno.numero_processo}`
                      : aluno.numero_processo_login
                        ? `Login ${aluno.numero_processo_login}`
                        : null;

                    return (
                      <tr key={aluno.id} className="group hover:bg-muted/50/80 transition-colors">
                        <td className="px-5 py-3.5">
                          <input
                            type="checkbox"
                            checked={selected.has(aluno.id)}
                            onChange={() => toggleSelect(aluno.id)}
                            className="h-4 w-4 rounded border-border text-klasse-green focus:ring-klasse-gold/20"
                            aria-label={`Selecionar ${aluno.nome}`}
                          />
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-xl bg-klasse-green/10 flex items-center justify-center flex-shrink-0 text-xs font-black text-klasse-green">
                              {initials(aluno.nome || "?")}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-foreground truncate">{aluno.nome}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                {id && <span className="font-mono text-[10px] text-muted-foreground">{id}</span>}
                                {isLead && (
                                  <span className="inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-black bg-amber-100 text-amber-800 uppercase tracking-wide">
                                    Lead
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-3.5">
                          {aluno.email ? (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Mail size={11} className="text-muted-foreground flex-shrink-0" />
                              <span className="truncate max-w-[160px]">{aluno.email}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>

                        <td className="px-5 py-3.5">
                          {aluno.responsavel ? (
                            <div>
                              <p className="text-xs font-semibold text-foreground truncate max-w-[160px]">
                                {aluno.responsavel}
                              </p>
                              {aluno.telefone_responsavel && (
                                <p className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                                  <Phone size={10} />
                                  {aluno.telefone_responsavel}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>

                        <td className="px-5 py-3.5 text-center">
                          <StatusBadge status={aluno.status} />
                        </td>

                        <td className="px-5 py-3.5">
                          <RowActions
                            aluno={aluno}
                            secretariaBase={secretariaBase}
                            onArchive={setArchiveTarget}
                            onView={setProfileTarget}
                            onPagamento={setDrawerAluno}
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="border-t border-border bg-muted/50 p-3 sm:p-4">
            <OperationalCursorPagination
              page={page}
              visibleCount={items.length}
              hasMore={hasMore}
              disabled={loading || Boolean(fetchError)}
              onPageChange={setPage}
            />
          </div>
        </div>
      </div>
      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 z-30 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-foreground shadow-sm animate-in slide-in-from-bottom-3 duration-200">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-klasse-gold text-xs font-black text-foreground">
              {selected.size}
            </div>
            <span className="text-sm font-semibold text-foreground">
              {selected.size === 1 ? "aluno seleccionado" : "alunos seleccionados"}
            </span>
            <span className="text-xs text-muted-foreground">de {items.length}</span>
          </div>

          <div className="mx-1 h-4 w-px bg-border" />

          <div className="flex items-center gap-2">
            <button
              onClick={() => exportCsv(items.filter((item) => selected.has(item.id)), `alunos-selecionados-${Date.now()}.csv`)}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:border-border hover:text-foreground transition-colors"
            >
              <Download size={12} /> Exportar
            </button>
            <button
              onClick={() => setBulkArchiveOpen(true)}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:border-rose-400 hover:text-rose-200 transition-colors"
            >
              <Archive size={12} /> Arquivar
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:border-border hover:text-foreground transition-colors"
            >
              <X size={12} /> Limpar
            </button>
          </div>
        </div>
      )}
    </>
  );
}
