"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, Loader2, ClipboardList, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/components/feedback/FeedbackSystem";

type CobrancaBolsa = {
  competencia: string;
  competencia_parcial: string;
  parcial_elegivel: boolean;
  percentual_anterior: number;
  valor_aberto: number;
  valor_original: number;
  status: string;
  bolsa_isencao_integral: boolean;
  elegivel: boolean;
  parcial_possivel: boolean;
  requer_revisao: boolean;
  motivo_revisao: string | null;
};
type EventoBolsa = {
  percentagem: number | null;
  em: string | null; acao: string; inicio: string | null; motivo: string | null;
  justificativa: string | null; isentas: number; revisoes: number; atribuiu: boolean;
};
const kwanza = new Intl.NumberFormat("pt-AO", { style: "currency", currency: "AOA", maximumFractionDigits: 0 });
function mesAngola(): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Africa/Luanda", year: "numeric", month: "2-digit",
  }).format(new Date());
}
function mesSeguinte(mes: string): string {
  const [ano, num] = mes.split("-").map(Number);
  return num === 12 ? `${ano + 1}-01` : `${ano}-${String(num + 1).padStart(2, "0")}`;
}

type MatriculaBolsa = {
  id: string;
  ano_letivo: number;
  status: string;
  bolseiro: boolean;
  bolsa_integral: boolean;
  bolsa_parcial_percentagem: number;
  bolsa_parcial_inicio: string | null;
  bolsa_parcial_motivo: string | null;
  desconto_comercial: boolean;
  isencao_outra_politica: boolean;
  motivo: string | null;
  vigencia_inicio: string | null;
  bolsa_ano_anterior: number | null;
  ano_inicio: string | null;
  ano_fim: string | null;
  propinas_antigas_potenciais: string[];
  previsao: CobrancaBolsa[];
  previsao_incompleta: boolean;
  historico: EventoBolsa[] | null;
};

export function BolsaIntegralCard({ alunoId, escolaId, anoLetivo }: {
  alunoId: string;
  escolaId: string;
  anoLetivo?: number | null;
}) {
  const router = useRouter();
  const { success, error: notifyError } = useToast();
  const [matricula, setMatricula] = useState<MatriculaBolsa | null>(null);
  const [motivo, setMotivo] = useState("Bolsa integral");
  const [mesVigencia, setMesVigencia] = useState("");
  const [justificativa, setJustificativa] = useState("");
  const [regularizacao, setRegularizacao] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [modalidade, setModalidade] = useState<"integral" | "parcial" | "retirar-parcial">("integral");
  const [percentagem, setPercentagem] = useState("50");
  const [avisoFiscal, setAvisoFiscal] = useState(0);
  const [avisoPagamento, setAvisoPagamento] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const endpoint = `/api/secretaria/alunos/${alunoId}/bolsa?escola_id=${encodeURIComponent(escolaId)}${anoLetivo ? `&ano_letivo=${anoLetivo}` : ""}`;

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setFailed(false);
    setConfirmando(false);
    setModalidade("integral");
    setRegularizacao(false);
    setJustificativa("");
    setAvisoFiscal(0);
    setAvisoPagamento(0);
    fetch(endpoint, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok || !payload.ok) throw new Error(payload.error ?? "Erro de consulta");
        return payload;
      })
      .then((payload) => {
        if (controller.signal.aborted) return;
        setMatricula(payload.matricula);
        setMotivo(payload.matricula?.motivo || "Bolsa integral");
      })
      .catch(() => { if (!controller.signal.aborted) setFailed(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [endpoint]);

  const mesAtual = mesAngola();
  const parcialAtiva = Number(matricula?.bolsa_parcial_percentagem ?? 0) > 0;
  const modoParcial = modalidade !== "integral";
  const retirarParcial = modalidade === "retirar-parcial";
  const taxa = retirarParcial ? 0 : Number(percentagem);
  const taxaValida = retirarParcial || (percentagem.trim() !== "" && Number.isFinite(taxa) && taxa >= 0.01 && taxa <= 99.99 && /^\d{1,2}(\.\d{1,2})?$/.test(percentagem));
  const inicioParcial = mesVigencia || (retirarParcial ? mesSeguinte(mesAtual) : mesAtual);
  const parcelasParciais = (matricula?.previsao ?? []).filter(c => c.competencia_parcial >= inicioParcial && c.percentual_anterior !== taxa);
  const parciaisElegiveis = parcelasParciais.filter(c => c.parcial_elegivel);
  const parciaisRevisao = parcelasParciais.filter(c => !c.parcial_elegivel && !["pago","cancelado","isento"].includes(c.status));
  const liquidoParcial = (c: CobrancaBolsa) => Math.max(1,Math.round(c.valor_original * (100-taxa))) / 100;
  const retroParcial = modoParcial && inicioParcial < mesAtual && !retirarParcial;
  const inicioFora = modoParcial && (!!matricula?.ano_inicio && inicioParcial < matricula.ano_inicio.slice(0,7)
    || !!matricula?.ano_fim && inicioParcial > matricula.ano_fim.slice(0,7) || retirarParcial && inicioParcial < mesAtual);

  const inicioPrevisto = mesVigencia || (matricula?.bolseiro && !regularizacao
    ? mesSeguinte(mesAtual) : mesAtual);
  const propinasNoPeriodo = (matricula?.previsao ?? []).filter(cobranca =>
    cobranca.competencia >= inicioPrevisto &&
    (!matricula?.bolseiro || regularizacao || cobranca.competencia > mesAtual));
  const atribuindo = !matricula?.bolseiro || regularizacao;
  const elegiveis = propinasNoPeriodo.filter(cobranca =>
    atribuindo ? cobranca.elegivel : cobranca.status === "isento" && cobranca.bolsa_isencao_integral);
  const parciais = propinasNoPeriodo.filter(cobranca =>
    atribuindo && cobranca.parcial_possivel && cobranca.competencia >= mesAtual);
  const paraRevisao = propinasNoPeriodo.filter(cobranca => cobranca.requer_revisao);
  const totalPrevisto = elegiveis.reduce((total, cobranca) =>
    total + (atribuindo ? cobranca.valor_aberto : cobranca.valor_original), 0);
  const retroativa = modoParcial ? retroParcial : Boolean(mesVigencia) && mesVigencia < mesAtual
    && (regularizacao || !matricula?.bolseiro);
  const possibilidadeRegularizacao = (matricula?.propinas_antigas_potenciais ?? [])
    .filter(mes => !matricula?.bolseiro ||
      (matricula.vigencia_inicio && mes < matricula.vigencia_inicio.slice(0,7)));

  async function toggleBolsa() {
    if (!matricula || saving || !confirmando) return;
    if (matricula.previsao_incompleta) {
      notifyError("Prévia incompleta", "Existem mais propinas do que o limite da consulta. Reveja antes de alterar a bolsa.");
      return;
    }
    if (modoParcial && (!taxaValida || inicioFora)) {
      notifyError("Dados inválidos", "Confirme o percentual e o mês de vigência.");
      return;
    }
    const next = modoParcial ? !retirarParcial : regularizacao ? true : !matricula.bolseiro;
    if (regularizacao && (!mesVigencia || !retroativa)) {
      notifyError("Vigência inválida", "Escolha um mês anterior para regularizar as propinas.");
      return;
    }
    if (retroativa && justificativa.trim().length < 10) {
      notifyError("Justificação obrigatória", "Explique a regularização em pelo menos 10 caracteres.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matricula_id: matricula.id, bolseiro: next,
          ...(modoParcial ? { percentagem: taxa } : {}),
          motivo: next ? motivo.trim() || (modoParcial ? "Bolsa parcial" : "Bolsa integral") : null,
          vigencia_inicio: mesVigencia ? `${mesVigencia}-01` : null,
          regularizacao_retroativa: retroativa,
          justificativa: retroativa ? justificativa.trim() : null,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Falha ao atualizar");
      const result = payload.bolsa;
      if (modoParcial) {
        setMatricula(current => current ? { ...current, bolsa_parcial_percentagem: taxa,
          bolsa_parcial_inicio: result.vigencia_inicio, bolsa_parcial_motivo: next ? motivo : null,
          previsao_incompleta: true } : null);
      } else setMatricula((current) => current ? { ...current,
        bolseiro: next, bolsa_integral: next, motivo: next ? motivo : null,
        vigencia_inicio: next ? result.vigencia_inicio : null,
        propinas_antigas_potenciais: next
          ? current.propinas_antigas_potenciais.filter(m => m < result.vigencia_inicio.slice(0,7))
          : current.propinas_antigas_potenciais,
      } : null);
      setAvisoFiscal(Number(result.pendentes_revisao_fiscal ?? 0));
      setAvisoPagamento(Number(result.pendentes_revisao_pagamento ?? 0));
      setConfirmando(false);
      setRegularizacao(false);
      setMesVigencia("");
      setJustificativa("");
      success("Bolsa atualizada", modoParcial ? `${result.alteradas ?? 0} propina(s) recalculada(s). Pagamentos preservados.` : next
        ? `Mensalidades isentas: ${result.isentas ?? 0}. Saldos parciais atuais regularizados: ${result.quitadas_parciais ?? 0}.`
        : `Cobranças futuras reabertas: ${result.reabertas ?? 0}. Histórico preservado.`);
      // Atualiza também a trilha de auditoria e a prévia após gravar.
      void fetch(endpoint, { cache: "no-store" }).then(async response => {
        const atualizado = await response.json();
        if (response.ok && atualizado.ok) setMatricula(atualizado.matricula);
      }).catch(() => {});
      router.refresh();
    } catch (e) {
      notifyError("Erro ao atualizar bolsa", e instanceof Error ? e.message : "Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-3">
        <GraduationCap className="h-5 w-5 text-klasse-green" aria-hidden="true" />
        <div>
          <h3 className="text-sm font-semibold text-klasse-green">Bolsa de estudo</h3>
          <p className="text-xs text-muted-foreground">Bolsa integral ou parcial por matrícula e ano letivo.</p>
        </div>
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground" role="status">A consultar a matrícula…</p>
      ) : failed ? (
        <p role="alert" className="text-sm text-destructive">Não foi possível consultar a bolsa. Atualize a página.</p>
      ) : !matricula ? (
        <p className="text-sm text-muted-foreground">Não existe matrícula neste ano letivo para atribuir uma bolsa.</p>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="block text-sm font-medium text-foreground">
                {matricula.bolseiro ? "Bolseiro · Bolsa integral" : parcialAtiva ? `Bolseiro · Bolsa parcial de ${matricula.bolsa_parcial_percentagem}%` : matricula.isencao_outra_politica ? "Isento por outra política" : "Sem bolsa"}
              </span>
              <span className="text-xs text-muted-foreground">
                Ano letivo {matricula.ano_letivo}/{matricula.ano_letivo + 1} · {matricula.status}
                {matricula.bolseiro && matricula.vigencia_inicio ? ` · Desde ${matricula.vigencia_inicio.slice(0,7)}` : parcialAtiva && matricula.bolsa_parcial_inicio ? ` · Desde ${matricula.bolsa_parcial_inicio.slice(0,7)}` : ""}
              </span>
            </div>
            {!confirmando && <button type="button" onClick={() => { setRegularizacao(false); setMesVigencia(""); setModalidade(parcialAtiva ? "parcial" : "integral"); setPercentagem(parcialAtiva ? String(matricula.bolsa_parcial_percentagem) : "50"); setMotivo(parcialAtiva ? matricula.bolsa_parcial_motivo || "Bolsa parcial" : matricula.motivo || "Bolsa integral"); setConfirmando(true); }} disabled={saving || matricula.isencao_outra_politica}
              className={matricula.bolseiro
                ? "inline-flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
                : "inline-flex items-center gap-2 rounded-xl bg-klasse-gold px-4 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-50"}
            >
              {matricula.bolseiro ? "Retirar bolsa" : parcialAtiva ? "Gerir bolsa" : "Atribuir bolsa"}
            </button>}
          </div>
          {!confirmando && matricula.bolseiro && possibilidadeRegularizacao.length > 0 && (
            <button type="button" onClick={() => {
              setModalidade("integral");
              setRegularizacao(true);
              setMesVigencia(possibilidadeRegularizacao[0]);
              setConfirmando(true);
            }} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-medium text-foreground hover:bg-muted">
              Regularizar propinas anteriores ({possibilidadeRegularizacao.length})
            </button>
          )}
          {!matricula.bolseiro && !parcialAtiva && matricula.bolsa_ano_anterior !== null && !matricula.isencao_outra_politica && (
            <p className="text-xs text-muted-foreground">
              O aluno teve bolsa em {matricula.bolsa_ano_anterior}/{matricula.bolsa_ano_anterior + 1}.
              Para renovar neste ano, clique em “Atribuir bolsa”. A renovação não é automática.
            </p>
          )}
          {matricula.isencao_outra_politica && (
            <p className="text-xs text-muted-foreground">Existe outra isenção de 100% nesta matrícula. Ajuste a política financeira existente antes de atribuir uma bolsa.</p>
          )}
          {confirmando && !matricula.bolseiro && !regularizacao && (
            <fieldset className="space-y-2">
              <legend className="mb-2 text-xs font-medium text-foreground">Modalidade</legend>
              {!parcialAtiva && <label className="flex items-center gap-2 text-sm"><input type="radio" name={`bolsa-tipo-${alunoId}`} checked={modalidade === "integral"} onChange={() => { setModalidade("integral"); setMotivo("Bolsa integral"); setMesVigencia(""); }} /> Bolsa integral (100%)</label>}
              <label className="flex items-center gap-2 text-sm"><input type="radio" name={`bolsa-tipo-${alunoId}`} disabled={matricula.desconto_comercial} checked={modalidade === "parcial"} onChange={() => { setModalidade("parcial"); setMotivo(matricula.bolsa_parcial_motivo || "Bolsa parcial"); setMesVigencia(""); }} /> Bolsa parcial</label>
              {parcialAtiva && <label className="flex items-center gap-2 text-sm"><input type="radio" name={`bolsa-tipo-${alunoId}`} checked={retirarParcial} onChange={() => { setModalidade("retirar-parcial"); setMesVigencia(""); }} /> Retirar bolsa parcial</label>}
              {matricula.desconto_comercial && <p className="text-xs text-muted-foreground">Existe um desconto comercial nesta matrícula. A bolsa parcial não acumula com outro desconto.</p>}
              {modalidade === "parcial" && <div>
                <label htmlFor={`bolsa-percentagem-${alunoId}`} className="mb-1 block text-xs font-medium">Percentual da bolsa (%)</label>
                <input id={`bolsa-percentagem-${alunoId}`} type="number" min="0.01" max="99.99" step="0.01" value={percentagem} onChange={e => setPercentagem(e.target.value)} className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/20" />
              </div>}
            </fieldset>
          )}
          {confirmando && (
            <p className="text-xs text-muted-foreground">
              {modoParcial ? (retirarParcial ? "Por padrão, a retirada começa no próximo mês." : "O percentual aplica-se a partir do mês escolhido. Pagamentos e documentos emitidos são preservados.") : regularizacao
                ? "A escola pode antecipar o início da bolsa e isentar propinas anteriores sem pagamento nem documento fiscal."
                : matricula.bolseiro
                ? "A retirada vale desde o próximo mês, por padrão. Preserva os meses já isentos e os pagamentos."
                : "A atribuição vale desde o mês atual, por padrão. Escolha um mês anterior para regularizar propinas não pagas."}
            </p>
          )}
          {confirmando && !retirarParcial && !matricula.bolseiro && !matricula.isencao_outra_politica && (
            <div>
              <label htmlFor="bolsa-motivo" className="mb-1 block text-xs font-medium text-foreground">Motivo (opcional)</label>
              <input id="bolsa-motivo" value={motivo} maxLength={160}
                onChange={(event) => setMotivo(event.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/20"
              />
            </div>
          )}
          {confirmando && (
            <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3">
              <label htmlFor="bolsa-vigencia" className="block text-xs font-medium text-foreground">
                {regularizacao ? "Desde que mês vale a regularização?" : "A partir de que mês?"}
              </label>
              <input id="bolsa-vigencia" type="month" value={mesVigencia}
                min={matricula.ano_inicio?.slice(0,7) ?? undefined}
                max={matricula.ano_fim?.slice(0,7) ?? undefined}
                onChange={(event) => setMesVigencia(event.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/20" />
              <p className="text-xs text-muted-foreground">
                {(matricula.bolseiro && !regularizacao) || retirarParcial
                  ? "Sem escolha: a retirada começa no próximo mês."
                  : "Sem escolha: começa neste mês. Selecione um mês anterior para regularizar propinas não pagas."}
              </p>
              {possibilidadeRegularizacao.length > 0 && !matricula.bolseiro && !retirarParcial && (
                <button type="button" onClick={() => setMesVigencia(possibilidadeRegularizacao[0])}
                  className="text-left text-xs font-medium text-klasse-green underline underline-offset-2">
                  Desde {possibilidadeRegularizacao[0]} · {possibilidadeRegularizacao.length} propina(s) antiga(s) potencialmente elegível(is)
                </button>
              )}
              <div className="rounded-xl border border-border bg-card p-3" aria-label="Prévia das propinas afetadas">
                <div className="flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-klasse-green" aria-hidden="true" />
                  <p className="text-sm font-semibold text-foreground">Prévia antes de confirmar</p>
                </div>
                {modoParcial ? (
                  <div className="space-y-2">
                    {taxaValida && !inicioFora ? <>
                      <p className="mt-1 text-xs text-muted-foreground">{parciaisElegiveis.length} propina(s) elegível(is) · {retirarParcial ? "valor integral" : `${taxa}% de bolsa`}.</p>
                      {parciaisElegiveis.slice(0,24).map(c => <div key={c.competencia_parcial} className="flex justify-between gap-3 text-xs"><span>{c.competencia_parcial}</span><span>{kwanza.format(c.valor_aberto)} → <strong>{kwanza.format(liquidoParcial(c))}</strong></span></div>)}
                      {parciaisRevisao.length > 0 && <p className="text-xs text-muted-foreground">{parciaisRevisao.length} cobrança(s) preservada(s) para revisão financeira.</p>}
                      <p className="text-xs text-muted-foreground">A base revalida as cobranças ao confirmar. A vigência também afeta futuras gerações.</p>
                    </> : <p role="alert" className="text-xs text-destructive">Confirme o percentual e a vigência.</p>}
                  </div>
                ) : <>
                <p className="mt-1 text-xs text-muted-foreground">
                  {elegiveis.length} propina(s) {atribuindo ? "potencialmente isenta(s)" : "a reabrir"} · {kwanza.format(totalPrevisto)}.
                  A operação revalida tudo na base de dados antes de guardar.
                </p>
                {elegiveis.length > 0 ? (
                  <ul className="mt-2 space-y-1">
                    {elegiveis.slice(0, 24).map(item => (
                      <li key={item.competencia} className="flex justify-between gap-3 text-xs">
                        <span>{item.competencia}</span>
                        <span className="font-medium text-klasse-green">{kwanza.format(atribuindo ? item.valor_aberto : item.valor_original)}</span>
                      </li>
                    ))}
                  </ul>
                ) : <p className="mt-2 text-xs text-muted-foreground">
                  Nenhuma propina atualmente lançada é elegível. A vigência também afeta cobranças futuras.
                </p>}
                {parciais.length > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {parciais.length} propina(s) com pagamento parcial confirmado podem ter o saldo
                    restante isento. A validação transacional decide o resultado; os pagamentos mantêm-se.
                  </p>
                )}
                {paraRevisao.length > 0 && (
                  <div className="mt-3 space-y-1 border-t border-border pt-2">
                    <p className="text-xs font-semibold text-foreground">{paraRevisao.length} cobrança(s) requer(em) revisão</p>
                    {paraRevisao.slice(0, 5).map(item => <p key={item.competencia} className="text-xs text-muted-foreground">
                      {item.competencia} · {item.motivo_revisao}. Não será alterada automaticamente.
                    </p>)}
                    <Link className="inline-flex items-center gap-1 text-xs font-semibold text-klasse-green underline"
                      href={`/escola/${escolaId}/financeiro/relatorios/reconciliacao-mensalidades?alunoId=${encodeURIComponent(alunoId)}`}>
                      Abrir reconciliação financeira <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    </Link>
                  </div>
                )}
                </>}
                {matricula.previsao_incompleta && <p role="alert" className="mt-2 text-xs text-destructive">
                  Prévia incompleta: existem mais de 300 cobranças. A alteração está bloqueada até revisão.
                </p>}
              </div>
              {retroativa && (
                <div className="space-y-2 rounded-xl border border-border bg-background p-3">
                  <p className="text-xs font-semibold text-foreground">Regularização de meses anteriores</p>
                  <p className="text-xs text-muted-foreground">
                    {modoParcial ? "Apenas propinas abertas e sem pagamentos serão recalculadas." : "Apenas mensalidades abertas e nunca pagas serão isentadas."}
                    Pagamentos parciais antigos, documentos fiscais e outras matrículas são preservados.
                  </p>
                  <label htmlFor="bolsa-justificativa" className="block text-xs font-medium text-foreground">
                    Justificação da regularização (obrigatória)
                  </label>
                  <textarea id="bolsa-justificativa" rows={2} required minLength={10} maxLength={500}
                    value={justificativa} onChange={(event) => setJustificativa(event.target.value)}
                    placeholder="Ex.: Bolsa aprovada na matrícula e não registada inicialmente"
                    className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/20" />
                  <p className="text-xs text-muted-foreground">A decisão e a justificação ficam registadas na auditoria da escola.</p>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={toggleBolsa} disabled={saving || matricula.previsao_incompleta || (modoParcial && (!taxaValida || inicioFora))}
                  className="inline-flex items-center gap-2 rounded-xl bg-klasse-gold px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                  {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                  {saving ? "A guardar…" : modoParcial ? retirarParcial ? "Confirmar retirada" : "Confirmar bolsa parcial" : regularizacao ? "Confirmar regularização" : matricula.bolseiro ? "Confirmar retirada" : retroativa ? "Atribuir e regularizar" : "Confirmar bolsa"}
                </button>
                <button type="button" disabled={saving} onClick={() => { setConfirmando(false); setRegularizacao(false); setMesVigencia(""); setJustificativa(""); }}
                  className="rounded-xl border border-border bg-background px-4 py-2 text-sm text-foreground disabled:opacity-50">
                  Cancelar
                </button>
              </div>
            </div>
          )}
          {avisoPagamento > 0 && (
            <p role="alert" className="text-sm text-foreground">
              {avisoPagamento} cobrança(s) têm pagamentos associados e precisam de revisão.
              <Link href={`/escola/${escolaId}/financeiro/relatorios/reconciliacao-mensalidades?alunoId=${encodeURIComponent(alunoId)}`} className="ml-2 font-semibold underline">Rever pagamentos</Link>
            </p>
          )}
          {avisoFiscal > 0 && (
            <p role="alert" className="text-sm text-foreground">
              {avisoFiscal} cobrança(s) têm documentos fiscais e requerem revisão financeira. Nenhum documento foi modificado.
              <Link href={`/escola/${escolaId}/financeiro/relatorios/reconciliacao-mensalidades?alunoId=${encodeURIComponent(alunoId)}`} className="ml-2 font-semibold underline">Abrir reconciliação</Link>
            </p>
          )}
          <details className="rounded-xl border border-border p-3">
            <summary className="cursor-pointer text-sm font-medium text-foreground">
              Histórico da bolsa {matricula.historico ? `(${matricula.historico.length})` : ""}
            </summary>
            {matricula.historico === null ? (
              <p className="mt-2 text-xs text-muted-foreground">Histórico indisponível para este perfil de acesso.</p>
            ) : matricula.historico.length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">Ainda não existem alterações registadas nesta matrícula.</p>
            ) : (
              <ol className="mt-3 space-y-3">
                {matricula.historico.map((evento, index) => (
                  <li key={`${evento.em}-${index}`} className="border-l-2 border-klasse-green/30 pl-3">
                    <p className="text-xs font-semibold text-foreground">
                      {evento.acao === "BOLSA_PARCIAL_ATUALIZADA" ? (evento.atribuiu ? `Bolsa parcial · ${evento.percentagem}%` : "Bolsa parcial retirada") : evento.acao === "BOLSA_INTEGRAL_NA_MATRICULA" ? "Bolsa registada na matrícula" :
                        evento.atribuiu ? "Bolsa atribuída ou regularizada" : "Bolsa retirada"}
                    </p>
                    <p className="text-xs text-muted-foreground">{evento.em ? new Date(evento.em).toLocaleString("pt-PT", {timeZone:"Africa/Luanda",day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}) : "Data indisponível"}{evento.inicio ? ` · Vigência ${evento.inicio.slice(0,7)}` : ""}</p>
                    {evento.motivo && <p className="text-xs text-muted-foreground">{evento.motivo}</p>}
                    {evento.justificativa && <p className="text-xs text-muted-foreground">Justificação: {evento.justificativa}</p>}
                    {evento.revisoes > 0 && <p className="text-xs text-muted-foreground">{evento.revisoes} ocorrência(s) encaminhadas para revisão</p>}
                  </li>
                ))}
              </ol>
            )}
          </details>
          <p className="text-xs text-muted-foreground">
            A bolsa é por matrícula e ano letivo. Pagamentos e recibos emitidos permanecem intactos.
          </p>
        </div>
      )}
    </section>
  );
}
