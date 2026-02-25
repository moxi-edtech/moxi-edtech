import { supabaseServer } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { redirect } from "next/navigation";
import Link from "next/link";
import AuditPageView from "@/components/audit/AuditPageView";
import { formatDateTime } from "@/lib/formatters";
import type { Database } from "~types/supabase";
import {
  FileText,
  Search,
  Download,
  Slash,
  ShieldCheck,
  AlertTriangle,
  Clock,
  ArrowUpRight,
  Filter,
} from "lucide-react";

export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

type SearchParams = { q?: string; days?: string };
type AuditLog = Database["public"]["Tables"]["audit_logs"]["Row"];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function parseDays(days?: string): number {
  const d = parseInt(days ?? "30", 10);
  return Number.isFinite(d) && d > 0 ? d : 30;
}

function sinceFromDays(days: number): string {
  if (days >= 3650) return "1970-01-01";
  const dt = new Date();
  dt.setDate(dt.getDate() - days);
  return dt.toISOString();
}

function formatDetails(details: unknown): string {
  if (!details || typeof details !== "object") return "—";
  if (Object.keys(details as object).length === 0) return "—";
  return JSON.stringify(details, null, 2);
}

function pickDetail(details: Record<string, any>, keys: string[]): string | null {
  for (const key of keys) {
    const value = details[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function humanizeLog(log: AuditLog): { title: string; body?: string | null } {
  const action = String(log.action ?? "");
  const actionLower = action.toLowerCase();
  const actionUpper = action.toUpperCase();
  const details = (log.details && typeof log.details === "object" ? log.details : {}) as Record<
    string,
    any
  >;

  const alunoNome = pickDetail(details, ["aluno_nome", "aluno", "nome_aluno", "nome"]);
  const turmaNome = pickDetail(details, ["turma_nome", "turma", "nome_turma"]);
  const professorNome = pickDetail(details, ["professor_nome", "professor", "usuario", "user"]);
  const documentoNome = pickDetail(details, ["documento", "documento_nome", "tipo_documento"]);
  const valor = pickDetail(details, ["valor_formatado", "valor", "total", "amount"]);
  const email = pickDetail(details, ["email", "usuario_email"]) ?? null;

  const prettify = (value: string) => {
    if (!value) return "Ação registrada";
    const cleaned = value.replace(/[_.]+/g, " ").toLowerCase();
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  };

  if (actionUpper === "CURRICULUM_PUBLISH" || (actionLower.includes("curriculo") && actionLower.includes("publish"))) {
    return {
      title: "Currículo publicado",
      body: pickDetail(details, ["curriculo_nome", "curso_nome"]) ?? null,
    };
  }

  if (actionUpper === "TURMAS_GERADAS_FROM_CURRICULO") {
    return {
      title: "Turmas geradas para o ano",
      body: turmaNome ?? "Turmas criadas a partir do currículo publicado.",
    };
  }

  if (actionUpper === "MATRICULA_MASSA" || actionUpper === "MATRICULA_MASSA_TURMA") {
    return {
      title: "Matrículas em massa processadas",
      body: turmaNome ? `Turma: ${turmaNome}.` : null,
    };
  }

  if (actionUpper === "MATRICULA_STATUS_ATUALIZADO") {
    return {
      title: `Matrícula status atualizado${alunoNome ? ` — ${alunoNome}` : ""}`,
      body: turmaNome ? `Turma: ${turmaNome}.` : null,
    };
  }

  if (actionUpper === "MATRICULA_TRANSFERIDA") {
    return {
      title: `Matrícula transferida${alunoNome ? ` — ${alunoNome}` : ""}`,
      body: turmaNome ? `Turma: ${turmaNome}.` : null,
    };
  }

  if (actionUpper === "NOTA_LANCADA_BATCH") {
    return {
      title: `Notas lançadas${turmaNome ? ` — ${turmaNome}` : ""}`,
      body: professorNome ? `${professorNome} lançou notas.` : "Lançamento de notas registrado.",
    };
  }

  if (actionUpper === "PAGAMENTO_REGISTRADO") {
    return {
      title: `Pagamento confirmado${alunoNome ? ` — ${alunoNome}` : ""}`,
      body: valor ? `Valor: ${valor}.` : "Pagamento registrado.",
    };
  }

  if (actionUpper === "PAGAMENTO_CONCILIADO") {
    return {
      title: "Pagamento conciliado",
      body: valor ? `Valor: ${valor}.` : null,
    };
  }

  if (actionUpper === "RECIBO_EMITIDO") {
    return {
      title: `Recibo emitido${alunoNome ? ` — ${alunoNome}` : ""}`,
      body: valor ? `Valor: ${valor}.` : null,
    };
  }

  if (actionUpper === "VENDA_AVULSA_REGISTRADA") {
    return {
      title: `Venda avulsa registrada${alunoNome ? ` — ${alunoNome}` : ""}`,
      body: valor ? `Valor: ${valor}.` : "Venda avulsa registrada no financeiro.",
    };
  }

  if (actionUpper.startsWith("MATRICULA_")) {
    return {
      title: `Matrícula ${actionUpper.replace("MATRICULA_", "").toLowerCase()}${
        alunoNome ? ` — ${alunoNome}` : ""
      }`,
      body: turmaNome ? `Turma: ${turmaNome}.` : null,
    };
  }

  if (actionUpper.startsWith("ADMISSAO_")) {
    return {
      title: `Admissão ${actionUpper.replace("ADMISSAO_", "").toLowerCase()}${
        alunoNome ? ` — ${alunoNome}` : ""
      }`,
      body: turmaNome ? `Turma: ${turmaNome}.` : null,
    };
  }

  if (actionUpper === "CANDIDATURA_CRIADA") {
    return {
      title: `Candidatura criada${alunoNome ? ` — ${alunoNome}` : ""}`,
      body: turmaNome ? `Turma: ${turmaNome}.` : null,
    };
  }

  if (actionUpper === "ADMISSION_RESERVED_48H") {
    return {
      title: "Admissão reservada por 48h",
      body: alunoNome ? `Aluno: ${alunoNome}.` : null,
    };
  }

  if (actionLower === "admissao.draft.upsert" || actionLower === "admissao.draft.upsert_failed") {
    return {
      title: "Rascunho de admissão atualizado",
      body: alunoNome ? `Aluno: ${alunoNome}.` : null,
    };
  }

  if (actionUpper === "ADMISSAO_CONVERTIDA_MATRICULA") {
    return {
      title: `Admissão convertida em matrícula${alunoNome ? ` — ${alunoNome}` : ""}`,
      body: turmaNome ? `Turma: ${turmaNome}.` : null,
    };
  }

  if (actionUpper === "DOCUMENTO_EMITIDO") {
    return {
      title: `Documento emitido${alunoNome ? ` — ${alunoNome}` : ""}`,
      body: documentoNome ?? null,
    };
  }

  if (actionUpper.startsWith("FECHO_CAIXA_")) {
    return {
      title: `Fecho de caixa ${actionUpper.replace("FECHO_CAIXA_", "").toLowerCase()}`,
      body: valor ? `Valor: ${valor}.` : null,
    };
  }

  if (actionUpper === "FECHO_DECLARADO") {
    return {
      title: "Fecho de caixa declarado",
      body: valor ? `Valor: ${valor}.` : null,
    };
  }

  if (actionUpper.startsWith("USUARIO_")) {
    return {
      title: `Usuário ${actionUpper.replace("USUARIO_", "").toLowerCase()}`,
      body: email ? `Email: ${email}.` : null,
    };
  }

  if (actionUpper === "RESET_PASSWORD_SOLICITADO") {
    return {
      title: "Reset de senha solicitado",
      body: email ? `Email: ${email}.` : null,
    };
  }

  if (actionUpper === "REENVIAR_CONVITE") {
    return {
      title: "Convite reenviado",
      body: email ? `Email: ${email}.` : null,
    };
  }

  if (actionUpper.startsWith("USUARIO_INVITE")) {
    return {
      title: "Convite enviado",
      body: email ?? null,
    };
  }

  if (actionUpper === "REPARAR_ADMINS") {
    return {
      title: "Administradores reparados",
      body: "Correção automática de permissões de admin.",
    };
  }

  if (actionUpper.startsWith("ESCOLA_")) {
    return {
      title: `Escola ${actionUpper.replace("ESCOLA_", "").toLowerCase()}`,
      body: pickDetail(details, ["motivo", "reason"]) ?? null,
    };
  }

  if (actionUpper === "ESCOLA_MARCADA_EXCLUSAO") {
    return {
      title: "Escola marcada para exclusão",
      body: pickDetail(details, ["motivo", "reason"]) ?? null,
    };
  }

  if (actionUpper === "COBRANCA_ENVIADA") {
    return {
      title: "Cobrança enviada",
      body: valor ? `Valor: ${valor}.` : null,
    };
  }

  if (actionUpper === "AUTH_PROVISION_USER") {
    return {
      title: "Acesso criado para aluno",
      body: alunoNome ? `Aluno: ${alunoNome}.` : null,
    };
  }

  if (
    actionUpper === "ALUNO_ATUALIZADO" ||
    actionUpper === "ALUNO_ARQUIVADO" ||
    actionUpper === "ALUNO_RESTAURADO" ||
    actionUpper === "ALUNO_HARD_DELETADO"
  ) {
    return {
      title: `Aluno ${actionUpper.replace("ALUNO_", "").toLowerCase()}${
        alunoNome ? ` — ${alunoNome}` : ""
      }`,
      body: turmaNome ? `Turma: ${turmaNome}.` : null,
    };
  }

  if (actionUpper === "REMATRICULA_RPC" || actionUpper === "REMATRICULA_APP") {
    return {
      title: "Rematrícula processada",
      body: turmaNome ? `Turma: ${turmaNome}.` : null,
    };
  }

  if (
    actionLower.includes("turma") && (actionLower.includes("gerad") || actionLower.includes("create"))
  ) {
    return {
      title: "Turmas geradas",
      body: turmaNome ?? "Novas turmas criadas para o ano letivo.",
    };
  }

  if (actionLower.includes("nota") && actionLower.includes("lanc")) {
    return {
      title: `Notas lançadas${turmaNome ? ` — ${turmaNome}` : ""}`,
      body: professorNome ? `${professorNome} lançou notas.` : "Lançamento de notas registrado.",
    };
  }

  if (actionLower.includes("pagamento") || actionLower.includes("payment")) {
    return {
      title: `Pagamento confirmado${alunoNome ? ` — ${alunoNome}` : ""}`,
      body: valor ? `Valor: ${valor}.` : "Pagamento registrado.",
    };
  }

  if (actionLower.includes("matricula")) {
    return {
      title: `Matrícula atualizada${alunoNome ? ` — ${alunoNome}` : ""}`,
      body: turmaNome ? `Turma: ${turmaNome}.` : null,
    };
  }

  if (actionLower.includes("documento")) {
    return {
      title: `Documento emitido${alunoNome ? ` — ${alunoNome}` : ""}`,
      body: documentoNome ?? null,
    };
  }

  const baseTitle = log.action ? prettify(log.action) : "Ação registrada";
  const baseBody = log.entity ? `Entidade: ${log.entity}.` : null;
  return { title: baseTitle, body: baseBody };
}

function resolveActionColor(action?: string | null) {
  const a = (action ?? "").toLowerCase();
  if (a.includes("delete") || a.includes("archive") || a.includes("remov")) {
    return { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" };
  }
  if (a.includes("create") || a.includes("insert") || a.includes("matricul")) {
    return { bg: "bg-[#1F6B3B]/8", text: "text-[#1F6B3B]", border: "border-[#1F6B3B]/20" };
  }
  if (a.includes("update") || a.includes("edit") || a.includes("alter")) {
    return { bg: "bg-[#E3B23C]/8", text: "text-[#9a7010]", border: "border-[#E3B23C]/30" };
  }
  if (a.includes("pay") || a.includes("pagamento") || a.includes("checkout")) {
    return { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" };
  }
  return { bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-200" };
}

// ─────────────────────────────────────────────────────────────────────────────
// Atoms
// ─────────────────────────────────────────────────────────────────────────────

function ActionBadge({ action }: { action?: string | null }) {
  const c = resolveActionColor(action);
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${c.bg} ${c.text} ${c.border}`}
    >
      {action ?? "—"}
    </span>
  );
}

function EmptyState({ q }: { q: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50">
        <ShieldCheck size={24} className="text-slate-300" />
      </div>
      <p className="text-sm font-bold text-slate-500">Sem eventos neste período</p>
      {q && (
        <p className="mt-1 text-xs text-slate-400">
          Nenhum resultado para <span className="font-semibold">“{q}”</span>
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default async function Page(props: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<SearchParams>;
}) {
  const { id: escolaId } = await props.params;
  const searchParams = (await props.searchParams) ?? {};

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const resolvedEscolaId = await resolveEscolaIdForUser(supabase, user.id);
  if (!resolvedEscolaId || resolvedEscolaId !== escolaId) redirect("/login");

  const q = (searchParams.q ?? "").trim();
  const days = parseDays(searchParams.days);
  const since = sinceFromDays(days);

  const basePath = `/escola/${escolaId}/admin/relatorios`;

  let query = supabase
    .from("audit_logs")
    .select("id, created_at, action, entity, entity_id, details")
    .eq("escola_id", escolaId)
    .eq("portal", "secretaria")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(200);

  if (q) query = query.or(`action.ilike.%${q}%,entity.ilike.%${q}%`);

  const { data, error } = await query;
  if (error) {
    console.error("[RelatoriosPage] query error:", error.message);
  }

  const logs = (data ?? []) as AuditLog[];
  const totalEventos = logs.length;
  const tiposUnicos = new Set(logs.map((l) => l.action)).size;
  const comErro = logs.filter((l) => {
    const actionLower = String(l.action ?? "").toLowerCase();
    return actionLower.includes("error") || actionLower.includes("fail");
  }).length;

  const PERIODOS = [
    { label: "1 dia", value: "1" },
    { label: "7 dias", value: "7" },
    { label: "30 dias", value: "30" },
    { label: "90 dias", value: "90" },
  ];

  return (
    <>
      <AuditPageView portal="admin_escola" acao="PAGE_VIEW" entity="relatorios" />

      <div className="min-h-screen bg-slate-50">
        <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
          <nav>
            <ol className="flex items-center gap-1 text-xs font-semibold text-slate-400">
              <li>
                <Link
                  href={`/escola/${escolaId}/admin`}
                  className="hover:text-[#1F6B3B] transition-colors"
                >
                  Admin
                </Link>
              </li>
              <li>
                <Slash size={10} className="text-slate-300" />
              </li>
              <li className="text-slate-600">Relatórios da Secretaria</li>
            </ol>
          </nav>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-6 py-5">
            <div className="flex flex-col md:flex-row md:items-start gap-5">
              <div className="flex items-start gap-4 flex-1 min-w-0">
                <div className="flex-shrink-0 h-11 w-11 rounded-xl bg-[#1F6B3B]/8 border border-[#1F6B3B]/15 flex items-center justify-center">
                  <FileText size={18} className="text-[#1F6B3B]" />
                </div>
                <div>
                  <h1 className="text-lg font-black text-[#1F6B3B] tracking-tight">
                    Relatórios da Secretaria
                  </h1>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Audit trail de todas as acções da secretaria · últimos {days}{" "}
                    {days === 1 ? "dia" : "dias"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <Link
                  href={`${basePath}/export?format=csv&days=${days}&q=${encodeURIComponent(q)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:border-[#1F6B3B] hover:text-[#1F6B3B] transition-colors"
                >
                  <Download size={12} />
                  CSV
                </Link>
                <Link
                  href={`${basePath}/export?format=json&days=${days}&q=${encodeURIComponent(q)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:border-[#1F6B3B] hover:text-[#1F6B3B] transition-colors"
                >
                  <Download size={12} />
                  JSON
                </Link>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Eventos
                </p>
                <p className="text-2xl font-black text-slate-900 mt-0.5">{totalEventos}</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Tipos únicos
                </p>
                <p className="text-2xl font-black text-slate-900 mt-0.5">{tiposUnicos}</p>
              </div>
              <div
                className={`rounded-xl border px-4 py-3 ${
                  comErro > 0 ? "border-rose-200 bg-rose-50" : "border-slate-100 bg-slate-50"
                }`}
              >
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Erros
                </p>
                <p
                  className={`text-2xl font-black mt-0.5 ${
                    comErro > 0 ? "text-rose-700" : "text-slate-900"
                  }`}
                >
                  {comErro}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-6 py-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex items-center gap-1.5">
                <Clock size={13} className="text-slate-400 flex-shrink-0" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mr-1">
                  Período
                </span>
                <div className="flex items-center gap-1">
                  {PERIODOS.map((p) => (
                    <Link
                      key={p.value}
                      href={`${basePath}?days=${p.value}&q=${encodeURIComponent(q)}`}
                      className={`rounded-lg px-3 py-1.5 text-xs font-bold border transition-colors ${
                        String(days) === p.value
                          ? "bg-[#1F6B3B] text-white border-[#1F6B3B]"
                          : "border-slate-200 text-slate-600 hover:border-[#1F6B3B]/40 hover:text-[#1F6B3B]"
                      }`}
                    >
                      {p.label}
                    </Link>
                  ))}
                </div>
              </div>

              <div className="hidden sm:block h-5 w-px bg-slate-200" />

              <form method="GET" action={basePath} className="flex items-center gap-2 flex-1">
                <input type="hidden" name="days" value={days} />
                <div className="relative flex-1 max-w-sm">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    name="q"
                    defaultValue={q}
                    placeholder="Buscar acção ou entidade..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-8 pr-3 text-xs font-medium text-slate-900 placeholder:text-slate-400 outline-none focus:border-[#1F6B3B] focus:ring-1 focus:ring-[#1F6B3B]/20 transition-colors"
                  />
                </div>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 rounded-xl bg-[#1F6B3B] px-4 py-2 text-xs font-bold text-white hover:bg-[#185830] transition-colors"
                >
                  <Filter size={11} />
                  Filtrar
                </button>
                {q && (
                  <Link
                    href={`${basePath}?days=${days}`}
                    className="text-xs font-semibold text-slate-400 hover:text-slate-600"
                  >
                    Limpar
                  </Link>
                )}
              </form>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {error && (
              <div className="flex items-center gap-2 border-b border-rose-200 bg-rose-50 px-6 py-3 text-xs font-semibold text-rose-700">
                <AlertTriangle size={13} />
                Erro ao carregar logs. Tente novamente.
              </div>
            )}

            {logs.length === 0 ? (
              <EmptyState q={q} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/70">
                      <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap">
                        Quando
                      </th>
                      <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        Acção
                      </th>
                      <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        Entidade
                      </th>
                      <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        ID
                      </th>
                      <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        Detalhes
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((l, idx) => {
                      const summary = humanizeLog(l);
                      return (
                        <tr
                          key={l.id}
                          className={`border-b border-slate-100 last:border-0 transition-colors hover:bg-[#1F6B3B]/[0.02] ${
                            idx % 2 === 0 ? "" : "bg-slate-50/30"
                          }`}
                        >
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            <div className="flex items-center gap-1.5 text-xs text-slate-500">
                              <Clock size={11} className="text-slate-300 flex-shrink-0" />
                              {l.created_at ? formatDateTime(l.created_at) : "—"}
                            </div>
                          </td>

                          <td className="px-5 py-3.5">
                            <ActionBadge action={l.action} />
                          </td>

                          <td className="px-5 py-3.5">
                            <span className="text-xs font-semibold text-slate-700">
                              {l.entity ?? "—"}
                            </span>
                          </td>

                          <td className="px-5 py-3.5">
                            {l.entity_id ? (
                              <span
                                title={l.entity_id}
                                className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-0.5 text-[10px] font-mono text-slate-500 border border-slate-200 cursor-default"
                              >
                                {l.entity_id.slice(0, 8)}…
                              </span>
                            ) : (
                              <span className="text-slate-300 text-xs">—</span>
                            )}
                          </td>

                          <td className="px-5 py-3.5 max-w-xs">
                            <div className="space-y-2">
                              <div>
                                <p className="text-xs font-semibold text-slate-700">{summary.title}</p>
                                {summary.body ? (
                                  <p className="text-[11px] text-slate-500">{summary.body}</p>
                                ) : null}
                              </div>
                              {l.details && typeof l.details === "object" &&
                              Object.keys(l.details).length > 0 ? (
                                <details className="group">
                                  <summary className="flex cursor-pointer items-center gap-1.5 text-[10px] font-bold text-slate-400 hover:text-[#1F6B3B] transition-colors select-none">
                                    <ArrowUpRight
                                      size={11}
                                      className="group-open:rotate-90 transition-transform"
                                    />
                                    Ver detalhes
                                  </summary>
                                  <pre className="mt-2 rounded-lg bg-slate-50 border border-slate-200 p-2.5 text-[10px] text-slate-600 overflow-auto max-h-40 leading-relaxed">
                                    {formatDetails(l.details)}
                                  </pre>
                                </details>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-3">
                  <p className="text-[11px] text-slate-400">
                    {logs.length === 200
                      ? "Mostrando os 200 eventos mais recentes — refina a pesquisa para ver mais"
                      : `${logs.length} ${logs.length === 1 ? "evento" : "eventos"} encontrados`}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
