"use client";

import { useEffect, useState } from "react";
import { Wallet, Receipt, BadgePercent, Loader2 } from "lucide-react";

const moneyAOA = new Intl.NumberFormat("pt-AO", {
  style: "currency",
  currency: "AOA",
});

export function ResumoCaixaSecretaria({ escolaId }: { escolaId: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/secretaria/balcao/resumo-caixa?escolaId=${escolaId}`)
      .then((r) => r.json())
      .then((j) => {
        if (j?.ok) setData(j);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [escolaId]);

  if (loading) return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {[1, 2, 3].map(i => (
        <div key={i} className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm h-20 animate-pulse flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-slate-50 shrink-0" />
          <div className="space-y-2 flex-1">
             <div className="h-2 bg-slate-50 rounded w-20" />
             <div className="h-4 bg-slate-50 rounded w-24" />
          </div>
        </div>
      ))}
    </div>
  );

  if (!data) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <Card 
        title="Cobrado Hoje (Por Mim)" 
        value={moneyAOA.format(data.cobrado_hoje)} 
        icon={<Wallet size={16} className="text-emerald-600" />} 
        bgColor="bg-emerald-50"
      />
      <Card 
        title="Recibos Emitidos" 
        value={data.recibos_emitidos} 
        icon={<Receipt size={16} className="text-blue-600" />} 
        bgColor="bg-blue-50"
      />
      <Card 
        title="Pagamentos Parciais" 
        value={data.pagamentos_parciais} 
        icon={<BadgePercent size={16} className="text-amber-600" />} 
        bgColor="bg-amber-50"
      />
    </div>
  );
}

function Card({ title, value, icon, bgColor }: { title: string; value: string | number; icon: React.ReactNode; bgColor: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center gap-4">
      <div className={`w-10 h-10 rounded-lg ${bgColor} flex items-center justify-center shrink-0`}>
        {icon}
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{title}</p>
        <p className="text-lg font-black text-slate-900">{value}</p>
      </div>
    </div>
  );
}
