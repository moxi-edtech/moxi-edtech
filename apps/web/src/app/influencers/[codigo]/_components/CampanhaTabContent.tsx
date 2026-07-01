"use client";

import { Megaphone, Copy, Target } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { WEEKLY_ACTIONS, CAMPAIGN_KITS } from "./partner-dashboard-model";

type CampanhaTabContentProps = {
  codigo: string;
  campaignUrl: string;
  onboardingUrl: string;
  copyToClipboard: (text: string) => void;
};

export function CampanhaTabContent({
  codigo,
  campaignUrl,
  onboardingUrl,
  copyToClipboard,
}: CampanhaTabContentProps) {
  return (
    <div className="space-y-8">
      <Card className="overflow-hidden rounded-[32px] border-slate-200 bg-slate-950 text-white shadow-xl">
        <CardContent className="grid gap-8 p-8 lg:grid-cols-[1.1fr_0.9fr] lg:p-10">
          <div className="space-y-6">
            <Badge className="w-fit border border-white/10 bg-white/10 text-[10px] font-bold uppercase tracking-[0.2em] text-klasse-gold">
              Missão da semana
            </Badge>
            <div className="space-y-3">
              <h2 className="max-w-2xl text-3xl font-bold tracking-tight md:text-5xl">
                Fazer escolas sentirem que precisam de matrícula online e portal do aluno.
              </h2>
              <p className="max-w-2xl text-sm font-medium leading-relaxed text-slate-300 md:text-base">
                A campanha pública cria pressão social. O diagnóstico entra depois, quando o diretor quer saber se a escola está pronta para modernizar.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {WEEKLY_ACTIONS.map((action, index) => (
                <div key={action} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-xl bg-klasse-gold text-xs font-bold text-slate-950">
                    {index + 1}
                  </div>
                  <p className="text-xs font-bold leading-relaxed text-slate-200">{action}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-white/5 p-5 backdrop-blur">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-klasse-gold text-slate-950">
                <Megaphone size={22} />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Oferta pública</p>
                <h3 className="font-bold text-white">Escola Moderna</h3>
              </div>
            </div>
            <p className="mb-5 text-sm font-medium leading-relaxed text-slate-300">
              Use este link para posts, stories e mensagens para pais. Ele apresenta a ideia de modernização antes de pedir o diagnóstico.
            </p>
            <div className="space-y-3">
              <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-3">
                <p className="mb-2 text-[9px] font-bold uppercase tracking-widest text-slate-500">Link principal</p>
                <div className="flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate text-xs font-bold text-klasse-gold">{campaignUrl}</code>
                  <Button onClick={() => copyToClipboard(campaignUrl)} className="h-9 rounded-xl bg-white px-3 text-[10px] font-bold text-slate-950 hover:bg-slate-100">
                    <Copy size={13} />
                  </Button>
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-3">
                <p className="mb-2 text-[9px] font-bold uppercase tracking-widest text-slate-500">Pedido para diretores</p>
                <div className="flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate text-xs font-bold text-slate-300">{onboardingUrl}</code>
                  <Button onClick={() => copyToClipboard(onboardingUrl)} className="h-9 rounded-xl bg-white/10 px-3 text-[10px] font-bold text-white hover:bg-white/20">
                    <Copy size={13} />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-5">
        {CAMPAIGN_KITS.map((kit) => (
          <Card key={kit.title} className="rounded-[28px] border-slate-200 bg-white shadow-sm">
            <CardContent className="flex h-full flex-col gap-5 p-6">
              <div className="flex items-center justify-between gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                  <kit.icon size={22} />
                </div>
                <Badge variant="outline" className="rounded-xl text-[9px] font-bold uppercase tracking-widest">
                  {kit.audience}
                </Badge>
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-bold tracking-tight text-slate-900">{kit.title}</h3>
                <p className="text-sm font-medium leading-relaxed text-slate-600">{kit.copy}</p>
              </div>
              <Button
                onClick={() => copyToClipboard(`${kit.copy}\n\n${kit.linkType === "diagnosis" ? onboardingUrl : campaignUrl}`)}
                className="mt-auto h-11 rounded-xl bg-slate-900 text-xs font-bold uppercase tracking-widest text-white hover:bg-slate-800"
              >
                <Copy size={14} />
                Copiar mensagem
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <Card className="rounded-[28px] border-amber-100 bg-amber-50 shadow-sm">
          <CardContent className="space-y-4 p-6">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
              <Target size={22} />
            </div>
            <div className="space-y-2">
              <h3 className="font-bold text-amber-950">Quando usar o pedido da escola</h3>
              <p className="text-sm font-medium leading-relaxed text-amber-900">
                Use depois que a escola demonstrar interesse. A pergunta certa é: "Quer iniciar o pedido para a equipa KLASSE avaliar a modernização da sua escola?"
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-slate-200 bg-white shadow-sm">
          <CardContent className="grid gap-4 p-6 sm:grid-cols-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Passo 1</p>
              <p className="mt-2 text-sm font-bold text-slate-800">Criar pressão pública com portal do aluno e matrícula online.</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Passo 2</p>
              <p className="mt-2 text-sm font-bold text-slate-800">Direcionar diretores interessados para o pedido de onboarding.</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Passo 3</p>
              <p className="mt-2 text-sm font-bold text-slate-800">A equipe KLASSE faz follow-up com o contexto do resultado.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
