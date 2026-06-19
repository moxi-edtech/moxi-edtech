"use client";

import Link from "next/link";
import { CheckCircle2, FileText, TrendingDown, Wallet, Printer } from "lucide-react";
import { StatusPill } from "@/components/ui/StatusPill";
import { formatDate, formatKwanza, monthName } from "@/lib/formatters";
import type { AlunoNormalizado, DossierMensalidade } from "@/lib/aluno/types";
import type { DossierRole } from "@/components/aluno/DossierAcoes";
import { DossierHistoricoTimelineSection } from "@/components/aluno/DossierHistoricoTimelineSection";
import { DossierHistoricoTransitadoSection as DossierHistoricoTransitadoSectionClient } from "@/components/aluno/DossierHistoricoTransitadoSection";
import { QuickEditField } from "@/components/aluno/QuickEditField";
import { useToast } from "@/components/feedback/FeedbackSystem";
import { PushSettings } from "@/components/aluno/PushSettings";
import { ReverterPagamentoButton } from "@/components/financeiro/ReverterPagamentoButton";

export function DossierPerfilSection({ aluno }: { aluno: AlunoNormalizado }) {
  const p = aluno.perfil;
  const matricula = aluno.matricula_atual;

  const renderValue = (value?: string | null) =>
    value ? (
      <span className="text-sm font-medium text-slate-700">{value}</span>
    ) : (
      <span className="text-xs text-slate-400 italic">Não preenchido</span>
    );

  const nascimento = formatDate(p.data_nascimento);
  const nascimentoValue = nascimento === "—" ? null : nascimento;
  const turmaValue = matricula?.turma ?? null;
  const anoLetivoValue = matricula?.ano_letivo ?? null;
  const estadoMatricula = matricula?.status ?? null;

  return (
    <div className="space-y-4">
      <PushSettings escolaId={aluno.perfil.escola_id} />
      
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">
          Identificação
        </p>
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">BI</p>
            {renderValue(p.bi_numero)}
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Processo</p>
            {renderValue(p.numero_processo)}
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Nascimento</p>
            {renderValue(nascimentoValue)}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">
          Contacto
        </p>
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Responsável</p>
            <QuickEditField
              label="Nome do Responsável"
              value={p.responsavel_nome}
              fieldName="responsavel"
              alunoId={aluno.id}
            />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Contacto</p>
            <QuickEditField
              label="Telefone do Responsável"
              value={p.responsavel_tel}
              fieldName="telefone_responsavel"
              alunoId={aluno.id}
              type="tel"
            />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Endereço</p>
            <QuickEditField
              label="Endereço"
              value={p.endereco}
              fieldName="endereco"
              alunoId={aluno.id}
            />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">
          Académico
        </p>
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Turma</p>
            {renderValue(turmaValue)}
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Ano lectivo</p>
            {renderValue(anoLetivoValue)}
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Estado matrícula</p>
            {renderValue(estadoMatricula)}
          </div>
        </div>
      </div>
    </div>
  );
}

function MensalidadeRow({
  m,
  canReprint,
  canReverse,
  onMissingRecibo,
}: {
  m: DossierMensalidade;
  canReprint: boolean;
  canReverse: boolean;
  onMissingRecibo: () => void;
}) {
  const vencimentoLabel = m.vencimento ? formatDate(m.vencimento) : null;
  const vencimentoDate = m.vencimento ? new Date(m.vencimento) : null;
  const today = new Date();
  const daysDiff = vencimentoDate
    ? Math.ceil((vencimentoDate.getTime() - today.setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24))
    : null;
  const isOverdue = typeof daysDiff === "number" && daysDiff < 0;
  const vencimentoInfo = vencimentoLabel
    ? isOverdue
      ? `Atraso ${Math.abs(daysDiff ?? 0)} dia(s)`
      : `Vence ${vencimentoLabel}`
    : null;

  return (
      <div className="grid gap-3 rounded-xl border border-slate-200 p-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto_auto] md:items-center">
      <div>
        <p className="font-semibold text-slate-900 capitalize">
          {monthName(m.mes)} {m.ano}
        </p>
        <p className="text-xs text-slate-400">
          {m.vencimento ? `Venc. ${vencimentoLabel}` : "Sem vencimento"}
        </p>
      </div>
      <div className="text-right">
        <p className="font-bold text-slate-900">{formatKwanza(m.valor)}</p>
        {m.saldo > 0 && (
          <p className="text-xs text-rose-600">Saldo pendente: {formatKwanza(m.saldo)}</p>
        )}
      </div>
      <div className="md:justify-self-end text-right">
        <StatusPill status={m.status} variant="financeiro" size="xs" />
        {vencimentoInfo && (
          <p className={`mt-1 text-[10px] font-semibold ${isOverdue ? "text-rose-600" : "text-slate-400"}`}>
            {vencimentoInfo}
          </p>
        )}
      </div>
      <div className="flex flex-wrap justify-end gap-2 md:justify-self-end">
        {m.status === "pago" ? (
          <button
            type="button"
            disabled={!canReprint}
            title={
              !canReprint
                ? "Permissão restrita: secretaria/financeiro"
                : m.recibo_id
                  ? "Reimprimir recibo"
                  : "Recibo indisponível"
            }
            onClick={() => {
              if (!canReprint) return;
              if (!m.recibo_id) return onMissingRecibo();
              window.open(`/secretaria/documentos/${m.recibo_id}/recibo/print`, "_blank", "noopener,noreferrer");
            }}
            className="group inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 shadow-sm transition-colors hover:text-klasse-gold disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Printer className="h-4 w-4 text-slate-400 transition-colors group-hover:text-klasse-gold" />
            Reimprimir
          </button>
        ) : null}
        {canReverse && m.pagamento_reversivel_id ? (
          <ReverterPagamentoButton
            pagamentoId={m.pagamento_reversivel_id}
            label="Reverter"
            compact
          />
        ) : null}
      </div>
    </div>
  );
}

export function DossierFinanceiroSection({ aluno, role }: { aluno: AlunoNormalizado; role: DossierRole }) {
  const { error } = useToast();
  const canReprint = role === "secretaria";
  const canReverse = role === "secretaria";
  const f = aluno.financeiro;
  const atrasado = f.situacao === "inadimplente";
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">
          Resumo financeiro
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          <div className={`rounded-2xl border p-4 shadow-sm ${atrasado ? "bg-rose-50 border-rose-100" : "bg-slate-50 border-slate-200"}`}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Em atraso</p>
            <p className={`mt-1 text-2xl font-bold ${atrasado ? "text-rose-600" : "text-slate-900"}`}>
              {formatKwanza(f.total_em_atraso)}
            </p>
            <p className="text-xs text-slate-500 mt-1">Valores com cobrança pendente.</p>
          </div>
          <div className="rounded-2xl border border-[#1F6B3B]/20 bg-[#1F6B3B]/5 p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Total pago</p>
            <p className="mt-1 text-2xl font-bold text-[#1F6B3B]">{formatKwanza(f.total_pago)}</p>
            <p className="text-xs text-[#1F6B3B]/70 mt-1">Resumo de pagamentos.</p>
          </div>
        </div>
      </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
        {f.situacao === "em_dia" ? (
          <div className="rounded-xl border border-[#1F6B3B]/20 bg-[#1F6B3B]/5 p-3 text-xs text-[#1F6B3B]">
            <CheckCircle2 size={14} className="inline mr-1" /> Situação regular
          </div>
        ) : (
          <div className="rounded-xl border border-rose-100 bg-rose-50 p-3 text-xs text-rose-600">
            <TrendingDown size={14} className="inline mr-1" /> {f.mensalidades_atrasadas.length} mensalidades em atraso
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">
          Mensalidades
        </p>
        {f.mensalidades.length ? (
          <div className="space-y-2">
            <div className="hidden md:grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto_auto] text-[10px] font-bold uppercase tracking-widest text-slate-400 px-3">
              <span>Mês</span>
              <span className="text-right">Valor</span>
              <span className="text-right">Estado</span>
              <span className="text-right">Ação</span>
            </div>
            {f.mensalidades.map((m) => (
              <MensalidadeRow
                key={m.id}
                m={m}
                canReprint={canReprint}
                canReverse={canReverse}
                onMissingRecibo={() =>
                  error("Recibo indisponível", "Não existe documento emitido vinculado para esta mensalidade.")
                }
              />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
            <Wallet className="mx-auto mb-2" />Sem cobranças.
          </div>
        )}
      </div>
    </div>
  );
}

export function DossierHistoricoSection({
  alunoId,
  role,
  escolaId,
}: {
  aluno: AlunoNormalizado;
  alunoId: string;
  role: DossierRole;
  escolaId?: string | null;
}) {
  return <DossierHistoricoTimelineSection alunoId={alunoId} role={role} escolaId={escolaId} />;
}

export function DossierHistoricoTransitadoSection({
  alunoId,
  canEdit = true,
}: {
  alunoId: string;
  canEdit?: boolean;
}) {
  return <DossierHistoricoTransitadoSectionClient alunoId={alunoId} canEdit={canEdit} />;
}

export function DossierDocumentosSection({ alunoId }: { alunoId: string }) {
  const actions = [
    { title: "Declaração", subtitle: "Frequência", tipo: "declaracao_frequencia" },
    { title: "Declaração", subtitle: "Notas", tipo: "declaracao_notas" },
    { title: "Ficha", subtitle: "Aluno", tipo: "ficha_aluno" },
  ];

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Documentos</p>
        <div className="grid gap-3 md:grid-cols-3">
          {actions.map((item) => (
            <Link
              key={item.tipo}
              href={`/secretaria/documentos?alunoId=${alunoId}&tipo=${item.tipo}`}
              className="rounded-2xl border border-slate-200 bg-white p-4 text-left transition-all hover:border-[#1F6B3B]/30 hover:shadow-sm"
            >
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-slate-500">
                <FileText size={18} />
              </div>
              <p className="text-sm font-semibold text-slate-900">{item.title}</p>
              <p className="text-xs text-slate-500">{item.subtitle}</p>
              <span className="mt-3 inline-block text-xs font-semibold text-[#1F6B3B] underline">
                Solicitar
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
