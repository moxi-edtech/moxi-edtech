"use client";

import { useState } from 'react';
import { toast } from 'sonner';
import Button from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { StepHeader } from './StepHeader';

type Props = {
  escolaId: string;
  tipoPresenca: 'secao' | 'curso';
  estrutura: 'classes' | 'secoes' | 'cursos';
  onTipoPresencaChange: (v: 'secao' | 'curso') => void;
  onEstruturaChange: (v: 'classes' | 'secoes' | 'cursos') => void;
  autoGeneratePeriods?: boolean;
  onAutoGeneratePeriodsChange?: (v: boolean) => void;
  periodType?: 'semestre' | 'trimestre';
  onPeriodTypeChange?: (v: 'semestre' | 'trimestre') => void;
};

export default function TipoPresencaStep({ escolaId, tipoPresenca, estrutura, onTipoPresencaChange, onEstruturaChange, autoGeneratePeriods = false, onAutoGeneratePeriodsChange, periodType = 'semestre', onPeriodTypeChange }: Props) {
  const [loading, setLoading] = useState(false);

  const handleSalvar = async () => {
    setLoading(true);
    const id = toast.loading('Salvando preferências...');
    try {
      const res = await fetch(`/api/escolas/${escolaId}/onboarding/preferences`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo_presenca: tipoPresenca, estrutura, autogerar_periodos: autoGeneratePeriods, periodo_tipo: periodType }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Falha ao salvar.');
      toast.success('Preferências salvas!', { id });
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar.', { id });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <StepHeader icone={<span className="text-3xl">✅</span>} titulo="Tipo de Presença" descricao="Defina como a frequência é registrada e a estrutura principal da escola." />

      <div className="grid md:grid-cols-2 gap-6">
        <button
          type="button"
          onClick={() => onTipoPresencaChange('secao')}
          className={`p-6 border-2 rounded-lg text-left transition-all ${tipoPresenca === 'secao' ? 'border-teal-500 bg-teal-50' : 'border-gray-200 hover:border-gray-300'}`}
        >
          <div className="text-3xl mb-2">👥</div>
          <h3 className="font-semibold mb-1">Por Seção/Turma</h3>
          <p className="text-sm text-gray-600">Ideal para escolas com organização tradicional por turmas.</p>
        </button>

        <button
          type="button"
          onClick={() => onTipoPresencaChange('curso')}
          className={`p-6 border-2 rounded-lg text-left transition-all ${tipoPresenca === 'curso' ? 'border-teal-500 bg-teal-50' : 'border-gray-200 hover:border-gray-300'}`}
        >
          <div className="text-3xl mb-2">📚</div>
          <h3 className="font-semibold mb-1">Por Curso/Disciplina</h3>
          <p className="text-sm text-gray-600">Ideal para contextos com grades curriculares variadas.</p>
        </button>
      </div>

      <div className="max-w-sm">
        <Select label="Estrutura Acadêmica" value={estrutura} onChange={(e) => onEstruturaChange(e.target.value as any)}>
          <option value="classes">Classes</option>
          <option value="secoes">Seções</option>
          <option value="cursos">Cursos</option>
        </Select>
        <p className="text-xs text-gray-500 mt-1">Escolha a estrutura predominante para organização.</p>
      </div>

      <div className="max-w-sm">
        <Select label="Tipo de Período" value={periodType} onChange={(e) => onPeriodTypeChange?.(e.target.value as 'semestre' | 'trimestre')}>
          <option value="semestre">Semestral (2 períodos)</option>
          <option value="trimestre">Trimestral (3 períodos)</option>
        </Select>
        <p className="text-xs text-gray-500 mt-1">Define como o ano letivo será dividido.</p>
      </div>

      <div className="max-w-sm">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={!!autoGeneratePeriods}
            onChange={(e) => onAutoGeneratePeriodsChange?.(e.target.checked)}
          />
          Gerar períodos automaticamente ao salvar sessão
        </label>
        <p className="text-xs text-gray-500 mt-1">
          Ao criar/atualizar o ano letivo, cria automaticamente os períodos (semestres/trimestres) de acordo com as preferências.
        </p>
      </div>

      <div className="pt-2">
        <Button onClick={handleSalvar} loading={loading}>Salvar Configuração</Button>
      </div>
    </div>
  );
}
