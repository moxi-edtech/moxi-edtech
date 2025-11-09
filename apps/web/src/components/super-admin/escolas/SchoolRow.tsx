import type { School, OnboardingProgress, EditForm } from "./types";
import Button from "@/components/ui/Button";

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
  isEven?: boolean;
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
  isEven,
}: SchoolRowProps) {
  const isEditing = String(editingId) === String(school.id);

  const statusBadge = (status: string) => {
    const base = "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium";
    switch ((status || '').toLowerCase()) {
      case "ativa":
        return <span className={`${base} bg-green-50 text-green-700 border border-green-200`}>Ativa</span>;
      case "suspensa":
        return <span className={`${base} bg-amber-50 text-amber-700 border border-amber-200`}>Suspensa</span>;
      case "pendente":
        return <span className={`${base} bg-gray-50 text-gray-700 border border-gray-200`}>Pendente</span>;
      default:
        return <span className={`${base} bg-gray-50 text-gray-700 border border-gray-200`}>{status || '—'}</span>;
    }
  };

  const onboardingBadge = () => {
    const done = Boolean(progress?.onboarding_finalizado);
    const step = Number(progress?.last_step ?? 1);
    return (
      <div className="flex items-center gap-2">
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${done ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-purple-50 text-purple-700 border border-purple-200'}`}>
          {done ? 'Concluído' : `Etapa ${step}`}
        </span>
      </div>
    );
  };

  const renderReadonly = () => (
    <tr className={`${isEven ? 'bg-white' : 'bg-gray-50/30'} hover:bg-gray-50 transition-colors`}>
      <td className="py-4 px-4">
        <div className="font-medium text-gray-900">{school.name}</div>
        <div className="text-xs text-gray-500">ID: {String(school.id)}</div>
      </td>
      <td className="py-4 px-4 text-gray-700">{school.responsavel || '—'}</td>
      <td className="py-4 px-4">
        <div className="text-gray-700 text-sm">{school.email || '—'}</div>
        <div className="text-gray-500 text-xs">{school.telefone || ''}</div>
      </td>
      <td className="py-4 px-4 text-gray-700">
        {school.city || school.state ? `${school.city || ''}${school.city && school.state ? ' / ' : ''}${school.state || ''}` : '—'}
      </td>
      <td className="py-4 px-4">{statusBadge(String(school.status))}</td>
      <td className="py-4 px-4">{onboardingBadge()}</td>
      <td className="py-4 px-4">
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-50 text-gray-700 border border-gray-200">
          {school.plan || '—'}
        </span>
      </td>
      <td className="py-4 px-4 text-gray-700">{school.lastAccess || '—'}</td>
      <td className="py-4 px-4">
        <div className="flex flex-wrap gap-2">
          <button className="px-2.5 py-1.5 text-xs rounded-md border border-gray-300 hover:bg-gray-50" onClick={() => onViewDetails(school.id)}>Detalhes</button>
          <button className="px-2.5 py-1.5 text-xs rounded-md border border-gray-300 hover:bg-gray-50" onClick={() => onEnterPortal(school.id)}>Portal</button>
          <button className="px-2.5 py-1.5 text-xs rounded-md border border-blue-300 text-blue-700 hover:bg-blue-50" onClick={() => onSendBilling(school.id)}>Cobrança</button>
          <button className="px-2.5 py-1.5 text-xs rounded-md border border-amber-300 text-amber-700 hover:bg-amber-50" onClick={() => onSuspend(school)}>
            {String(school.status).toLowerCase() === 'suspensa' ? 'Reativar' : 'Suspender'}
          </button>
          <button className="px-2.5 py-1.5 text-xs rounded-md border border-red-300 text-red-700 hover:bg-red-50" onClick={() => onDelete(school)}>Excluir</button>
          <button className="px-2.5 py-1.5 text-xs rounded-md border border-gray-300 hover:bg-gray-50" onClick={() => onEdit(school)}>Editar</button>
        </div>
      </td>
    </tr>
  );

  const valueOrForm = (field: keyof School, fallback: any) => {
    const v = (editForm as any)[field];
    return v === undefined || v === null ? fallback : v;
    };

  const renderEditing = () => (
    <tr className="bg-yellow-50/40">
      <td className="py-3 px-4">
        <input className="w-full border rounded-md px-3 py-1.5 text-sm" value={String(valueOrForm('name', school.name))} onChange={(e) => onInputChange('name', e.target.value)} />
        <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
          <input className="border rounded-md px-2 py-1" placeholder="Responsável" value={String(valueOrForm('responsavel', school.responsavel || ''))} onChange={(e) => onInputChange('responsavel', e.target.value)} />
          <input className="border rounded-md px-2 py-1" placeholder="Email" value={String(valueOrForm('email', school.email || ''))} onChange={(e) => onInputChange('email', e.target.value)} />
        </div>
      </td>
      <td className="py-3 px-4"></td>
      <td className="py-3 px-4">
        <input className="w-full border rounded-md px-2 py-1 text-sm" placeholder="Telefone" value={String(valueOrForm('telefone', school.telefone || ''))} onChange={(e) => onInputChange('telefone', e.target.value)} />
      </td>
      <td className="py-3 px-4">
        <div className="grid grid-cols-2 gap-2">
          <input className="border rounded-md px-2 py-1 text-sm" placeholder="Cidade" value={String(valueOrForm('city', school.city || ''))} onChange={(e) => onInputChange('city', e.target.value)} />
          <input className="border rounded-md px-2 py-1 text-sm" placeholder="Estado" value={String(valueOrForm('state', school.state || ''))} onChange={(e) => onInputChange('state', e.target.value)} />
        </div>
      </td>
      <td className="py-3 px-4">
        <select className="border rounded-md px-2 py-1 text-sm" value={String(valueOrForm('status', school.status || 'ativa'))} onChange={(e) => onInputChange('status', e.target.value)}>
          <option value="ativa">Ativa</option>
          <option value="suspensa">Suspensa</option>
          <option value="pendente">Pendente</option>
        </select>
      </td>
      <td className="py-3 px-4">{onboardingBadge()}</td>
      <td className="py-3 px-4">
        <select className="border rounded-md px-2 py-1 text-sm" value={String(valueOrForm('plan', school.plan || 'Básico'))} onChange={(e) => onInputChange('plan', e.target.value)}>
          <option value="Básico">Básico</option>
          <option value="Premium">Premium</option>
          <option value="Enterprise">Enterprise</option>
        </select>
      </td>
      <td className="py-3 px-4 text-gray-700">{school.lastAccess || '—'}</td>
      <td className="py-3 px-4">
        <div className="flex gap-2">
          <Button disabled={String(saving) === String(school.id)} tone="green" size="sm" className="px-3" onClick={() => onSave(school.id)}>
            {String(saving) === String(school.id) ? 'Salvando...' : 'Salvar'}
          </Button>
          <Button variant="outline" tone="gray" size="sm" className="px-3" onClick={onCancel}>Cancelar</Button>
        </div>
      </td>
    </tr>
  );

  return isEditing ? renderEditing() : renderReadonly();
}
