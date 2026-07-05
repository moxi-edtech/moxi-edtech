"use client";

import { useState, useEffect } from "react";
import { Megaphone, Copy, Target, Mail, Linkedin, MessageSquare, Send, Layers, Users, CheckCircle2, ChevronRight, HelpCircle, Pencil, Save, X, RotateCcw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

type CampanhaTabContentProps = {
  codigo: string;
  campaignUrl: string;
  onboardingUrl: string;
  copyToClipboard: (text: string) => void;
  memberRole?: string;
};

const STRATEGIC_ACTIONS = [
  "Identificar instituições com gargalos na secretaria durante períodos de matrícula.",
  "Demonstrar soluções de forma consultiva, focando em eficiência operacional e economia de tempo.",
  "Conduzir gestores qualificados ao preenchimento do Diagnóstico Institucional.",
];

const DEFAULT_KITS = [
  {
    id: "executiva",
    title: "Apresentação Executiva",
    audience: "Diretores",
    icon: Mail,
    linkType: "diagnosis",
    copy: "Estimado Diretor, a modernização dos processos de secretaria reduz custos e otimiza o atendimento aos encarregados. O KLASSE oferece matrícula online, portal do aluno e controle acadêmico integrado. Proponho realizarmos o diagnóstico institucional da sua escola para avaliarmos a prontidão de implantação:",
  },
  {
    id: "linkedin",
    title: "Destaque de Eficiência",
    audience: "LinkedIn / Gestores",
    icon: Linkedin,
    linkType: "campaign",
    copy: "Como sua instituição lida com o pico de matrículas? Com o KLASSE, as secretarias escolares reduzem o tempo de atendimento em até 80%, eliminando filas e garantindo uma experiência digital moderna aos encarregados. Conheça a nossa plataforma de gestão e automação:",
  },
  {
    id: "whatsapp",
    title: "Abordagem de Parceria",
    audience: "WhatsApp Direto",
    icon: MessageSquare,
    linkType: "diagnosis",
    copy: "Olá! A modernização da secretaria escolar aproxima os encarregados da equipe pedagógica. O KLASSE centraliza notas, financeiro e matrículas de forma simples e segura. Gostaria de iniciar o diagnóstico da sua escola para avaliarmos a modernização?",
  },
  {
    id: "encarregados",
    title: "Informativo Encarregados",
    audience: "Pais & Alunos",
    icon: Users,
    linkType: "campaign",
    copy: "Uma experiência 100% digital para acompanhar a vida escolar dos seus filhos. Com o portal do aluno do KLASSE, a matrícula, o boletim de notas e os avisos acadêmicos estão a um clique de distância. Indique para a direção da sua escola:",
  },
  {
    id: "email",
    title: "Abordagem Educacional",
    audience: "E-mail Geral",
    icon: Send,
    linkType: "campaign",
    copy: "Prezada equipe gestora, conheçam o KLASSE: uma plataforma completa projetada para simplificar a administração acadêmica, automatizar a secretaria e aproximar a comunidade escolar com o portal do aluno. Acessem o link para conhecer as soluções:",
  },
];

export function CampanhaTabContent({
  codigo,
  campaignUrl,
  onboardingUrl,
  copyToClipboard,
  memberRole,
}: CampanhaTabContentProps) {
  const [kits, setKits] = useState(DEFAULT_KITS);
  const [isCustomized, setIsCustomized] = useState(false);

  // Edit State
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editCopy, setEditCopy] = useState("");

  // Load customizations on mount
  useEffect(() => {
    const saved = localStorage.getItem(`klasse_campaign_kits_${codigo}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const merged = DEFAULT_KITS.map((defaultKit) => {
          const userKit = parsed.find((k: any) => k.id === defaultKit.id);
          if (userKit) {
            return {
              ...defaultKit,
              title: userKit.title || defaultKit.title,
              copy: userKit.copy || defaultKit.copy,
            };
          }
          return defaultKit;
        });
        setKits(merged);
        setIsCustomized(true);
      } catch (e) {
        console.error("Erro ao carregar mensagens customizadas do localStorage", e);
      }
    }
  }, [codigo]);

  const startEdit = (index: number, kit: typeof DEFAULT_KITS[number]) => {
    setEditingIndex(index);
    setEditTitle(kit.title);
    setEditCopy(kit.copy);
  };

  const handleCancel = () => {
    setEditingIndex(null);
  };

  const handleSave = (index: number) => {
    const updatedKits = kits.map((kit, i) => {
      if (i === index) {
        return {
          ...kit,
          title: editTitle.trim() || kit.title,
          copy: editCopy.trim() || kit.copy,
        };
      }
      return kit;
    });

    setKits(updatedKits);
    setEditingIndex(null);

    // Save only serializable data
    const serializable = updatedKits.map((k) => ({
      id: k.id,
      title: k.title,
      copy: k.copy,
    }));

    localStorage.setItem(`klasse_campaign_kits_${codigo}`, JSON.stringify(serializable));
    setIsCustomized(true);
  };

  const handleRestoreDefaults = () => {
    localStorage.removeItem(`klasse_campaign_kits_${codigo}`);
    setKits(DEFAULT_KITS);
    setIsCustomized(false);
    setEditingIndex(null);
  };

  const isOwner = memberRole === "owner";

  return (
    <div className="space-y-16">
      {/* 1. Hero Focus Header - Standing Full Width for Desktop Breathing Space */}
      <Card className="overflow-hidden rounded-[40px] border-zinc-800 bg-gradient-to-br from-zinc-950 via-[#0e1017] to-zinc-950 text-white shadow-[0_30px_60px_rgba(0,0,0,0.25)] border-0">
        <CardContent className="grid gap-12 p-8 lg:p-16 lg:grid-cols-[1.2fr_0.8fr] items-center">
          <div className="space-y-6">
            <Badge className="w-fit border border-amber-500/20 bg-amber-500/10 text-[9px] font-bold uppercase tracking-[0.25em] text-klasse-gold px-3.5 py-1 rounded-full">
              Foco Estratégico
            </Badge>
            <div className="space-y-4">
              <h2 className="text-3xl font-extrabold tracking-tight md:text-5xl lg:text-5xl text-white leading-[1.15]">
                Acelerar a modernização da gestão e do relacionamento escolar.
              </h2>
              <p className="max-w-2xl text-sm font-medium leading-relaxed text-slate-400">
                Atuamos de forma consultiva. Demonstramos o valor das soluções digitais a partir de indicadores de melhoria de atendimento aos encarregados e eficiência operacional interna da escola.
              </p>
            </div>
          </div>

          <div className="space-y-6 lg:pl-10 lg:border-l lg:border-zinc-800/80">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Diretrizes Comerciais</h4>
            <div className="space-y-4">
              {STRATEGIC_ACTIONS.map((action, index) => (
                <div key={action} className="flex gap-4 items-start">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-klasse-gold/15 text-[11px] font-bold text-klasse-gold">
                    0{index + 1}
                  </div>
                  <p className="text-xs font-semibold leading-relaxed text-slate-355 pt-0.5">{action}</p>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Referral Sharing Center - Two Columns to let the links breathe */}
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-bold text-slate-900 tracking-tight">Ferramentas de Indicação</h3>
          <p className="text-xs text-slate-500 font-medium">Use os canais abaixo para divulgar a plataforma de forma direcionada.</p>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Link 1: Public Presentation */}
          <Card className="rounded-[32px] border-slate-200/60 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.015)] p-6 lg:p-8 flex flex-col justify-between hover:shadow-md transition-all duration-300">
            <div className="space-y-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-900 border border-zinc-200/30 shadow-sm">
                <Megaphone size={20} />
              </div>
              <div className="space-y-1.5">
                <h4 className="font-bold text-slate-900 text-base">Apresentação Institucional (Landing Page)</h4>
                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                  Ideal para divulgação pública ou envio inicial a gestores. Mostra os benefícios da escola moderna antes de iniciar qualquer formulário.
                </p>
              </div>
            </div>

            <div className="mt-8 rounded-2xl border border-slate-100 bg-slate-55/40 p-4 space-y-3">
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Link da Apresentação</p>
              <div className="flex items-center justify-between gap-3">
                <code className="min-w-0 flex-1 truncate text-xs font-bold text-slate-700 font-mono">{campaignUrl}</code>
                <Button 
                  onClick={() => copyToClipboard(campaignUrl)} 
                  className="h-9 rounded-xl bg-slate-900 hover:bg-slate-800 px-4 text-xs font-bold text-white shadow-none shrink-0"
                >
                  <Copy size={13} className="mr-1.5 inline-block" /> Copiar Link
                </Button>
              </div>
            </div>
          </Card>

          {/* Link 2: Onboarding Form */}
          <Card className="rounded-[32px] border-slate-200/60 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.015)] p-6 lg:p-8 flex flex-col justify-between hover:shadow-md transition-all duration-300">
            <div className="space-y-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100/30 shadow-sm">
                <Layers size={20} />
              </div>
              <div className="space-y-1.5">
                <h4 className="font-bold text-slate-900 text-base">Diagnóstico Institucional (Pedido de Adesão)</h4>
                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                  Use este link para coletar as informações técnicas da escola. Deve ser sugerido após o interesse inicial do diretor ser qualificado.
                </p>
              </div>
            </div>

            <div className="mt-8 rounded-2xl border border-slate-100 bg-slate-55/40 p-4 space-y-3">
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Link do Diagnóstico</p>
              <div className="flex items-center justify-between gap-3">
                <code className="min-w-0 flex-1 truncate text-xs font-bold text-emerald-700 font-mono">{onboardingUrl}</code>
                <Button 
                  onClick={() => copyToClipboard(onboardingUrl)} 
                  className="h-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 text-xs font-bold text-white shadow-none shrink-0"
                >
                  <Copy size={13} className="mr-1.5 inline-block" /> Copiar Link
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* 3. Copy Kits - 3 Columns for Desktop breathing space */}
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-lg font-bold text-slate-900 tracking-tight">Modelos de Mensagem (Scripts B2B)</h3>
            <p className="text-xs text-slate-500 font-medium">Textos formatados para prospecção rápida de diretores e encarregados.</p>
          </div>
          {isCustomized && (
            <Button
              onClick={handleRestoreDefaults}
              variant="outline"
              className="h-9 rounded-xl border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-600 gap-1.5"
            >
              <RotateCcw size={13} />
              Restaurar Padrões
            </Button>
          )}
        </div>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {kits.map((kit, index) => {
            const isEditing = editingIndex === index;

            return (
              <Card key={kit.id} className="rounded-3xl border-slate-200/60 bg-white hover:border-slate-300/80 shadow-[0_8px_30px_rgb(0,0,0,0.015)] hover:shadow-lg transition-all duration-300 flex flex-col justify-between overflow-hidden">
                <CardContent className="flex h-full flex-col gap-6 p-6 lg:p-8">
                  <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4 shrink-0">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-55 text-slate-700 border border-slate-100/50">
                      <kit.icon size={18} />
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="rounded-lg text-[9px] font-bold uppercase tracking-widest px-2.5 py-0.5 border-slate-200 bg-slate-50 text-slate-500 shadow-none">
                        {kit.audience}
                      </Badge>
                      {isOwner && !isEditing && (
                        <button
                          onClick={() => startEdit(index, kit)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors"
                          title="Editar mensagem"
                        >
                          <Pencil size={12} />
                        </button>
                      )}
                    </div>
                  </div>

                  {isEditing ? (
                    <div className="flex-1 flex flex-col gap-3">
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Título</label>
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="w-full text-sm font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-slate-400 transition-colors"
                        />
                      </div>
                      <div className="space-y-1 flex-1 flex flex-col">
                        <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Mensagem</label>
                        <textarea
                          value={editCopy}
                          onChange={(e) => setEditCopy(e.target.value)}
                          className="w-full text-xs text-slate-500 font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-slate-400 transition-colors resize-none flex-1 min-h-[150px]"
                        />
                      </div>
                      <div className="flex gap-2 pt-2 shrink-0">
                        <Button
                          onClick={() => handleSave(index)}
                          className="flex-1 h-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white transition-all gap-1.5 border-none"
                        >
                          <Save size={13} />
                          Salvar
                        </Button>
                        <Button
                          onClick={handleCancel}
                          variant="outline"
                          className="h-9 rounded-xl border-slate-250 hover:bg-slate-50 text-xs font-bold text-slate-500 px-3.5 shrink-0"
                        >
                          <X size={13} />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2 flex-1">
                        <h4 className="text-base font-bold text-slate-900 tracking-tight">{kit.title}</h4>
                        <p className="text-xs text-slate-500 font-semibold leading-relaxed" title={kit.copy}>{kit.copy}</p>
                      </div>

                      <Button
                        onClick={() => copyToClipboard(`${kit.copy}\n\n${kit.linkType === "diagnosis" ? onboardingUrl : campaignUrl}`)}
                        className="w-full h-10 rounded-xl bg-slate-900 text-xs font-bold uppercase tracking-wider text-white hover:bg-slate-800 transition-all gap-2 border-none mt-4"
                      >
                        <Copy size={13} />
                        Copiar script
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* 4. Practical Guidelines */}
      <div className="grid gap-8 lg:grid-cols-2">
        <Card className="rounded-[32px] border-slate-200 bg-[#f8fafc] shadow-sm p-8 flex flex-col justify-between gap-4">
          <div className="space-y-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-md">
              <HelpCircle size={20} />
            </div>
            <div className="space-y-2">
              <h3 className="font-bold text-slate-950 text-base">Papel do Diagnóstico Institucional</h3>
              <p className="text-xs font-semibold leading-relaxed text-slate-500">
                O preenchimento do diagnóstico é indispensável para formalizar a entrega da implantação da escola. Ele fornece à equipe técnica da KLASSE as configurações exatas do ano letivo da escola, planos de estudo e estrutura acadêmica atual.
              </p>
            </div>
          </div>
        </Card>

        <Card className="rounded-[32px] border-slate-200 bg-white shadow-sm p-8">
          <div className="grid gap-6 sm:grid-cols-3">
            <div className="space-y-3">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Passo 1</span>
                <ChevronRight size={10} className="text-slate-400" />
              </div>
              <p className="text-xs font-bold text-slate-800 leading-snug">
                Gerar interesse inicial enviando a Apresentação ou script de email.
              </p>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Passo 2</span>
                <ChevronRight size={10} className="text-slate-400" />
              </div>
              <p className="text-xs font-bold text-slate-800 leading-snug">
                Conduzir os gestores interessados para o Diagnóstico Institucional.
              </p>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={13} className="text-emerald-500 shrink-0 inline-block" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Triagem</span>
              </div>
              <p className="text-xs font-bold text-slate-800 leading-snug">
                A equipe KLASSE recebe os dados e inicia o setup técnico.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
