import { notFound } from "next/navigation";
import { FinalizarMatriculaButton } from "@/components/secretaria/alunos/FinalizarMatriculaButton";
import Link from "next/link";
import {
  Users,
  Wallet,
  BookOpen,
  CalendarCheck,
  Pencil,
  Eye,
  BarChart3,
} from "lucide-react";
import { AcoesRapidasBalcao } from "@/components/secretaria/AcoesRapidasBalcao";
import { supabaseServer } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------
const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

const kwanza = new Intl.NumberFormat("pt-AO", {
  style: "currency",
  currency: "AOA",
});

const formatDate = (dateString?: string | null) => {
  if (!dateString) return "—";
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-PT", { day: "2-digit", month: "short", year: "numeric" });
};

const monthName = (mes?: number | null) => {
  const m = mes ?? null;
  if (!m || m < 1 || m > 12) return "—";
  return new Date(0, m - 1).toLocaleString("pt-PT", { month: "long" });
};

// ------------------------------------------------------------
// Types (mantidos)
// ------------------------------------------------------------
type DossierPerfil = {
  nome_completo?: string | null;
  nome?: string | null;
  foto_url?: string | null;
  status?: string | null;
  numero_processo?: string | null;
  bi_numero?: string | null;
  data_nascimento?: string | null;
  encarregado_nome?: string | null;
  responsavel?: string | null;
  encarregado_telefone?: string | null;
  telefone_responsavel?: string | null;
  endereco?: string | null;
  endereco_bairro?: string | null;
  provincia?: string | null;
  provincia_residencia?: string | null;
};

type DossierHistoricoItem = {
  status?: string | null;
  ano_letivo?: string | number | null;
  turma?: string | null;
  numero_matricula?: string | null;
  turno?: string | null;
};

type DossierFinanceiro = {
  total_em_atraso?: number | null;
  total_pago?: number | null;
  mensalidades?: DossierMensalidade[] | null;
};

type DossierMensalidade = {
  id?: string | null;
  status?: string | null;
  mes?: number | null;
  ano?: number | null;
  valor?: number | null;
  pago?: number | null;
  vencimento?: string | null;
  pago_em?: string | null;
};

type Dossier = {
  perfil: DossierPerfil;
  historico: DossierHistoricoItem[];
  financeiro: DossierFinanceiro;
};

// ------------------------------------------------------------
// UI atoms (tipados, sem "any")
// ------------------------------------------------------------
function LabelValue(props: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  value?: React.ReactNode;
  truncate?: boolean;
}) {
  const { icon: Icon, label, value, truncate } = props;

  return (
    <div className="flex flex-col gap-1 min-w-0">
      <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 flex items-center gap-2">
        {Icon ? <Icon className="h-4 w-4 text-slate-400" /> : null}
        {label}
      </div>
      <div className={cx("text-sm font-medium text-slate-900 min-w-0", truncate && "truncate")}>
        {value ?? "—"}
      </div>
    </div>
  );
}

function SectionHeader(props: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  action?: React.ReactNode;
}) {
  const { icon: Icon, title, action } = props;

  return (
    <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
      <h2 className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-2">
        <span className="inline-flex items-center justify-center h-8 w-8 rounded-xl bg-slate-100 border border-slate-200">
          <Icon className="h-4 w-4 text-slate-500" />
        </span>
        {title}
      </h2>
      {action}
    </div>
  );
}

function StatusPill({ status }: { status?: string | null }) {
  const normalized = (status ?? "").toLowerCase();
  const isActive = normalized === "ativo" || normalized === "ativa";

  return (
    <span
      className={cx(
        "inline-flex items-center px-3 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wide border",
        isActive
          ? "bg-slate-900 text-white border-slate-900"
          : "bg-white text-slate-700 border-slate-200"
      )}
      title={status ?? undefined}
    >
      {status || "—"}
    </span>
  );
}

function SummaryCard(props: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 mb-1">
        {props.title}
      </div>
      <div className="text-lg font-semibold text-slate-900 truncate" title={props.value}>
        {props.value}
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Page
// ------------------------------------------------------------
export default async function AlunoDossierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const escolaId = user ? await resolveEscolaIdForUser(supabase, user.id) : null;
  if (!user || !escolaId) return notFound();

  const { data: dossier, error } = await supabase.rpc("get_aluno_dossier", {
    p_escola_id: escolaId,
    p_aluno_id: id,
  });

  const typedDossier = dossier as Dossier | null;
  if (error || !typedDossier?.perfil) return notFound();

  const { perfil, historico = [], financeiro = {} as DossierFinanceiro } = typedDossier;
  const mensalidades: DossierMensalidade[] = Array.isArray(financeiro.mensalidades)
    ? financeiro.mensalidades
    : [];

  const alunoNome = perfil.nome_completo || perfil.nome || "Aluno";
  const responsavelNomeRaw = perfil.encarregado_nome || perfil.responsavel || null;
  const responsavelTelRaw = perfil.encarregado_telefone || perfil.telefone_responsavel || null;
  const responsavelNome = responsavelNomeRaw || "—";
  const responsavelTel = responsavelTelRaw || "—";
  const provincia = perfil.provincia || perfil.provincia_residencia || "—";
  const bairro = perfil.endereco_bairro || "—";

  const pendencias: string[] = [];
  if (!perfil.bi_numero) pendencias.push("BI");
  if (!responsavelNomeRaw) pendencias.push("Responsável");
  if (!responsavelTelRaw) pendencias.push("Contacto");
  if (!perfil.endereco) pendencias.push("Endereço");
  if ((financeiro.total_em_atraso ?? 0) > 0) pendencias.push("Financeiro em atraso");
  if (historico.length === 0) pendencias.push("Sem histórico de matrícula");

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <header className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-6 md:px-8 md:py-7">
            <div className="flex flex-col md:flex-row md:items-start gap-6">
              {/* Avatar */}
              <div className="flex items-start gap-4">
                <div className="h-16 w-16 rounded-xl border border-slate-200 bg-slate-100 overflow-hidden flex items-center justify-center">
                  {perfil.foto_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={perfil.foto_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Users className="h-8 w-8 text-slate-400" />
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-2xl font-semibold text-slate-900 tracking-tight truncate">
                      {alunoNome}
                    </h1>
                    <StatusPill status={perfil.status} />
                  </div>

                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-2 text-sm">
                    <div className="flex items-center gap-2 text-slate-600">
                      <BookOpen className="h-4 w-4 text-slate-400" />
                      <span className="text-slate-500">Proc:</span>
                      <span className="font-medium text-slate-900">{perfil.numero_processo || "—"}</span>
                    </div>

                    <div className="flex items-center gap-2 text-slate-600">
                      <Users className="h-4 w-4 text-slate-400" />
                      <span className="text-slate-500">BI:</span>
                      <span className="font-medium text-slate-900">{perfil.bi_numero || "—"}</span>
                    </div>

                    <div className="flex items-center gap-2 text-slate-600">
                      <CalendarCheck className="h-4 w-4 text-slate-400" />
                      <span className="text-slate-500">Nasc:</span>
                      <span className="font-medium text-slate-900">{formatDate(perfil.data_nascimento)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="md:ml-auto flex w-full md:w-auto gap-3">
                <Link
                  href={`/secretaria/alunos/${id}/documentos`}
                  className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 hover:bg-slate-50 text-sm font-medium"
                >
                  <Eye className="h-4 w-4 text-slate-500" />
                  Documentos
                </Link>

                <Link
                  href={`/secretaria/alunos/${id}/editar`}
                  className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-klasse-gold text-white hover:brightness-95 text-sm font-medium"
                >
                  <Pencil className="h-4 w-4" />
                </Link>

                {/* Botão Finalizar Matrícula */}
                <FinalizarMatriculaButton matriculaId={historico[0]?.matricula_id || id} alunoNome={alunoNome} escolaId={escolaId} />
              </div>
            </div>
          </div>
        </header>

        {/* Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Col 1 */}
          <div className="space-y-8">
            <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <SectionHeader icon={BarChart3} title="Pendências do Aluno" />
              {pendencias.length === 0 ? (
                <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                  Nenhuma pendência aberta.
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {pendencias.map((pendencia) => (
                    <span
                      key={pendencia}
                      className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800"
                    >
                      {pendencia}
                    </span>
                  ))}
                </div>
              )}
            </section>
            <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <SectionHeader icon={Users} title="Dados Pessoais" />
              <div className="space-y-5">
                <LabelValue icon={Users} label="Encarregado / Responsável" value={responsavelNome} />
                <LabelValue icon={Users} label="Telefone de Contato" value={responsavelTel} />

                <div className="grid grid-cols-2 gap-4">
                  <LabelValue icon={Users} label="Província" value={provincia} />
                  <LabelValue icon={Users} label="Bairro" value={bairro} />
                </div>

                <LabelValue icon={Users} label="Endereço Completo" value={perfil.endereco || "—"} truncate />
              </div>
            </section>
          </div>

          {/* Col 2 */}
          <div className="space-y-8">
            <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 h-full">
              <SectionHeader icon={BookOpen} title="Histórico Escolar" />

              {historico.length === 0 ? (
                <div className="py-10 text-center text-slate-500">
                  <div className="mx-auto mb-2 h-10 w-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center">
                    <BookOpen className="h-5 w-5 text-slate-400" />
                  </div>
                  <p className="text-sm">Sem histórico de matrículas</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {historico.map((mat, idx) => (
                    <div
                      key={`${mat.numero_matricula ?? "mat"}-${idx}`}
                      className="rounded-xl border border-slate-200 bg-white p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-900 truncate">
                            {mat.ano_letivo ?? "—"}
                          </div>
                          <div className="mt-1 text-sm text-slate-700 font-medium truncate">
                            {mat.turma || "Sem turma definida"}
                          </div>
                          <div className="mt-2 text-xs text-slate-500 flex flex-wrap gap-2">
                            <span>{mat.turno ? `Turno ${mat.turno}` : "Turno —"}</span>
                            <span className="text-slate-300">•</span>
                            <span>Mat: {mat.numero_matricula || "—"}</span>
                          </div>
                        </div>

                        <StatusPill status={mat.status} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Col 3 */}
          <div className="space-y-6">
            <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <SectionHeader
                icon={Wallet}
                title="Situação Financeira"
                action={
                  <Link
                    href={`/financeiro?aluno=${id}`}
                    className="text-xs font-semibold text-slate-600 hover:text-slate-900 underline-offset-4 hover:underline"
                  >
                    Extrato
                  </Link>
                }
              />

              <div className="grid grid-cols-2 gap-3 mb-6">
                <SummaryCard title="Em Atraso" value={kwanza.format(financeiro.total_em_atraso ?? 0)} />
                <SummaryCard title="Pago" value={kwanza.format(financeiro.total_pago ?? 0)} />
              </div>

              <div className="space-y-3">
                <h4 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Últimas Cobranças
                </h4>

                {mensalidades.slice(0, 4).map((fat) => (
                  <div
                    key={fat.id ?? `${fat.ano}-${fat.mes}-${fat.status}`}
                    className="flex items-center justify-between gap-4 p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900 capitalize truncate">
                        {monthName(fat.mes)}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {fat.ano ?? "—"} • {fat.status || "—"}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-sm font-semibold text-slate-900">
                        {kwanza.format(fat.valor ?? 0)}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {fat.vencimento ? `Venc. ${formatDate(fat.vencimento)}` : "Venc. —"}
                      </div>
                    </div>
                  </div>
                ))}

                {mensalidades.length === 0 && (
                  <div className="text-center py-6 text-slate-500 text-sm bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    Nenhuma cobrança registrada.
                  </div>
                )}
              </div>
            </section>

            {/* Balcão rápido (encapsulado, visual neutro) */}
            <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <SectionHeader icon={BarChart3} title="Balcão Rápido" />
              <div className="mt-4 [&_button]:w-full [&_button]:justify-center">
                <AcoesRapidasBalcao
                  alunoId={id}
                  alunoNome={alunoNome}
                  alunoTurma={historico[0]?.turma || null}
                  alunoBI={perfil.bi_numero || null}
                  mensalidades={mensalidades.map((m) => ({
                    id: m.id || "",
                    mes: m.mes || 0,
                    ano: m.ano || 0,
                    valor: m.valor || 0,
                    status: m.status || "pendente",
                    vencimento: m.vencimento || undefined,
                  }))}
                />
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
