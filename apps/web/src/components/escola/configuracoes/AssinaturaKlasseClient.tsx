"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { format, differenceInCalendarDays } from "date-fns";
import { pt } from "date-fns/locale";
import { PLAN_NAMES, type PlanTier } from "@/config/plans";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { Building2, CreditCard, ArrowUpRight, FileText, CheckCircle2, AlertCircle, ShieldCheck } from "lucide-react";
import { useEscolaId } from "@/hooks/useEscolaId";

interface AssinaturaKlasseClientProps {
  escolaId: string;
}

type Assinatura = {
  id: string;
  plano: PlanTier;
  ciclo: 'mensal' | 'anual';
  status: 'pendente' | 'activa' | 'suspensa' | 'cancelada';
  data_renovacao: string;
  valor_kz: number;
  metodo_pagamento: string;
};

type Pagamento = {
  id: string;
  status: 'pendente' | 'confirmado' | 'falhado';
  valor_kz: number;
  created_at: string;
  comprovativo_url?: string;
};

type PlanoLimites = {
  plan: PlanTier;
  price_mensal_kz: number;
  max_alunos: number | null;
  max_admin_users: number | null;
  max_storage_gb: number | null;
  professores_ilimitados: boolean;
  api_enabled: boolean;
  multi_campus: boolean;
  fin_recibo_pdf?: boolean;
  sec_upload_docs?: boolean;
  sec_matricula_online?: boolean;
  doc_qr_code?: boolean;
  app_whatsapp_auto?: boolean;
  suporte_prioritario?: boolean;
};

export default function AssinaturaKlasseClient({ escolaId }: AssinaturaKlasseClientProps) {
  const { escolaSlug } = useEscolaId();
  const escolaParam = escolaSlug || escolaId;
  const [assinatura, setAssinatura] = useState<Assinatura | null>(null);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [actionLoading, setActionLoading] = useState<null | "upgrade" | "annual" | "portal">(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [planoLimites, setPlanoLimites] = useState<PlanoLimites | null>(null);

  const supabase = createClient();
  const valorPlano = assinatura?.valor_kz ?? planoLimites?.price_mensal_kz ?? null;
  const valorPlanoLabel = valorPlano ? `Kz ${valorPlano.toLocaleString('pt-AO')}` : "Sob consulta";
  const beneficiosPlano = planoLimites
    ? [
        { label: "Recibos em PDF", enabled: Boolean(planoLimites.fin_recibo_pdf) },
        { label: "Upload de documentos", enabled: Boolean(planoLimites.sec_upload_docs) },
        { label: "Matrícula online", enabled: Boolean(planoLimites.sec_matricula_online) },
        { label: "Documentos com QR", enabled: Boolean(planoLimites.doc_qr_code) },
        { label: "WhatsApp automático", enabled: Boolean(planoLimites.app_whatsapp_auto) },
        { label: "Suporte prioritário", enabled: Boolean(planoLimites.suporte_prioritario) },
      ]
    : [];

  const loadData = async () => {
    try {
      setLoading(true);
      
      const { data: assData, error: assError } = await supabase
        .from('assinaturas')
        .select('*')
        .eq('escola_id', escolaId)
        .maybeSingle();

      if (assError && assError.code !== 'PGRST116') throw assError;
      
      const normalizedAss = assData ? {
        ...assData,
        status: assData.status as Assinatura['status'],
        ciclo: assData.ciclo as Assinatura['ciclo']
      } as Assinatura : null;

      setAssinatura(normalizedAss);

      const { data: pgData, error: pgError } = await supabase
        .from('pagamentos_saas')
        .select('*')
        .eq('escola_id', escolaId)
        .order('created_at', { ascending: false });

      if (pgError) throw pgError;
      
      const normalizedPgs: Pagamento[] = (pgData || []).map(p => ({
        id: p.id,
        status: p.status as Pagamento['status'],
        valor_kz: p.valor_kz || 0,
        created_at: p.created_at || new Date().toISOString(),
        comprovativo_url: p.comprovativo_url || undefined
      }));

      setPagamentos(normalizedPgs);

      if (normalizedAss?.plano) {
        const { data: limitsData } = await supabase
          .from('app_plan_limits')
          .select('*')
          .eq('plan', normalizedAss.plano)
          .maybeSingle();
        setPlanoLimites((limitsData as PlanoLimites) ?? null);
      } else {
        setPlanoLimites(null);
      }

    } catch (err: any) {
      toast.error("Erro ao carregar dados de assinatura: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (escolaParam) loadData();
  }, [escolaParam]);

  const handleBillingAction = async (action: "upgrade" | "annual" | "portal", payload?: Record<string, unknown>) => {
    try {
      setActionLoading(action);
      const endpoint = action === "portal"
        ? `/api/escola/${escolaParam}/billing/stripe-portal`
        : `/api/escola/${escolaParam}/billing/upgrade`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload ?? {}),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result?.error ?? "Não foi possível processar a acção.");

      if (result?.url) {
        window.location.href = result.url as string;
        return;
      }

      toast.success(result?.message ?? "Acção iniciada com sucesso.");
      await loadData();
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao executar a acção de billing.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !assinatura) return;

    try {
      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const filePath = `${escolaId}/${assinatura.id}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage.from('billing-proofs').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('billing-proofs').getPublicUrl(filePath);

      const { error: pgError } = await supabase.from('pagamentos_saas').insert({
        assinatura_id: assinatura.id,
        escola_id: escolaId,
        valor_kz: assinatura.valor_kz,
        metodo: assinatura.metodo_pagamento,
        status: 'pendente',
        comprovativo_url: publicUrl,
        periodo_inicio: new Date().toISOString().split('T')[0],
        periodo_fim: assinatura.data_renovacao.split('T')[0]
      });

      if (pgError) throw pgError;

      toast.success("Comprovativo enviado! A aguardar validação da equipa KLASSE.");
      loadData();
    } catch (err: any) {
      toast.error("Erro ao enviar comprovativo: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <Spinner className="text-[#1F6B3B] w-8 h-8" />
        <p className="text-xs text-slate-400 mt-4 font-geist tracking-widest uppercase">A carregar contrato...</p>
      </div>
    );
  }

  if (!assinatura) {
    return (
      <Card className="border-slate-200 bg-slate-50/50 shadow-sm rounded-xl">
        <CardContent className="pt-10 pb-10 flex flex-col items-center text-center">
          <ShieldCheck className="w-12 h-12 text-slate-300 mb-4" />
          <CardTitle className="text-slate-900 font-sora text-xl">Escola Sem Contrato Activo</CardTitle>
          <CardDescription className="max-w-md mt-2 text-slate-500">
            A infraestrutura da sua escola está provisionada, mas aguarda a ativação do plano SaaS.
          </CardDescription>
          <Button className="mt-6 bg-[#E3B23C] text-white hover:brightness-95 border-none shadow-sm rounded-xl">
            Ativar Assinatura KLASSE
          </Button>
        </CardContent>
      </Card>
    );
  }

  const isActiva = assinatura.status === 'activa';
  const hasPagamentoPendente = pagamentos.some(p => p.status === 'pendente');
  const renovacaoDate = new Date(assinatura.data_renovacao);
  const diasRestantes = Math.max(0, differenceInCalendarDays(renovacaoDate, new Date()));
  const isTransferencia = assinatura.metodo_pagamento === 'transferencia';

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      
      {/* HEADER DO STATUS (Enterprise Vibe) */}
      <Card className="border-slate-200 shadow-sm rounded-xl overflow-hidden relative">
        <div className={`absolute top-0 left-0 w-1.5 h-full ${isActiva ? 'bg-[#1F6B3B]' : 'bg-[#E3B23C]'}`} />
        <CardContent className="p-6 sm:p-8 pl-8 sm:pl-10">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            
            <div className="space-y-4 flex-1">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h2 className="text-3xl font-bold text-slate-900 tracking-tight font-sora">
                    Plano {PLAN_NAMES[assinatura.plano] || assinatura.plano}
                  </h2>
                  <Badge className={`px-3 py-1 text-xs font-bold uppercase tracking-wider border-0 ${
                    isActiva ? 'bg-green-100 text-[#1F6B3B]' : 'bg-amber-100 text-[#E3B23C]'
                  }`}>
                    {assinatura.status}
                  </Badge>
                </div>
                <p className="text-sm text-slate-500 font-medium">
                  Faturação {assinatura.ciclo === 'anual' ? 'Anual' : 'Mensal'} • ID: {assinatura.id.split('-')[0].toUpperCase()}
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-slate-100">
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Valor</p>
                  <p className="text-lg font-semibold text-slate-900 font-geist">{valorPlanoLabel}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Próximo Fecho</p>
                  <p className="text-sm font-semibold text-slate-900 mt-1">{format(renovacaoDate, "dd MMM yyyy", { locale: pt })}</p>
                </div>
                <div className="md:col-span-2">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Status Operacional</p>
                  {diasRestantes <= 5 && isActiva ? (
                    <div className="flex items-center gap-2 text-amber-700 bg-amber-50 rounded-lg px-3 py-1.5 w-fit">
                      <AlertCircle className="w-4 h-4" />
                      <span className="text-xs font-medium">Expira em {diasRestantes} dias</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-[#1F6B3B] bg-green-50 rounded-lg px-3 py-1.5 w-fit">
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="text-xs font-medium">Serviços Ativos</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* AÇÕES DE BILLING RÁPIDAS */}
            <div className="flex flex-col gap-3 min-w-[220px]">
              <Button 
                className="w-full bg-slate-950 text-white hover:bg-slate-800 rounded-xl justify-between group shadow-sm"
                onClick={() => handleBillingAction("upgrade")}
                loading={actionLoading === "upgrade"}
              >
                Mudar de Plano <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" />
              </Button>
              {!isTransferencia && (
                <Button 
                  variant="outline" 
                  className="w-full border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 justify-between shadow-sm"
                  onClick={() => handleBillingAction("portal")}
                  loading={actionLoading === "portal"}
                >
                  Gerir Cartão <CreditCard className="w-4 h-4 text-slate-400" />
                </Button>
              )}
            </div>

          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* ÁREA DE PAGAMENTO (Só visível se Transferência) */}
        {isTransferencia && (
          <Card className="col-span-1 lg:col-span-2 border-slate-200 shadow-sm rounded-xl">
            <CardHeader className="pb-4 border-b border-slate-100">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#1F6B3B]" /> Regularização Bancária
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row gap-8">
                <div className="flex-1 space-y-4">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-3">Coordenadas KLASSE EdTech</p>
                    <div className="space-y-2 font-geist text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Banco:</span>
                        <span className="font-semibold text-slate-900">BFA Angola</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">IBAN:</span>
                        <span className="font-bold text-[#1F6B3B] tracking-wide">AO06.0000.1234.5678.9012.3</span>
                      </div>
                      <div className="flex justify-between pt-2 mt-2 border-t border-slate-200">
                        <span className="text-slate-500">Ref (Descritivo):</span>
                        <span className="font-semibold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                          {escolaId.slice(0, 8).toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex-1 flex flex-col justify-center">
                  <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".pdf,image/*" />
                  
                  {hasPagamentoPendente ? (
                    <div className="text-center p-6 border border-dashed border-[#E3B23C] bg-amber-50/50 rounded-xl">
                      <AlertCircle className="w-8 h-8 text-[#E3B23C] mx-auto mb-2" />
                      <p className="text-sm font-semibold text-slate-900">Comprovativo em Análise</p>
                      <p className="text-xs text-slate-500 mt-1">A nossa equipa financeira está a validar o seu pagamento. Acesso garantido entretanto.</p>
                    </div>
                  ) : (
                    <Button 
                      onClick={() => fileInputRef.current?.click()}
                      loading={uploading}
                      className="w-full h-24 border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-[#1F6B3B] text-slate-600 rounded-xl flex flex-col items-center justify-center gap-2 transition-all shadow-none"
                    >
                      <FileText className="w-6 h-6 text-slate-400" />
                      <span>Anexar Comprovativo de Transferência</span>
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* LIMITES DO PLANO (Resumo Contratual) */}
        {planoLimites && (
          <Card className={`border-slate-200 shadow-sm rounded-xl ${!isTransferencia ? 'col-span-1 lg:col-span-3' : 'col-span-1'}`}>
            <CardHeader className="pb-4 border-b border-slate-100 bg-slate-50/50 rounded-t-xl">
              <CardTitle className="text-sm font-semibold text-slate-900 uppercase tracking-wide">
                Garantias do Contrato
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-slate-100 text-sm">
                <div className="flex justify-between p-4 hover:bg-slate-50">
                  <span className="text-slate-500">Capacidade de Alunos</span>
                  <span className="font-semibold text-slate-900">{planoLimites.max_alunos || "Ilimitado"}</span>
                </div>
                <div className="flex justify-between p-4 hover:bg-slate-50">
                  <span className="text-slate-500">Licenças Staff/Admin</span>
                  <span className="font-semibold text-slate-900">{planoLimites.max_admin_users || "Ilimitado"}</span>
                </div>
                <div className="flex justify-between p-4 hover:bg-slate-50">
                  <span className="text-slate-500">Armazenamento AWS</span>
                  <span className="font-semibold text-slate-900">{planoLimites.max_storage_gb ? `${planoLimites.max_storage_gb} GB` : "Ilimitado"}</span>
                </div>
                <div className="p-4">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Benefícios</div>
                  <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-slate-600">
                    {beneficiosPlano.map((item) => (
                      <div key={item.label} className="flex items-center justify-between">
                        <span>{item.label}</span>
                        <span className={`font-semibold ${item.enabled ? "text-klasse-green-600" : "text-slate-400"}`}>
                          {item.enabled ? "Ativo" : "Indisponível"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

      </div>

      {/* HISTÓRICO DE FATURAS */}
      <Card className="border-slate-200 shadow-sm rounded-xl overflow-hidden">
        <CardHeader className="bg-slate-50/80 border-b border-slate-100 py-4">
          <CardTitle className="text-sm font-semibold text-slate-900 uppercase tracking-wide">
            Histórico de Liquidações
          </CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-white border-b border-slate-100">
              <tr>
                <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Data</th>
                <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Montante</th>
                <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Via</th>
                <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Estado</th>
                <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Documento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 bg-white">
              {pagamentos.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-400 text-sm">
                    Sem histórico de faturas registado.
                  </td>
                </tr>
              ) : (
                pagamentos.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 text-slate-900 font-medium">
                      {format(new Date(p.created_at), "dd MMM yyyy", { locale: pt })}
                    </td>
                    <td className="px-6 py-4 text-slate-600 font-geist">
                      Kz {p.valor_kz.toLocaleString('pt-AO')}
                    </td>
                    <td className="px-6 py-4 text-slate-500 capitalize">{assinatura.metodo_pagamento}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                        p.status === 'confirmado' ? 'bg-green-100 text-[#1F6B3B]' :
                        p.status === 'pendente' ? 'bg-amber-100 text-[#E3B23C]' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {p.comprovativo_url ? (
                        <a href={p.comprovativo_url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-[#1F6B3B] hover:text-[#E3B23C] transition-colors flex items-center justify-end gap-1">
                          Ver <ArrowUpRight className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
