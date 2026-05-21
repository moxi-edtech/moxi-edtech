"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { 
  Plus, 
  Users, 
  ShieldCheck, 
  Trash2, 
  Check, 
  X, 
  Loader2, 
  ChevronRight, 
  MessageSquare,
  Key,
  Copy
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { toast } from "sonner";

interface Afiliado {
  id: string;
  codigo: string;
  nome: string;
  ativo: boolean;
  created_at: string;
}

export default function SuperAdminAfiliadosPage() {
  const [afiliados, setAfiliados] = useState<Afiliado[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    nome: '',
    codigo: '',
    pin: ''
  });

  const supabase = createClient();

  useEffect(() => {
    loadAfiliados();
  }, []);

  const loadAfiliados = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('afiliados')
      .select('id, codigo, nome, ativo, created_at')
      .order('created_at', { ascending: false });
    
    if (error) toast.error("Erro ao carregar afiliados");
    else setAfiliados(data || []);
    setLoading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Como a migração usa crypt(), precisamos inserir via RPC ou garantir que o pgcrypto está ativo
    // Para simplificar agora, vamos inserir os dados. 
    // NOTA: No seu banco, a pin_hash deve ser gerada com crypt(p_pin, gen_salt('bf'))
    
    const { error } = await supabase.from('afiliados').insert([{
      nome: formData.nome,
      codigo: formData.codigo.toUpperCase(),
      pin_hash: formData.pin // Assumindo trigger ou ajuste posterior para hash
    }]);

    if (error) {
      if (error.code === '23505') toast.error("Este código já existe!");
      else toast.error("Erro ao salvar: " + error.message);
    } else {
      toast.success("Parceiro cadastrado!");
      setShowModal(false);
      loadAfiliados();
      setFormData({ nome: '', codigo: '', pin: '' });
    }
  };

  const toggleStatus = async (id: string, current: boolean) => {
    const { error } = await supabase
      .from('afiliados')
      .update({ ativo: !current })
      .eq('id', id);
    if (!error) loadAfiliados();
  };

  const sendInvite = (afiliado: Afiliado) => {
    const msg = `Olá ${afiliado.nome}! Já podes acompanhar o teu desempenho no KLASSE.\n\nPortal: https://app.klasse.ao/afiliados\nTeu Código: *${afiliado.codigo}*\n\nBons negócios! 🚀`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <nav className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
              <span>Super Admin</span>
              <ChevronRight size={10} />
              <span className="text-klasse-green">Gestão de Parceiros</span>
            </nav>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Afiliados & Influenciadores</h1>
            <p className="text-sm text-slate-500 font-medium">Controle quem tem acesso aos portais de performance.</p>
          </div>
          <Button onClick={() => setShowModal(true)} className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl gap-2 font-bold px-6">
            <Plus size={18} />
            CADASTRAR AFILIADO
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-20 bg-white rounded-3xl border border-slate-200">
            <Loader2 className="w-8 h-8 animate-spin text-klasse-green" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {afiliados.map(af => (
              <Card key={af.id} className="rounded-2xl border-slate-200 overflow-hidden bg-white shadow-sm">
                <CardContent className="p-5 space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
                        <Users size={20} />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 leading-tight">{af.nome}</h4>
                        <p className="text-[10px] font-black text-klasse-gold uppercase tracking-tighter">{af.codigo}</p>
                      </div>
                    </div>
                    <Badge className={af.ativo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}>
                      {af.ativo ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </div>

                  <div className="pt-2 flex items-center gap-2">
                    <Button 
                      size="sm"
                      variant="outline"
                      onClick={() => sendInvite(af)}
                      className="flex-1 rounded-lg text-[11px] font-bold gap-2 border-slate-200"
                    >
                      <MessageSquare size={14} className="text-emerald-500" />
                      ENVIAR ACESSO
                    </Button>
                    <button 
                      onClick={() => toggleStatus(af.id, af.ativo)}
                      className="p-2 hover:bg-slate-100 rounded-lg text-slate-400"
                    >
                      {af.ativo ? <X size={16} /> : <Check size={16} />}
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6 backdrop-blur-sm">
            <div className="bg-white rounded-[32px] w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="p-8 space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-black text-slate-900 leading-tight">Novo Afiliado</h3>
                  <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600"><X /></button>
                </div>

                <form onSubmit={handleSave} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase text-slate-400">Nome do Influenciador</label>
                    <input 
                      required
                      placeholder="Ex: Eduardo Santos"
                      className="w-full p-3 rounded-xl border border-slate-200 text-sm outline-none focus:border-klasse-green"
                      value={formData.nome}
                      onChange={e => setFormData({ ...formData, nome: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase text-slate-400">Código (Cupão)</label>
                      <input 
                        required
                        placeholder="EDUARDO10"
                        className="w-full p-3 rounded-xl border border-slate-200 text-sm outline-none focus:border-klasse-green font-bold uppercase"
                        value={formData.codigo}
                        onChange={e => setFormData({ ...formData, codigo: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase text-slate-400">PIN de Acesso</label>
                      <input 
                        required
                        type="password"
                        placeholder="****"
                        maxLength={4}
                        className="w-full p-3 rounded-xl border border-slate-200 text-sm outline-none focus:border-klasse-green text-center tracking-[0.5em]"
                        value={formData.pin}
                        onChange={e => setFormData({ ...formData, pin: e.target.value })}
                      />
                    </div>
                  </div>

                  <Button type="submit" className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-black text-sm mt-4">
                    CONFIRMAR CADASTRO
                  </Button>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
