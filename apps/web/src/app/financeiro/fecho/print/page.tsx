import PrintTrigger from "./PrintTrigger";
import styles from "./print.module.css";
import { getFechoCaixaData } from "@/lib/financeiro/fecho";

const formatKz = (value: number) =>
  new Intl.NumberFormat("pt-AO", { style: "currency", currency: "AOA" }).format(value || 0);

export const dynamic = "force-dynamic";

export default async function FechoPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; operador_id?: string }>;
}) {
  const params = await searchParams;
  const data = await getFechoCaixaData({
    date: params.date ?? null,
    operadorId: params.operador_id ?? null,
  });

  if (!data.ok) {
    return <div className="p-6">{data.error}</div>;
  }

  const now = new Date();
  const time = now.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className={`min-h-screen ${styles.printRoot} font-sans text-slate-900`}>
      <PrintTrigger />
      <div className={`${styles.receipt} shadow-lg`}>
        <div className="space-y-5">
          <header className="text-center space-y-1">
            <h1 className="text-lg font-semibold">{data.escola_nome}</h1>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Fecho de Caixa Diário</p>
          </header>

          <section className="text-xs text-slate-600 space-y-1">
            <p>Data: {data.date}</p>
            <p>Hora de emissão: {time}</p>
            <p>Operador: {data.operador_label}</p>
          </section>

          <section>
            <table className="w-full text-xs">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="text-left py-2">Método</th>
                  <th className="text-right py-2">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="py-2">Espécie</td>
                  <td className="py-2 text-right font-semibold">{formatKz(data.totals.especie)}</td>
                </tr>
                <tr>
                  <td className="py-2">TPA</td>
                  <td className="py-2 text-right font-semibold">{formatKz(data.totals.tpa)}</td>
                </tr>
                <tr>
                  <td className="py-2">Transferência</td>
                  <td className="py-2 text-right font-semibold">{formatKz(data.totals.transferencia)}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-300">
                  <td className="py-2 font-semibold">Total Geral</td>
                  <td className="py-2 text-right font-semibold">{formatKz(data.totals.total)}</td>
                </tr>
              </tfoot>
            </table>
          </section>

          <section className="space-y-3 pt-4 text-xs">
            <div>
              <p className="text-slate-500">Entregue por</p>
              <div className="mt-4 h-8 border-b border-slate-400" />
            </div>
            <div>
              <p className="text-slate-500">Conferido por</p>
              <div className="mt-4 h-8 border-b border-slate-400" />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
