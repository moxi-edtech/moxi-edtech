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

const formatMoney = (value: number) =>
  new Intl.NumberFormat("pt-AO", {
    style: "currency",
    currency: "AOA",
    minimumFractionDigits: 2,
  }).format(value || 0);

function CompactField({ label, value, clamp = "one", className = "" }: CompactFieldProps) {
  const clampClass = clamp === "two" ? "line-clamp-2" : "truncate";

  return (
    <div className={`min-w-0 space-y-1 ${className}`}>
      <p className="text-[9px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`${clampClass} text-xs font-semibold leading-snug text-slate-900`} title={value}>
        {value || "—"}
      </p>
    </div>
  );
}

export default function ReciboPagamentoCompacto({
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
}: ReciboPagamentoCompactoProps) {
  const classeCurso = `${classeNome}${cursoNome ? ` - ${cursoNome}` : ""}`;
  const emissao = emitidoEm || "—";

  return (
    <div className="space-y-3 bg-white font-sans text-slate-900">
      <header className="grid grid-cols-[auto_1fr_auto] items-start gap-3 border-b border-slate-200 pb-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoUrl ?? "/insignia_med.png"}
          alt="Insígnia da República de Angola"
          className="h-12 w-12 shrink-0 object-contain"
        />

        <div className="min-w-0 space-y-1">
          <p className="line-clamp-2 text-[10px] font-bold uppercase leading-snug tracking-[0.14em] text-slate-500" title={escolaNome}>
            {escolaNome}
          </p>
          <h1 className="text-lg font-bold uppercase tracking-tight text-slate-900">Recibo de Pagamento</h1>
        </div>

        <div className="min-w-[92px] max-w-[150px] space-y-1 text-right text-[10px] leading-tight text-slate-500">
          <p className="font-bold uppercase tracking-wide text-slate-400">Nº / Emitido</p>
          <p className="truncate font-semibold text-slate-900" title={numero || "Sem número"}>
            {numero ? `Nº ${numero}` : "Sem número"}
          </p>
          <p className="line-clamp-1 font-medium text-slate-600" title={emissao}>
            {emissao}
          </p>
        </div>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="grid grid-cols-3 gap-3 border-b border-slate-200 p-3">
          <CompactField label="Aluno" value={alunoNome} clamp="two" className="col-span-3 sm:col-span-1" />
          <CompactField label="Classe / Curso" value={classeCurso} />
          <CompactField label="Turma" value={turmaNome} />
          <CompactField label="NIF / BI" value={alunoBi} />
          <CompactField label="Referência" value={referencia} />
          <CompactField label="Método" value={metodo} />
        </div>

        <div className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-slate-200 p-3">
          <div className="min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-wide text-slate-500">Valor Pago</p>
            <p className="truncate text-xl font-bold leading-tight text-klasse-gold" title={formatMoney(valorPago)}>
              {formatMoney(valorPago)}
            </p>
          </div>
          <div className="min-w-[120px] text-right">
            <p className="text-[9px] font-bold uppercase tracking-wide text-slate-500">Data Pagamento</p>
            <p className="truncate text-xs font-semibold text-slate-900" title={dataPagamento}>
              {dataPagamento}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 p-3">
          <section className="min-w-0 space-y-2">
            <p className="text-[9px] font-bold uppercase tracking-wide text-slate-500">Validação</p>
            {urlValidacao ? (
              <div className="flex min-w-0 items-center gap-3">
                <QRCode value={urlValidacao} size={60} />
                <div className="min-w-0 space-y-1">
                  <p className="line-clamp-2 max-w-[170px] text-[8px] leading-tight text-slate-500">
                    Valide este recibo no portal oficial através do QR Code.
                  </p>
                  <p className="max-w-[170px] truncate font-mono text-[8px] text-slate-500" title={publicId}>
                    ID: {publicId || "—"}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-xl border border-dashed border-slate-200 text-center text-[8px] text-slate-500">
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
            <p className="mt-2 text-[10px] font-bold uppercase text-slate-900">A Secretaria</p>
            <p className="line-clamp-1 text-[8px] italic text-slate-500">Documento processado por computador</p>
          </section>
        </div>
      </section>
    </div>
  );
}
