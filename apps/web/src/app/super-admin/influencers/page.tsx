"use client";

import { useState, useEffect } from "react";
import { 
  Plus, 
  Users, 
  Check, 
  X, 
  Loader2, 
  ChevronRight, 
  MessageSquare,
  Mail,
  UserPlus,
  ShieldCheck,
  Trash2
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { toast } from "sonner";

interface Afiliado {
  id: string;
  codigo: string;
  nome: string;
  email: string | null;
  ativo: boolean;
  created_at: string;
}

interface AfiliadoMember {
  id: string;
  afiliado_id: string;
  nome: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export default function SuperAdminAfiliadosPage() {
  const [afiliados, setAfiliados] = useState<Afiliado[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [savingMember, setSavingMember] = useState(false);
  const [selectedAfiliado, setSelectedAfiliado] = useState<Afiliado | null>(null);
  const [selectedMembers, setSelectedMembers] = useState<AfiliadoMember[]>([]);
  const [openWhatsappAfterSave, setOpenWhatsappAfterSave] = useState(true);
  const [formData, setFormData] = useState({
    nome: '',
    codigo: '',
    email: '',
    pin: ''
  });
  const [memberForm, setMemberForm] = useState({
    nome: '',
    pin: '',
  });

  useEffect(() => {
    loadAfiliados();
  }, []);

  const loadAfiliados = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/super-admin/influencers', { cache: 'no-store' });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error || 'Erro ao carregar influenciadores');
      }

      setAfiliados(result.items || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao carregar influenciadores');
    }
    setLoading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const inviteWindow = openWhatsappAfterSave ? window.open('', '_blank') : null;

    try {
      const response = await fetch('/api/super-admin/influencers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error || 'Erro ao salvar afiliado');
      }

      const created = result.afiliado as Afiliado | undefined;
      const emailOk = result.emailStatus?.ok === true;
      toast.success(emailOk ? 'Parceiro cadastrado e e-mail enviado.' : 'Parceiro cadastrado, mas o e-mail falhou.');

      if (openWhatsappAfterSave && created) {
        openInviteInWindow(inviteWindow, {
          nome: created.nome,
          codigo: created.codigo,
          email: created.email,
          pin: formData.pin,
        });
      }

      setShowModal(false);
      setFormData({ nome: '', codigo: '', email: '', pin: '' });
      await loadAfiliados();
    } catch (error) {
      if (inviteWindow) inviteWindow.close();
      const message = error instanceof Error ? error.message : 'Erro ao salvar afiliado';
      if (/duplicate key|23505|ux_afiliados_email_lower|afiliados_codigo/i.test(message)) {
        toast.error('Código ou e-mail já cadastrado.');
      } else {
        toast.error(message);
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (id: string, current: boolean) => {
    try {
      const response = await fetch('/api/super-admin/influencers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ativo: !current }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        throw new Error(result.error || 'Erro ao atualizar influenciador');
      }
      await loadAfiliados();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao atualizar influenciador');
    }
  };

  const loadMembers = async (afiliado: Afiliado) => {
    setSelectedAfiliado(afiliado);
    setLoadingMembers(true);
    try {
      const response = await fetch(`/api/super-admin/influencers/${afiliado.id}/members`, {
        cache: 'no-store',
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        throw new Error(result.error || 'Erro ao carregar membros');
      }
      setSelectedMembers(result.items || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao carregar membros');
      setSelectedMembers([]);
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAfiliado) return;
    if (/.+@.+\..+/.test(memberForm.nome.trim())) {
      toast.error('Use o nome do membro, não um e-mail.');
      return;
    }

    setSavingMember(true);
    try {
      const response = await fetch(`/api/super-admin/influencers/${selectedAfiliado.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(memberForm),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        throw new Error(result.error || 'Erro ao criar membro');
      }

      toast.success('Membro cadastrado com sucesso.');
      setMemberForm({ nome: '', pin: '' });
      await loadMembers(selectedAfiliado);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao criar membro';
      if (/duplicate key|23505/i.test(message)) {
        toast.error('Já existe um membro com este nome para o parceiro.');
      } else {
        toast.error(message);
      }
    } finally {
      setSavingMember(false);
    }
  };

  const toggleMemberStatus = async (member: AfiliadoMember) => {
    if (!selectedAfiliado) return;

    try {
      const response = await fetch(`/api/super-admin/influencers/${selectedAfiliado.id}/members`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: member.id, ativo: !member.ativo }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        throw new Error(result.error || 'Erro ao atualizar membro');
      }

      await loadMembers(selectedAfiliado);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao atualizar membro');
    }
  };

  const removeMember = async (member: AfiliadoMember) => {
    if (!selectedAfiliado) return;
    const confirmed = window.confirm(`Remover o membro "${member.nome}" deste parceiro?`);
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/super-admin/influencers/${selectedAfiliado.id}/members`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: member.id }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        throw new Error(result.error || 'Erro ao remover membro');
      }

      toast.success('Membro removido com sucesso.');
      await loadMembers(selectedAfiliado);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao remover membro');
    }
  };

  const sendInvite = (afiliado: Pick<Afiliado, 'nome' | 'codigo' | 'email'> & { pin?: string }) => {
    const lines = [
      `Olá ${afiliado.nome}! Já podes acompanhar a tua parceria no KLASSE.`,
      '',
      'Portal: https://app.klasse.ao/influencers',
      `Teu Código: *${afiliado.codigo}*`,
      afiliado.pin ? `PIN: *${afiliado.pin}*` : 'O teu PIN foi enviado por e-mail.',
      afiliado.email ? `E-mail: ${afiliado.email}` : '',
      '',
      'Bons negócios!',
    ];
    const msg = lines.filter(Boolean).join('\n');
    window.open(buildWhatsappInviteUrl(msg), '_blank');
  };

  const openInviteInWindow = (
    popup: Window | null,
    afiliado: Pick<Afiliado, 'nome' | 'codigo' | 'email'> & { pin?: string },
  ) => {
    const lines = [
      `Olá ${afiliado.nome}! Já podes acompanhar a tua parceria no KLASSE.`,
      '',
      'Portal: https://app.klasse.ao/influencers',
      `Teu Código: *${afiliado.codigo}*`,
      afiliado.pin ? `PIN: *${afiliado.pin}*` : 'O teu PIN foi enviado por e-mail.',
      afiliado.email ? `E-mail: ${afiliado.email}` : '',
      '',
      'Bons negócios!',
    ];
    const url = buildWhatsappInviteUrl(lines.filter(Boolean).join('\n'));
    if (popup && !popup.closed) {
      popup.location.href = url;
      return;
    }
    window.open(url, '_blank');
  };

  const buildWhatsappInviteUrl = (message: string) =>
    `https://wa.me/?text=${encodeURIComponent(message)}`;

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
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Digital Influencers</h1>
            <p className="text-sm text-slate-500 font-medium">Controle quem tem acesso aos portais de performance.</p>
          </div>
          <Button onClick={() => setShowModal(true)} className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl gap-2 font-bold px-6">
            <Plus size={18} />
            CADASTRAR INFLUENCER
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
                        {af.email && (
                          <p className="text-xs text-slate-500 mt-1">{af.email}</p>
                        )}
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
                      WHATSAPP
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => loadMembers(af)}
                      className="flex-1 rounded-lg text-[11px] font-bold gap-2 border-slate-200"
                    >
                      <ShieldCheck size={14} className="text-klasse-green" />
                      MEMBROS
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
                  <h3 className="text-xl font-black text-slate-900 leading-tight">Novo Influencer</h3>
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
                    <div className="space-y-1.5 col-span-2">
                      <label className="text-[10px] font-bold uppercase text-slate-400">E-mail</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                        <input
                          required
                          type="email"
                          placeholder="nome@dominio.com"
                          className="w-full p-3 pl-10 rounded-xl border border-slate-200 text-sm outline-none focus:border-klasse-green"
                          value={formData.email}
                          onChange={e => setFormData({ ...formData, email: e.target.value })}
                        />
                      </div>
                    </div>
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

                  <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={openWhatsappAfterSave}
                      onChange={e => setOpenWhatsappAfterSave(e.target.checked)}
                      className="rounded border-slate-300"
                    />
                    <span className="text-sm text-slate-600 font-medium">
                      Abrir WhatsApp com código e PIN após cadastrar
                    </span>
                  </label>

                  <Button type="submit" disabled={saving} className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-black text-sm mt-4">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'CONFIRMAR CADASTRO'}
                  </Button>
                </form>
              </div>
            </div>
          </div>
        )}

        {selectedAfiliado && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6 backdrop-blur-sm">
            <div className="bg-white rounded-[32px] w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="p-8 space-y-6">
                <div className="flex justify-between items-center gap-4">
                  <div>
                    <h3 className="text-xl font-black text-slate-900 leading-tight">{selectedAfiliado.nome}</h3>
                    <p className="text-xs font-bold uppercase tracking-widest text-klasse-gold">{selectedAfiliado.codigo}</p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedAfiliado(null);
                      setSelectedMembers([]);
                      setMemberForm({ nome: '', pin: '' });
                    }}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X />
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Membros do parceiro</p>
                        <p className="text-sm text-slate-500">Use membros separados para rastrear acessos e uploads.</p>
                      </div>
                      <Badge className="bg-slate-100 text-slate-700">
                        {selectedMembers.length} membro(s)
                      </Badge>
                    </div>

                    {loadingMembers ? (
                      <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 p-10">
                        <Loader2 className="w-6 h-6 animate-spin text-klasse-green" />
                      </div>
                    ) : selectedMembers.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                        <p className="text-sm font-medium text-slate-500">Nenhum membro adicional cadastrado.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {selectedMembers.map((member) => (
                          <div key={member.id} className="flex items-center justify-between rounded-2xl border border-slate-200 p-4">
                            <div>
                              <p className="font-bold text-slate-900">{member.nome}</p>
                              <p className="text-xs text-slate-500">Actualizado em {new Date(member.updated_at).toLocaleDateString('pt-AO')}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge className={member.ativo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}>
                                {member.ativo ? 'Ativo' : 'Inativo'}
                              </Badge>
                              <button
                                onClick={() => removeMember(member)}
                                className="p-2 hover:bg-rose-50 rounded-lg text-rose-400"
                                title="Remover membro"
                              >
                                <Trash2 size={16} />
                              </button>
                              <button
                                onClick={() => toggleMemberStatus(member)}
                                className="p-2 hover:bg-slate-100 rounded-lg text-slate-400"
                                title={member.ativo ? 'Inativar membro' : 'Reativar membro'}
                              >
                                {member.ativo ? <X size={16} /> : <Check size={16} />}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <UserPlus size={16} className="text-klasse-green" />
                      <h4 className="text-sm font-black text-slate-900">Adicionar membro</h4>
                    </div>
                    <form onSubmit={handleCreateMember} className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase text-slate-400">Nome do membro</label>
                        <input
                          required
                          placeholder="Ex: Operador Comercial"
                          className="w-full p-3 rounded-xl border border-slate-200 text-sm outline-none focus:border-klasse-green bg-white"
                          value={memberForm.nome}
                          onChange={e => setMemberForm({ ...memberForm, nome: e.target.value })}
                        />
                        <p className="text-[11px] text-slate-500">
                          Use o nome operacional do membro. E-mail não é aceite neste campo.
                        </p>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase text-slate-400">PIN pessoal</label>
                        <input
                          required
                          type="password"
                          minLength={4}
                          placeholder="PIN do membro"
                          className="w-full p-3 rounded-xl border border-slate-200 text-sm outline-none focus:border-klasse-green bg-white text-center tracking-[0.4em]"
                          value={memberForm.pin}
                          onChange={e => setMemberForm({ ...memberForm, pin: e.target.value })}
                        />
                      </div>
                      <Button
                        type="submit"
                        disabled={savingMember}
                        className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-black text-sm"
                      >
                        {savingMember ? <Loader2 className="w-4 h-4 animate-spin" /> : 'CRIAR MEMBRO'}
                      </Button>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
