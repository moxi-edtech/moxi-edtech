// apps/web/src/components/super-admin/escolas/SchoolRow.tsx
"use client"

import type { School, OnboardingProgress, EditForm } from "./types";
import { ExternalLink, CreditCard, Power, Trash2, Edit3, Save, X } from "lucide-react";

type SchoolRowProps = {
  school: School;
  progress?: OnboardingProgress;
  editingId: string | number | null;
  editForm: EditForm;
  saving: string | number | null;
  onEdit: (school: School) => void;
  onSave: (schoolId: string | number) => void;
  onCancel: () => void;
  onInputChange: (field: keyof School, value: string) => void;
  onViewDetails: (schoolId: string | number) => void;
  onEnterPortal: (schoolId: string | number) => void;
  onSendBilling: (schoolId: string | number) => void;
  onSuspend: (school: School) => void;
  onDelete: (school: School) => void;
};

export function SchoolRow({
  school,
  progress,
  editingId,
  editForm,
  saving,
  onEdit,
  onSave,
  onCancel,
  onInputChange,
  onViewDetails,
  onEnterPortal,
  onSendBilling,
  onSuspend,
  onDelete,
}: SchoolRowProps) {
  const isEditing = String(editingId) === String(school.id);

  const calcSaude = () => {
    const lastAccess = school.lastAccess ? new Date(school.lastAccess).getTime() : null;
    const horasDesdeLogin = lastAccess ? (Date.now() - lastAccess) / 36e5 : 999;
    const onboardingStep = Number(progress?.last_step ?? 0);
    const onboardingScore = progress?.onboarding_finalizado ? 25 : Math.round(onboardingStep * 8);

    return (
      (school.students > 0 ? 25 : 0) +
      onboardingScore +
      (horasDesdeLogin < 48 ? 25 : horasDesdeLogin < 168 ? 12 : 0) +
      (String(school.status).toLowerCase() === "ativa" ? 25 : 0)
    );
  };

  const saude = calcSaude();

  const SaudeBar = ({ valor }: { valor: number }) => {
    const cor = valor >= 80 ? "bg-[#1F6B3B]" : valor >= 60 ? "bg-[#E3B23C]" : "bg-rose-500";
    return (
      <div className="flex items-center gap-3">
        <div className="w-16 h-1.5 bg-slate-50 rounded-full overflow-hidden border border-slate-100">
          <div className={`h-full rounded-full ${cor} transition-all duration-1000`} style={{ width: `${valor}%` }} />
        </div>
        <span className="text-[10px] font-black text-slate-900">{valor}%</span>
      </div>
    );
  };

  const statusBadge = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s === 'ativa') return <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-[#1F6B3B]/10 text-[#1F6B3B] border border-[#1F6B3B]/20">Ativa</span>;
    if (s === 'suspensa') return <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-rose-50 text-rose-600 border border-rose-100">Suspensa</span>;
    return <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-slate-50 text-slate-400 border border-slate-100">Pendente</span>;
  };

  const renderReadonly = () => (
    <tr className="group transition-colors hover:bg-slate-50/50">
      <td className="py-5 px-6">
        <div>
          <div className="text-sm font-black text-slate-900 uppercase tracking-tight">{school.name}</div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ID: {school.id.toString().substring(0, 8)}...</div>
        </div>
      </td>
      <td className="py-5 px-6">
        <div className="text-sm font-bold text-slate-700">{school.responsavel || '—'}</div>
        <div className="text-[10px] font-medium text-slate-400">{school.email || '—'}</div>
      </td>
      <td className="py-5 px-6">
        <div className="text-[11px] font-bold text-slate-600 uppercase tracking-tight">
          {school.city || school.state ? `${school.city || ''} / ${school.state || ''}` : '—'}
        </div>
      </td>
      <td className="py-5 px-6">{statusBadge(String(school.status))}</td>
      <td className="py-5 px-6"><SaudeBar valor={saude} /></td>
      <td className="py-5 px-6">
        <span className="text-[10px] font-black text-slate-500 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-md uppercase tracking-widest">
          {school.plan}
        </span>
      </td>
      <td className="py-5 px-6">
        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <button 
            title="Abrir Portal" 
            onClick={() => onEnterPortal(school.id)} 
            className="h-9 w-9 flex items-center justify-center rounded-xl text-slate-400 hover:text-[#1F6B3B] hover:bg-[#1F6B3B]/5 transition-all"
          >
            <ExternalLink size={16} />
          </button>
          
          <button 
            title="Financeiro" 
            onClick={() => onSendBilling(school.id)} 
            className="h-9 w-9 flex items-center justify-center rounded-xl text-slate-400 hover:text-[#E3B23C] hover:bg-[#E3B23C]/5 transition-all"
          >
            <CreditCard size={16} />
          </button>
          
          <button 
            title="Editar Unidade" 
            onClick={() => onEdit(school)} 
            className="h-9 w-9 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-all"
          >
            <Edit3 size={16} />
          </button>
          
          <div className="w-px h-4 bg-slate-100 mx-1" />

          <button 
            title={String(school.status).toLowerCase() === 'suspensa' ? 'Reactivar' : 'Suspender'} 
            onClick={() => onSuspend(school)} 
            className="h-9 w-9 flex items-center justify-center rounded-xl text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-all"
          >
            <Power size={16} />
          </button>
          
          <button 
            title="Remover Unidade" 
            onClick={() => onDelete(school)} 
            className="h-9 w-9 flex items-center justify-center rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </td>
    </tr>
  );

  const valueOrForm = (field: keyof School, fallback: any) => {
    const v = (editForm as any)[field];
    return v === undefined || v === null ? fallback : v;
  };

  const inputCls = "h-9 border border-slate-200 bg-white rounded-xl px-3 text-xs font-bold text-slate-900 outline-none focus:border-[#1F6B3B] transition-all w-full";

  const renderEditing = () => (
    <tr className="bg-[#1F6B3B]/5">
      <td className="py-4 px-6" colSpan={2}>
        <div className="space-y-2">
          <input className={inputCls} placeholder="Nome da Unidade" value={String(valueOrForm('name', school.name))} onChange={(e) => onInputChange('name', e.target.value)} />
          <div className="flex gap-2">
            <input className={inputCls} placeholder="Responsável" value={String(valueOrForm('responsavel', school.responsavel || ''))} onChange={(e) => onInputChange('responsavel', e.target.value)} />
            <input className={inputCls} placeholder="Email" value={String(valueOrForm('email', school.email || ''))} onChange={(e) => onInputChange('email', e.target.value)} />
          </div>
        </div>
      </td>
      <td className="py-4 px-6">
        <div className="space-y-2">
          <input className={inputCls} placeholder="Cidade" value={String(valueOrForm('city', school.city || ''))} onChange={(e) => onInputChange('city', e.target.value)} />
          <input className={inputCls} placeholder="Estado" value={String(valueOrForm('state', school.state || ''))} onChange={(e) => onInputChange('state', e.target.value)} />
        </div>
      </td>
      <td className="py-4 px-6">
        <select className={inputCls} value={String(valueOrForm('status', school.status || 'ativa'))} onChange={(e) => onInputChange('status', e.target.value)}>
          <option value="ativa">Ativa</option>
          <option value="suspensa">Suspensa</option>
          <option value="pendente">Pendente</option>
        </select>
      </td>
      <td className="py-4 px-6" />
      <td className="py-4 px-6">
        <select className={inputCls} value={String(valueOrForm('plan', school.plan || 'Essencial'))} onChange={(e) => onInputChange('plan', e.target.value)}>
          <option value="Essencial">Essencial</option>
          <option value="Profissional">Profissional</option>
          <option value="Premium">Premium</option>
        </select>
      </td>
      <td className="py-4 px-6">
        <div className="flex gap-2">
          <button 
            disabled={String(saving) === String(school.id)} 
            onClick={() => onSave(school.id)}
            className="h-9 w-9 rounded-xl bg-[#1F6B3B] text-white flex items-center justify-center hover:brightness-110 shadow-sm"
          >
            {String(saving) === String(school.id) ? <span className="animate-spin text-[10px]">...</span> : <Save size={16} />}
          </button>
          <button onClick={onCancel} className="h-9 w-9 rounded-xl border border-slate-200 bg-white text-slate-400 flex items-center justify-center hover:bg-slate-50 transition-colors">
            <X size={16} />
          </button>
        </div>
      </td>
    </tr>
  );

  return isEditing ? renderEditing() : renderReadonly();
}
