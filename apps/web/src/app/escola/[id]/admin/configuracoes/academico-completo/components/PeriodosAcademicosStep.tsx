"use client";

import { useState } from 'react';
import { toast } from 'sonner';
import { type AcademicPeriod, type AcademicSession } from '@/types/academico.types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { StepHeader } from './StepHeader';

type Props = {
  escolaId: string;
  sessaoAtiva: AcademicSession | null;
  periodos: AcademicPeriod[];
  onPeriodosAtualizados: (periodos: AcademicPeriod[]) => void;
};

// Opções para o tipo de período acadêmico
const periodosOptions = [
  { value: 'TRIMESTRE', label: 'Trimestre' },
  { value: 'BIMESTRE', label: 'Bimestre' },
  { value: 'SEMESTRE', label: 'Semestre' },
  { value: 'ANUAL', label: 'Anual' },
];

export default function PeriodosAcademicosStep({ escolaId, sessaoAtiva, periodos, onPeriodosAtualizados }: Props) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nome: "",
    tipo: "TRIMISTRE",
    data_inicio: "",
    data_fim: "",
  });

  const handleCriarPeriodo = async () => {
    if (!sessaoAtiva) {
      toast.warning("Crie e ative uma sessão acadêmica primeiro.");
      return;
    }
    setLoading(true);
    const toastId = toast.loading("Criando período acadêmico...");

    try {
      // O endpoint da API pode continuar o mesmo ou ser alterado para /periodos
      const res = await fetch(`/api/escolas/${escolaId}/semestres`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          sessao_id: sessaoAtiva.id,
          numero: periodos.length + 1,
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Falha ao criar o período.");

      onPeriodosAtualizados([...periodos, result.data]);
      setFormData({ nome: "", tipo: "TRIMESTRE", data_inicio: "", data_fim: "" }); // Reset form
      toast.success("Período criado com sucesso!", { id: toastId });
    } catch (error: any) {
      toast.error(error.message, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <StepHeader
        icone={<span className="text-3xl">📚</span>}
        titulo="Criar Períodos Acadêmicos"
        descricao="Divida o ano letivo em partes como semestres, trimestres ou bimestres."
      />

      {!sessaoAtiva ? (
        <div className="text-center py-10">
          <p className="text-gray-600">Por favor, crie uma sessão acadêmica no passo anterior para adicionar períodos.</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="p-6 border rounded-lg bg-gray-50/50 space-y-4">
            <h3 className="font-semibold text-lg">Adicionar Novo Período</h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Input
                label="Nome do Período"
                placeholder="Ex: 1º Trimestre, 2º Semestre, 3º Bimestre"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              />
              <Select
                label="Tipo de Período"
                options={periodosOptions}
                value={formData.tipo}
                onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
              />
              <Input
                label="Data de Início"
                type="date"
                value={formData.data_inicio}
                onChange={(e) => setFormData({ ...formData, data_inicio: e.target.value })}
              />
              <Input
                label="Data de Término"
                type="date"
                value={formData.data_fim}
                onChange={(e) => setFormData({ ...formData, data_fim: e.target.value })}
              />
            </div>
            <div className="flex justify-end pt-2">
              <Button
                onClick={handleCriarPeriodo}
                loading={loading}
                disabled={!formData.nome || !formData.data_inicio || !formData.data_fim}
              >
                Adicionar Período
              </Button>
            </div>
          </div>

          {periodos.length > 0 && (
            <div>
              <h3 className="font-semibold text-lg mb-4">Períodos Configurados</h3>
              <div className="space-y-2">
                {periodos.map((periodo) => (
                  <div key={periodo.id} className="flex justify-between items-center p-3 bg-white border rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-gray-800">{periodo.nome}</span>
                      <span className="text-xs font-semibold bg-teal-100 text-teal-800 px-2 py-0.5 rounded-full">
                        {periodo.tipo}
                      </span>
                    </div>
                    <span className="text-sm text-gray-600">{periodo.data_inicio} a {periodo.data_fim}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}