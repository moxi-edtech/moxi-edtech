"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { PLAN_NAMES, type PlanTier } from "@/config/plans";
import { Spinner } from "@/components/ui/Spinner";
import { Button } from "@/components/ui/Button";
import { X, Mail, CreditCard, AlertTriangle, FileText, Send } from "lucide-react";

interface Props {
  assinaturaId: string;
  onClose: () => void;
  onUpdated: () => void;
}

export default function AssinaturaDetailsSlideover({ assinaturaId, onClose, onUpdated }: Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  
  // Form states
  const [plano, setPlano] = useState<PlanTier>("essencial");
  const [ciclo, setCiclo] = useState<"mensal" | "anual">("mensal");
  const [valor, setValor] = useState(0);
  const [notas, setNotas] = useState("");

  const supabase = createClient();

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const { data: ass, error } = await supabase
          .from("assinaturas")
          .select("*, escolas:escola_id(nome, nif)")
          .eq("id", assinaturaId)
          .single();

        if (error) throw error;
        setData(ass);
        setPlano(ass.plano as PlanTier);
        setCiclo(ass.ciclo as "mensal" | "anual");
        setValor(ass.valor_kz);
        setNotas(ass.notas_internas || "");
      } catch (err: any) {
        toast.error("Erro ao carregar detalhes");
        onClose();
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [assinaturaId]);

  const handleSave = async () => {
    try {
      setSaving(true);
      const res = await fetch(`/api/super-admin/billing/assinaturas/${assinaturaId}`, {
        method: "PATCH",
        body: JSON.stringify({ plano, ciclo, valor_kz: valor, notas_internas: notas }),
      });
      if (!res.ok) throw new Error("Falha ao salvar");
      toast.success("Assinatura actualizada");
      onUpdated();
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleResendInstructions = async () => {
    try {
      setSendingEmail(true);
      const res = await fetch(`/api/super-admin/billing/assinaturas/${assinaturaId}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "resend_instructions" }),
      });
      if (!res.ok) throw new Error("Falha ao enviar");
      toast.success("Instruções enviadas por email");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSendingEmail(false);
    }
  };

  const handleToggleStatus = async () => {
    const newStatus = data.status === 'activa' ? 'suspensa' : 'activa';
    if (!confirm(`Deseja alterar o status para ${newStatus}?`)) return;
    
    try {
      setSaving(true);
      const res = await fetch(`/api/super-admin/billing/assinaturas/${assinaturaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: data.status === 'activa' ? 'suspend_subscription' : 'reactivate_subscription' }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Falha ao alterar status");
      
      toast.success(`Status alterado para ${newStatus}`);
      onUpdated();
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="fixed inset-0 z-[60] flex items-center justify-end">
      <div className="w-full max-w-md h-full bg-white shadow-2xl flex items-center justify-center">
        <Spinner size={32} />
      </div>
    </div>
  );

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-[50] backdrop-blur-sm" onClick={onClose} />
      
      {/* Slideover */}
      <div className="fixed inset-y-0 right-0 z-[60] w-full max-w-md bg-white shadow-2xl animate-in slide-in-from-right duration-300">
        <div className="h-full flex flex-col">
          
          {/* Header */}
          <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div>
              <h2 className="text-lg font-bold text-slate-900">{data.escolas?.nome}</h2>
              <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">ID: {assinaturaId.slice(0, 13)}...</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-lg transition-colors">
              <X className="h-5 w-5 text-slate-500" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            
            {/* Secção 1: Comunicação */}
            <div className="space-y-3">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Mail className="h-3 w-3" /> Canais de Comunicação
              </h3>
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-600">Reenviar dados de pagamento (NIB/Referência) ao director.</p>
                  <Button 
                    size="sm" 
                    tone="gold" 
                    loading={sendingEmail} 
                    onClick={handleResendInstructions}
                    className="h-8 text-[10px] uppercase font-bold"
                  >
                    <Send className="h-3 w-3 mr-1" /> Reenviar
                  </Button>
                </div>
              </div>
            </div>

            {/* Secção 2: Contrato */}
            <div className="space-y-4">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <CreditCard className="h-3 w-3" /> Acções de Contrato
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Plano</label>
                  <select 
                    value={plano} 
                    onChange={(e) => setPlano(e.target.value as any)}
                    className="w-full text-xs rounded-lg border-slate-200 bg-white p-2 focus:ring-[#1F6B3B]"
                  >
                    <option value="essencial">Essencial</option>
                    <option value="profissional">Profissional</option>
                    <option value="premium">Premium</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Ciclo</label>
                  <select 
                    value={ciclo} 
                    onChange={(e) => setCiclo(e.target.value as any)}
                    className="w-full text-xs rounded-lg border-slate-200 bg-white p-2 focus:ring-[#1F6B3B]"
                  >
                    <option value="mensal">Mensal</option>
                    <option value="anual">Anual</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Valor Customizado (Kz)</label>
                <input 
                  type="number" 
                  value={valor} 
                  onChange={(e) => setValor(Number(e.target.value))}
                  className="w-full text-sm font-mono font-bold rounded-lg border-slate-200 bg-white p-2 text-slate-700"
                />
              </div>
            </div>

            {/* Secção 3: Status */}
            <div className="space-y-3">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <AlertTriangle className="h-3 w-3" /> Gestão de Status
              </h3>
              <div className="flex gap-2">
                <Button 
                  fullWidth 
                  variant="outline" 
                  tone={data.status === 'activa' ? 'red' : 'green'}
                  className="text-[10px] uppercase font-bold h-10"
                  onClick={handleToggleStatus}
                >
                  {data.status === 'activa' ? 'Suspender Escola' : 'Reactivar Escola'}
                </Button>
              </div>
            </div>

            {/* Secção 4: Notas */}
            <div className="space-y-3">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <FileText className="h-3 w-3" /> Auditoria & Notas Internas
              </h3>
              <textarea 
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Acordos especiais, descontos manuais, historial de contacto..."
                className="w-full h-32 text-xs rounded-xl border-slate-200 bg-slate-50 p-3 placeholder:text-slate-400 focus:bg-white transition-all"
              />
            </div>

          </div>

          {/* Footer */}
          <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex gap-3">
            <Button variant="outline" fullWidth onClick={onClose}>Cancelar</Button>
            <Button 
              fullWidth 
              tone="green" 
              loading={saving} 
              onClick={handleSave}
              className="bg-[#1F6B3B] hover:bg-[#1F6B3B]/90 text-white font-bold"
            >
              Guardar Alterações
            </Button>
          </div>

        </div>
      </div>
    </>
  );
}
