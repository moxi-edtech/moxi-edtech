import { BookOpen, CheckCircle2, CreditCard, MapPin, Phone, TrendingDown, Users, Wallet } from "lucide-react";
import { StatusPill } from "@/components/ui/StatusPill";
import { formatDate, formatKwanza, monthName } from "@/lib/formatters";
import type { AlunoNormalizado, DossierMensalidade } from "@/lib/aluno/types";

export function DossierPerfilSection({ aluno }: { aluno: AlunoNormalizado }) {
  const p = aluno.perfil;
  return <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm"><div><CreditCard size={12} className="inline" /> BI: {p.bi_numero ?? "—"}</div><div><Users size={12} className="inline" /> Resp: {p.responsavel_nome ?? "—"}</div><div><Phone size={12} className="inline" /> Contacto: {p.responsavel_tel ?? "—"}</div><div><MapPin size={12} className="inline" /> Endereço: {p.endereco ?? "—"}</div><div><BookOpen size={12} className="inline" /> Processo: {p.numero_processo ?? "—"}</div><div>Nascimento: {formatDate(p.data_nascimento)}</div></div>;
}

function MensalidadeRow({ m }: { m: DossierMensalidade }) {
  return <div className="flex items-center justify-between border border-slate-200 rounded-xl p-3"><div><p className="font-semibold capitalize">{monthName(m.mes)} {m.ano}</p><p className="text-xs text-slate-400">{m.vencimento ? `Venc. ${formatDate(m.vencimento)}` : "Sem vencimento"}</p></div><div className="text-right"><p className="font-bold">{formatKwanza(m.valor)}</p>{m.saldo > 0 && <p className="text-xs text-rose-600">Saldo: {formatKwanza(m.saldo)}</p>}</div><StatusPill status={m.status} variant="financeiro" size="xs" /></div>;
}

export function DossierFinanceiroSection({ aluno }: { aluno: AlunoNormalizado }) {
  const f = aluno.financeiro;
  return <div className="space-y-4"><div className="grid grid-cols-2 gap-3"><div className="rounded-xl border border-slate-200 p-4"><p className="text-xs text-slate-400">Em atraso</p><p className="text-xl font-black">{formatKwanza(f.total_em_atraso)}</p></div><div className="rounded-xl border border-slate-200 p-4"><p className="text-xs text-slate-400">Total pago</p><p className="text-xl font-black text-[#1F6B3B]">{formatKwanza(f.total_pago)}</p></div></div>{f.situacao === "em_dia" ? <div className="rounded-xl border border-[#1F6B3B]/20 bg-[#1F6B3B]/5 p-3 text-xs text-[#1F6B3B]"><CheckCircle2 size={14} className="inline mr-1" /> Situação regular</div> : <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700"><TrendingDown size={14} className="inline mr-1" /> {f.mensalidades_atrasadas.length} mensalidades em atraso</div>}<div className="space-y-2">{f.mensalidades.length ? f.mensalidades.map((m) => <MensalidadeRow key={m.id} m={m} />) : <div className="text-center py-6 text-slate-400"><Wallet className="mx-auto mb-2" />Sem cobranças.</div>}</div></div>;
}

export function DossierHistoricoSection({ aluno }: { aluno: AlunoNormalizado }) {
  if (!aluno.historico.length) return <div className="text-center py-6 text-slate-400">Sem histórico de matrículas.</div>;
  return <div className="space-y-3">{aluno.historico.map((mat, idx) => <div key={mat.numero_matricula ?? idx} className={`rounded-xl border p-4 ${mat.is_atual ? "border-[#1F6B3B]/20 bg-[#1F6B3B]/5" : "border-slate-200"}`}><div className="flex justify-between"><div><p className="font-black">{mat.ano_letivo}</p><p className="text-sm">{mat.turma}</p></div><StatusPill status={mat.status} variant="matricula" size="xs" /></div></div>)}</div>;
}
