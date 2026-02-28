"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { PLAN_NAMES, type PlanTier } from "@/config/plans";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";

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

export default function AssinaturaKlasseClient({ escolaId }: AssinaturaKlasseClientProps) {
  const [assinatura, setAssinatura] = useState<Assinatura | null>(null);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supabase = createClient();

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Busca a assinatura actual da escola
      const { data: assData, error: assError } = await supabase
        .from('assinaturas')
        .select('*')
        .eq('escola_id', escolaId)
        .maybeSingle();

      if (assError) throw assError;
      
      const normalizedAss = assData ? {
        ...assData,
        status: assData.status as 'pendente' | 'activa' | 'suspensa' | 'cancelada',
        ciclo: assData.ciclo as 'mensal' | 'anual'
      } as Assinatura : null;

      setAssinatura(normalizedAss as Assinatura | null);

      // Busca histórico de pagamentos SaaS
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

    } catch (err: any) {
      toast.error("Erro ao carregar dados de assinatura: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (escolaId) loadData();
  }, [escolaId]);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !assinatura) return;

    try {
      setUploading(true);
      
      // 1. Upload para o Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${escolaId}/${assinatura.id}_${Date.now()}.${fileExt}`;
      const filePath = fileName; // O folder é o escolaId, definido no fileName para bater com a política RLS

      const { error: uploadError } = await supabase.storage
        .from('billing-proofs') 
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('billing-proofs')
        .getPublicUrl(filePath);

      // 2. Criar ou actualizar o registo de pagamento_saas em estado pendente
      const { error: pgError } = await supabase
        .from('pagamentos_saas')
        .insert({
          assinatura_id: assinatura.id,
          escola_id: escolaId,
          valor_kz: assinatura.valor_kz,
          metodo: assinatura.metodo_pagamento,
          status: 'pendente' as 'pendente',
          comprovativo_url: publicUrl,
          periodo_inicio: new Date().toISOString().split('T')[0],
          periodo_fim: assinatura.data_renovacao.split('T')[0]
        });

      if (pgError) throw pgError;

      toast.success("Comprovativo enviado com sucesso! Aguarde a validação da nossa equipa.");
      loadData();
    } catch (err: any) {
      toast.error("Erro ao enviar comprovativo: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Spinner size={32} />
        <p className="text-sm text-slate-500 mt-4 font-medium uppercase tracking-widest">Carregando dados da assinatura...</p>
      </div>
    );
  }

  if (!assinatura) {
    return (
      <Card className="border-amber-100 bg-amber-50/30">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center space-y-3">
            <span className="text-3xl">ℹ️</span>
            <CardTitle className="text-amber-800">Sem Assinatura Activa</CardTitle>
            <CardDescription className="max-w-md">
              A sua escola ainda não tem um plano de subscrição Klasse configurado. 
              Por favor, contacte o suporte da Klasse para activar o seu portal.
            </CardDescription>
            <Button tone="amber" className="mt-4">Contactar Suporte</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isPendente = assinatura.status === 'pendente';
  const hasPagamentoPendente = pagamentos.some(p => p.status === 'pendente');

  return (
    <div className="space-y-6">
      
      {/* ── Card de Status Principal ── */}
      <Card className="overflow-hidden border-slate-200 shadow-sm">
        <div className={`h-1.5 w-full ${assinatura.status === 'activa' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="space-y-1">
            <CardTitle className="text-2xl font-bold text-slate-900">
              Plano {PLAN_NAMES[assinatura.plano]}
            </CardTitle>
            <CardDescription className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Ciclo de Facturação: {assinatura.ciclo}
            </CardDescription>
          </div>
          <div className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors ${assinatura.status === 'activa' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-amber-100 text-amber-700 border-amber-200'}`}>
            {assinatura.status.toUpperCase()}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-4">
            
            {/* Coluna 1: Info */}
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-sm text-slate-500">Próxima Renovação</span>
                <span className="text-sm font-bold text-slate-900">
                  {format(new Date(assinatura.data_renovacao), "dd 'de' MMMM, yyyy", { locale: pt })}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-sm text-slate-500">Valor da Mensalidade</span>
                <span className="text-sm font-bold text-slate-900">Kz {assinatura.valor_kz.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-sm text-slate-500">Método de Pagamento</span>
                <span className="text-sm font-bold text-slate-900 capitalize">{assinatura.metodo_pagamento}</span>
              </div>
            </div>

            {/* Coluna 2: Instruções de Pagamento (se não Stripe) */}
            {assinatura.metodo_pagamento === 'transferencia' && (
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-3">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Dados para Transferência</h4>
                <div className="space-y-2">
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase">Banco</p>
                    <p className="text-xs font-bold text-slate-800 tracking-tight">Standard Bank Angola</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase">NIB</p>
                    <p className="text-sm font-mono font-bold text-[#1F6B3B] tracking-wider">0040.0000.1234.5678.9012.3</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase">Referência de Pagamento</p>
                    <p className="text-xs font-bold text-slate-800">KLASSE-{escolaId.slice(0, 4)}-{assinatura.id.slice(0, 4)}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Acções de Pagamento */}
          {assinatura.metodo_pagamento === 'transferencia' && (
            <div className="mt-8 pt-6 border-t border-slate-100">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-slate-900">Já efectuou o pagamento?</h4>
                  <p className="text-xs text-slate-500">Faça o upload do comprovativo para activarmos a sua subscrição.</p>
                </div>
                
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  className="hidden" 
                  accept=".pdf,image/*"
                />
                
                <Button 
                  onClick={handleUploadClick}
                  loading={uploading}
                  disabled={hasPagamentoPendente}
                  tone={hasPagamentoPendente ? 'gray' : 'green'}
                  className="w-full sm:w-auto min-w-[200px]"
                >
                  {hasPagamentoPendente ? 'Pagamento em Análise' : 'Submeter Comprovativo'}
                </Button>
              </div>
              {hasPagamentoPendente && (
                <p className="text-[10px] text-amber-600 mt-2 font-medium bg-amber-50 border border-amber-100 p-2 rounded-lg text-center">
                  ⚠️ Temos um comprovativo pendente de validação. A activação será concluída em breve pela nossa equipa.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Histórico de Pagamentos ── */}
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-lg">Histórico de Pagamentos Klasse</CardTitle>
          <CardDescription>Consulte os seus pagamentos anteriores e o estado das facturas.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left">
                  <th className="py-3 font-bold text-slate-500 text-[10px] uppercase tracking-wider">Data</th>
                  <th className="py-3 font-bold text-slate-500 text-[10px] uppercase tracking-wider">Valor</th>
                  <th className="py-3 font-bold text-slate-500 text-[10px] uppercase tracking-wider">Método</th>
                  <th className="py-3 font-bold text-slate-500 text-[10px] uppercase tracking-wider">Estado</th>
                  <th className="py-3 font-bold text-slate-500 text-[10px] uppercase tracking-wider">Comprovativo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {pagamentos.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400 text-xs italic">
                      Nenhum registo de pagamento encontrado.
                    </td>
                  </tr>
                ) : (
                  pagamentos.map((p) => (
                    <tr key={p.id}>
                      <td className="py-4 text-slate-900 font-medium">
                        {format(new Date(p.created_at), "dd/MM/yyyy")}
                      </td>
                      <td className="py-4 text-slate-600 font-mono">Kz {p.valor_kz.toLocaleString()}</td>
                      <td className="py-4 text-slate-600 capitalize">Transferência</td>
                      <td className="py-4">
                        <Badge className={
                          p.status === 'confirmado' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                          p.status === 'pendente' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                          'bg-red-50 text-red-600 border-red-100'
                        } variant="outline">
                          {p.status.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="py-4">
                        {p.comprovativo_url ? (
                          <a 
                            href={p.comprovativo_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-xs text-[#1F6B3B] font-bold hover:underline"
                          >
                            VER DOCUMENTO
                          </a>
                        ) : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
