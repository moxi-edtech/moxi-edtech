'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import { Copy, Loader2, ReceiptText, RefreshCw } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type Reference = { id: string; entity: string; reference: string; amount: number; currency: string; expires_at: string; status: string };
type Preview = { amount: number; environment: 'production' | 'sandbox'; canIssue: boolean; reference: Reference | null; message?: string };
type Props = { escolaId: string; mensalidadeId: string; alunoNome: string; descricao: string; onPaid?: (mensalidadeId: string) => void; student?: { id?: string | null; kind: 'monthly' | 'service' } };
function api(props: Props) {
  if (!props.student) return { status: '/api/financeiro/appypay/status',
    preview: `/api/financeiro/appypay/references?obligationId=${encodeURIComponent(props.mensalidadeId)}`,
    issue: '/api/financeiro/appypay/references', check: '/api/financeiro/appypay/reconcile',
    issueBody: { obligationId: props.mensalidadeId }, checkBody: {} };
  const base = '/api/aluno/financeiro/appypay';
  const scope = { ...(props.student.id ? { studentId: props.student.id } : {}), kind: props.student.kind, targetId: props.mensalidadeId };
  return { status: `${base}?${new URLSearchParams({ action: 'status', ...(props.student.id ? { studentId: props.student.id } : {}) })}`,
    preview: `${base}?${new URLSearchParams({ action: 'preview', ...scope })}`, issue: base, check: base,
    issueBody: { action: 'issue', ...scope }, checkBody: { action: 'check', ...scope } };
}
const deadline = (value: string) => `${new Date(value).toLocaleString('pt-AO', { timeZone: 'Africa/Luanda' })} (hora de Angola)`;
const money = (amount: number) => new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(amount);
const button = 'inline-flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 disabled:cursor-not-allowed disabled:opacity-50';
async function requestJson(url: string, escolaId: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, credentials: 'same-origin', cache: 'no-store', signal: init?.signal ?? AbortSignal.timeout(30_000),
    headers: { 'Content-Type': 'application/json', 'x-escola-id': escolaId, ...init?.headers } });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body) throw new Error(body?.error || 'Não foi possível consultar o pagamento. Tente consultar novamente.');
  return body;
}
function ReferenceDialog({ escolaId, mensalidadeId, alunoNome, descricao, onPaid, onClose, restoreFocus, student }: Props & { onClose: () => void; restoreFocus: () => void }) {
  const router = useRouter();
  const paths = api({ escolaId, mensalidadeId, alunoNome, descricao, student });
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState<'load' | 'create' | 'check' | null>('load');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const locked = useRef(false);
  const mounted = useRef(true);
  const load = useCallback(async (signal?: AbortSignal) => {
    setBusy('load'); setError('');
    try {
      const body = await requestJson(paths.preview, escolaId, { signal });
      if (mounted.current && !signal?.aborted) { setPreview(body); setUncertain(false); }
    } catch (e) {
      if (mounted.current && !signal?.aborted) setError(e instanceof Error ? e.message : 'Consulta indisponível.');
    } finally { if (mounted.current && !signal?.aborted) setBusy(null); }
  }, [escolaId, paths.preview]);
  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    void load(controller.signal);
    return () => { mounted.current = false; controller.abort(); };
  }, [load]);
  async function create() {
    if (locked.current || !preview?.canIssue || uncertain) return;
    locked.current = true; setBusy('create'); setError(''); setNotice('');
    try {
      const body = await requestJson(paths.issue, escolaId, { method: 'POST', body: JSON.stringify({ ...paths.issueBody, expectedAmount: preview.amount }) });
      if (mounted.current) setPreview({ ...preview, canIssue: false, reference: body.reference });
    } catch (e) {
      if (mounted.current) { setUncertain(true); setError(`${e instanceof Error ? e.message : 'Emissão indisponível.'} Consulte o estado antes de voltar a emitir.`); }
    } finally { locked.current = false; if (mounted.current) setBusy(null); }
  }
  async function check() {
    if (locked.current || !preview?.reference) return;
    locked.current = true; setBusy('check'); setError(''); setNotice('');
    try {
      const body = await requestJson(paths.check, escolaId, { method: 'POST', body: JSON.stringify({ ...paths.checkBody, referenceId: preview.reference.id }) });
      if (!mounted.current) return;
      if (body.status === 'reconciled') {
        setPreview({ ...preview, reference: { ...preview.reference, status: 'paid' } });
        setNotice('Pagamento confirmado e registado.'); onPaid?.(mensalidadeId); router.refresh();
      } else setNotice(body.status === 'manual_review' ? 'O pagamento precisa de conferência pela tesouraria.' : 'O pagamento ainda não foi confirmado.');
    } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : 'Verificação indisponível.'); }
    finally { locked.current = false; if (mounted.current) setBusy(null); }
  }
  const reference = preview?.reference;
  const issued = reference && reference.entity && ['active', 'paid'].includes(reference.status);
  const expired = reference && new Date(reference.expires_at).getTime() <= Date.now();
  async function copy() {
    if (!reference) return;
    try {
      await navigator.clipboard.writeText(`Entidade: ${reference.entity}\nReferência: ${reference.reference}\nValor: ${money(reference.amount)}\nVencimento: ${deadline(reference.expires_at)}`);
      setNotice('Dados copiados.');
    } catch { setError('Não foi possível copiar. Selecione os dados da referência para os copiar.'); }
  }
  return <Dialog open onOpenChange={open => { if (!open && busy !== 'create') onClose(); }}>
    <DialogContent onCloseAutoFocus={event => { event.preventDefault(); restoreFocus(); }} className="max-h-[90vh] overflow-y-auto bg-card text-foreground" closeButton={busy !== 'create'}>
      <DialogHeader>
        <DialogTitle>Pagamento por referência</DialogTitle>
        <DialogDescription>{alunoNome} · {descricao}</DialogDescription>
      </DialogHeader>
      <div aria-busy={Boolean(busy)}>
        {busy === 'load' ? <p role="status" className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />A consultar a mensalidade…</p> : null}
        {preview && !issued ? <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Saldo a pagar</p><p className="text-2xl font-bold">{money(preview.amount)}</p>
          {preview.canIssue && !uncertain ? <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{preview.environment === 'production' ? 'Esta ação cria uma cobrança real. O pagamento só será registado após confirmação.' : 'Ambiente de testes: esta referência simula uma cobrança.'}</p>
            : <p className="text-sm text-muted-foreground">{uncertain ? 'O resultado da emissão ainda não foi confirmado. Consulte o estado antes de tentar novamente.' : preview.message || (reference?.status === 'pending' ? 'A emissão está em processamento. Consulte novamente; não crie outra cobrança.' : reference ? 'Esta referência precisa de revisão pela tesouraria antes de nova emissão.' : 'Esta mensalidade não está disponível para emissão.')}</p>}
        </div> : null}
        {issued ? <div className="space-y-4">
          <p className={`rounded-lg p-3 text-sm font-semibold ${reference.status === 'paid' ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'}`}>{reference.status === 'paid' ? 'Pagamento confirmado' : expired ? 'Referência vencida — verificar com a tesouraria' : 'Referência emitida — a aguardar pagamento'}</p>
          <dl className="grid grid-cols-2 gap-4 rounded-xl border border-border p-4">
            <div><dt className="text-sm text-muted-foreground">Entidade</dt><dd className="select-all font-mono text-lg font-semibold">{reference.entity}</dd></div>
            <div><dt className="text-sm text-muted-foreground">Referência</dt><dd className="select-all font-mono text-lg font-semibold">{reference.reference}</dd></div>
            <div><dt className="text-sm text-muted-foreground">Valor</dt><dd className="font-semibold">{money(reference.amount)}</dd></div>
            <div><dt className="text-sm text-muted-foreground">Vencimento</dt><dd className="text-sm">{deadline(reference.expires_at)}</dd></div>
          </dl>
        </div> : null}
        {error ? <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        <p role="status" aria-live="polite" className="mt-3 text-sm text-muted-foreground">{notice}</p>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className={button} onClick={onClose} disabled={busy === 'create'}>Fechar</button>
        {issued ? <>
          <button type="button" className={button} onClick={copy} disabled={Boolean(busy)}><Copy className="h-4 w-4" aria-hidden="true" />Copiar dados</button>
          {reference.status !== 'paid' ? <button type="button" className={button} onClick={check} disabled={Boolean(busy)}><RefreshCw className={`h-4 w-4 ${busy === 'check' ? 'animate-spin' : ''}`} aria-hidden="true" />Verificar pagamento</button> : null}
        </> : preview?.canIssue && !uncertain ? <button type="button" className={`${button} border-amber-500 bg-amber-500 text-amber-950 hover:bg-amber-400`} onClick={create} disabled={Boolean(busy)}>{busy === 'create' ? 'A emitir…' : `Gerar referência de ${money(preview.amount)}`}</button>
          : <button type="button" className={button} onClick={() => load()} disabled={Boolean(busy)}>Consultar estado</button>}
      </div>
    </DialogContent>
  </Dialog>;
}
export function AppyPayReferenceButton(props: Props) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const paths = api(props);
  const { data } = useSWR(props.escolaId || props.student ? [paths.status, props.escolaId] : null,
    ([url, school]: [string, string]) => requestJson(url, school), { revalidateOnFocus: true, shouldRetryOnError: false });
  if (!data?.enabled) return null;
  return <>
    <button ref={trigger} type="button" className={button} onClick={() => setOpen(true)}><ReceiptText className="h-4 w-4" aria-hidden="true" />{props.student ? 'Pagar com AppyPay' : 'Gerar referência'}</button>
    {open ? <ReferenceDialog key={`${props.escolaId}:${props.mensalidadeId}`} {...props} onClose={() => setOpen(false)} restoreFocus={() => trigger.current?.focus()} /> : null}
  </>;
}

export function StudentAppyPayButton({ targetId, kind, studentId, descricao, onPaid }: {
  targetId: string; kind: 'monthly' | 'service'; studentId?: string | null; descricao: string; onPaid?: () => void;
}) {
  return <AppyPayReferenceButton escolaId="" mensalidadeId={targetId} alunoNome="Pagamento escolar" descricao={descricao}
    student={{ id: studentId, kind }} onPaid={onPaid} />;
}
