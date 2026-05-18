import QRCode from "react-qr-code";

export type ReciboPagamentoCompactoProps = {
  escolaNome: string;
  alunoNome: string;
  alunoBi: string;
  classeNome: string;
  cursoNome: string;
  turmaNome: string;
  referencia: string;
  metodo: string;
  valorPago: number;
  dataPagamento: string;
  numero: string | null;
  publicId: string;
  urlValidacao: string | null;
  logoUrl: string | null;
  emitidoEm?: string | null;
};

type CompactFieldProps = {
  label: string;
  value: string;
  clamp?: "one" | "two";
  className?: string;
};

type ReceiptCopyProps = ReciboPagamentoCompactoProps & {
  viaLabel: string;
};

const formatMoney = (value: number) =>
  new Intl.NumberFormat("pt-AO", {
    style: "currency",
    currency: "AOA",
    minimumFractionDigits: 2,
  }).format(value || 0);

function CompactField({ label, value, clamp = "one", className = "" }: CompactFieldProps) {
  const clampClass = clamp === "two" ? "line-clamp-2" : "truncate";

  return (
    <div className={`min-w-0 space-y-0.5 ${className}`}>
      <p className="text-[8px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`${clampClass} text-[11px] font-semibold leading-snug text-slate-900`} title={value}>
        {value || "—"}
      </p>
    </div>
  );
}

function ReceiptCopy({
  escolaNome,
  alunoNome,
  alunoBi,
  classeNome,
  cursoNome,
  turmaNome,
  referencia,
  metodo,
  valorPago,
  dataPagamento,
  numero,
  publicId,
  urlValidacao,
  logoUrl,
  emitidoEm,
  viaLabel,
}: ReceiptCopyProps) {
  const classeCurso = `${classeNome}${cursoNome ? ` - ${cursoNome}` : ""}`;
  const emissao = emitidoEm || "—";
  const valorFormatado = formatMoney(valorPago);

  return (
    <article className="space-y-2 rounded-xl border border-slate-200 bg-white p-3 font-sans text-slate-900">
      <header className="grid grid-cols-[auto_1fr_auto] items-start gap-3 border-b border-slate-200 pb-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoUrl ?? "/insignia_med.png"}
          alt="Insígnia da República de Angola"
          className="h-10 w-10 shrink-0 object-contain"
        />

        <div className="min-w-0 space-y-0.5">
          <p className="line-clamp-1 text-[9px] font-bold uppercase leading-snug tracking-[0.12em] text-slate-500" title={escolaNome}>
            {escolaNome}
          </p>
          <h1 className="text-base font-bold uppercase tracking-tight text-slate-900">Recibo de Pagamento</h1>
          <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">{viaLabel}</p>
        </div>

        <div className="min-w-[92px] max-w-[145px] space-y-0.5 text-right text-[9px] leading-tight text-slate-500">
          <p className="font-bold uppercase tracking-wide text-slate-400">Nº / Emitido</p>
          <p className="truncate font-semibold text-slate-900" title={numero || "Sem número"}>
            {numero ? `Nº ${numero}` : "Sem número"}
          </p>
          <p className="line-clamp-1 font-medium text-slate-600" title={emissao}>
            {emissao}
          </p>
        </div>
      </header>

      <section className="grid grid-cols-3 gap-x-3 gap-y-2 border-b border-slate-200 pb-2">
        <CompactField label="Aluno" value={alunoNome} clamp="two" />
        <CompactField label="Classe / Curso" value={classeCurso} />
        <CompactField label="Turma" value={turmaNome} />
        <CompactField label="NIF / BI" value={alunoBi} />
        <CompactField label="Referência" value={referencia} />
        <CompactField label="Método" value={metodo} />
      </section>

      <section className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-slate-200 pb-2">
        <div className="min-w-0">
          <p className="text-[8px] font-bold uppercase tracking-wide text-slate-500">Valor Pago</p>
          <p className="truncate text-lg font-bold leading-tight text-klasse-gold" title={valorFormatado}>
            {valorFormatado}
          </p>
        </div>
        <div className="min-w-[120px] text-right">
          <p className="text-[8px] font-bold uppercase tracking-wide text-slate-500">Data Pagamento</p>
          <p className="truncate text-[11px] font-semibold text-slate-900" title={dataPagamento}>
            {dataPagamento}
          </p>
        </div>
      </section>

      <footer className="grid grid-cols-2 gap-4">
        <section className="min-w-0 space-y-1">
          <p className="text-[8px] font-bold uppercase tracking-wide text-slate-500">Validação</p>
          {urlValidacao ? (
            <div className="flex min-w-0 items-center gap-2.5">
              <QRCode value={urlValidacao} size={56} />
              <div className="min-w-0 space-y-0.5">
                <p className="line-clamp-2 max-w-[170px] text-[8px] leading-tight text-slate-500">
                  Valide este recibo no portal oficial através do QR Code.
                </p>
                <p className="max-w-[170px] truncate font-mono text-[8px] text-slate-500" title={publicId}>
                  ID: {publicId || "—"}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-dashed border-slate-200 text-center text-[8px] text-slate-500">
                QR indisponível
              </div>
              <p className="max-w-[170px] truncate font-mono text-[8px] text-slate-500" title={publicId}>
                ID: {publicId || "—"}
              </p>
            </div>
          )}
        </section>

        <section className="flex min-w-0 flex-col justify-end text-center">
          <div className="border-b border-slate-200 pb-1" />
          <p className="mt-2 text-[9px] font-bold uppercase text-slate-900">A Secretaria</p>
          <p className="line-clamp-1 text-[8px] italic text-slate-500">Documento processado por computador</p>
        </section>
      </footer>
    </article>
  );
}

export default function ReciboPagamentoCompacto(props: ReciboPagamentoCompactoProps) {
  return (
    <div className="space-y-3 bg-white text-slate-900">
      <ReceiptCopy {...props} viaLabel="Via do Aluno / Encarregado" />
      <div className="flex items-center gap-2 text-[8px] font-semibold uppercase tracking-[0.18em] text-slate-400" aria-hidden="true">
        <span className="h-px flex-1 border-t border-dashed border-slate-300" />
        <span>Cortar aqui</span>
        <span className="h-px flex-1 border-t border-dashed border-slate-300" />
      </div>
      <ReceiptCopy {...props} viaLabel="Via da Secretaria" />
    </div>
  );
}
