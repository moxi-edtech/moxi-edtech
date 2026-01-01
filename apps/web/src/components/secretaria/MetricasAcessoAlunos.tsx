"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Loader2, Smartphone, UserCheck, UserX, Users } from "lucide-react";

type Props = {
  escolaId: string;
};

type Metricas = {
  total_alunos: number;
  acesso_liberado: number;
  sem_acesso: number;
  enviados_whatsapp: number;
};

export function MetricasAcessoAlunos({ escolaId }: Props) {
  const [data, setData] = useState<Metricas | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!escolaId) return;
    setLoading(true);
    fetch(`/api/secretaria/alunos/metricas-acesso?escolaId=${encodeURIComponent(escolaId)}`)
      .then((res) => res.json())
      .then((json) => {
        if (!json?.ok) throw new Error(json?.error || 'Falha ao carregar');
        setData(json.data || null);
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [escolaId]);

  const cards = [
    { label: 'Total alunos', value: data?.total_alunos ?? 0, icon: Users, color: 'text-slate-700' },
    { label: 'Acesso liberado', value: data?.acesso_liberado ?? 0, icon: UserCheck, color: 'text-emerald-600' },
    { label: 'Sem acesso', value: data?.sem_acesso ?? 0, icon: UserX, color: 'text-orange-600' },
    { label: 'Enviados (WhatsApp)', value: data?.enviados_whatsapp ?? 0, icon: Smartphone, color: 'text-blue-600' },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((card) => (
        <Card key={card.label} className="p-4">
          <CardHeader className="mb-2 flex items-center justify-between">
            <CardTitle className="text-sm text-slate-600 font-semibold">{card.label}</CardTitle>
            {loading ? <Loader2 className="w-4 h-4 animate-spin text-slate-400" /> : <card.icon className={`w-4 h-4 ${card.color}`} />}
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold text-slate-900">{card.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
