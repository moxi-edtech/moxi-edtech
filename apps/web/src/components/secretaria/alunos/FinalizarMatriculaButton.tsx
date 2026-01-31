"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Button } from './ui/button'; // Assumindo que você tem um componente Button
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog'; // Assumindo componentes de Dialog
import { toast } from 'react-hot-toast'; // Assumindo react-hot-toast para notificações

interface FinalizarMatriculaButtonProps {
  matriculaId: string;
  alunoNome: string;
  escolaId: string;
}

export function FinalizarMatriculaButton({ matriculaId, alunoNome, escolaId }: FinalizarMatriculaButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusFinal, setStatusFinal] = useState<'concluido' | 'reprovado' | ''>('');
  const [motivo, setMotivo] = useState('');

  const handleSubmit = async () => {
    if (!statusFinal) {
      toast.error('Selecione um status final.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/secretaria/matriculas/${matriculaId}/finalizar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          novo_status: statusFinal,
          motivo: motivo || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao finalizar matrícula.');
      }

      toast.success(`Matrícula de ${alunoNome} finalizada como ${statusFinal}.`);
      setOpen(false);
      router.refresh(); // Recarregar a página para mostrar o status atualizado
    } catch (error: any) {
      toast.error(error.message || 'Falha ao finalizar matrícula.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-orange-500 text-white hover:bg-orange-600 text-sm font-medium">
          Finalizar Ano
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Finalizar Ano Letivo de {alunoNome}</DialogTitle>
          <DialogDescription>
            Selecione o status final da matrícula e, opcionalmente, um motivo.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="status" className="text-sm font-medium">
              Status Final
            </label>
            <select
              id="status"
              value={statusFinal}
              onChange={(e) => setStatusFinal(e.target.value as 'concluido' | 'reprovado' | '')}
              className="col-span-3 px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
              disabled={loading}
            >
              <option value="">Selecione...</option>
              <option value="concluido">Concluído</option>
              <option value="reprovado">Reprovado</option>
              {/* Opção para "transferido" pode ser adicionada aqui, mas é um fluxo diferente */}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="motivo" className="text-sm font-medium">
              Motivo (opcional)
            </label>
            <textarea
              id="motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="col-span-3 px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
              disabled={loading}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !statusFinal}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar Finalização
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}