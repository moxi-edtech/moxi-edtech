// ModalRegistrarPagamento.tsx
'use client';
import React, { useState } from 'react';
import { X, DollarSign, Landmark, CreditCard, Smartphone, Loader2 } from 'lucide-react';

interface ModalRegistrarPagamentoProps {
  aluno: {
    id: string;
    nome: string;
    turma: string;
  };
  mensalidades: Array<{
    id: string;
    mesReferencia: number;
    anoReferencia: number;
    valor: number;
    status: string;
    dataVencimento?: Date | null;
    diasAtraso?: number;
  }>;
  onClose: () => void;
  onConfirm: (pagamento: any) => void;
}

const ModalRegistrarPagamento: React.FC<ModalRegistrarPagamentoProps> = ({
  aluno,
  mensalidades,
  onClose,
  onConfirm
}) => {
  const [etapa, setEtapa] = useState(1);
  const [mensalidadesSelecionadas, setMensalidadesSelecionadas] = useState<string[]>([]);
  const [metodoPagamento, setMetodoPagamento] = useState<string>('');
  const [valorRecebido, setValorRecebido] = useState<string>('');
  const [comprovante, setComprovante] = useState<File | null>(null);

  const mensalidadesPendentes = mensalidades.filter(m => m.status === 'pendente' || m.status === 'atrasada');
  const totalSelecionado = mensalidadesPendentes
    .filter(m => mensalidadesSelecionadas.includes(m.id))
    .reduce((sum, m) => sum + m.valor, 0);

  const formatVencimento = (mensalidade: (typeof mensalidades)[number]) => {
    if (!mensalidade.dataVencimento) return 'Sem vencimento';
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const venc = new Date(mensalidade.dataVencimento);
    venc.setHours(0, 0, 0, 0);
    const diff = Math.round((venc.getTime() - hoje.getTime()) / (1000 * 3600 * 24));
    if (diff === 0) return 'Vence hoje';
    if (diff > 0) return `Vence em ${diff} dias`;
    return `Venceu há ${Math.abs(diff)} dias`;
  };

  const handleContinuar = () => {
    if (etapa < 3) {
      setEtapa(etapa + 1);
    } else {
      onConfirm({
        alunoId: aluno.id,
        mensalidades: mensalidadesSelecionadas,
        metodoPagamento,
        valorRecebido: parseFloat(valorRecebido),
        comprovante
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-klasse-dark/75 flex items-center justify-center p-4 z-50">
      <div className="bg-card rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Cabeçalho */}
        <div className="border-b border-border px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-foreground">Registrar Pagamento</h2>
              <p className="text-muted-foreground">{aluno.nome} • {aluno.turma}</p>
            </div>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          
          {/* Passos */}
          <div className="flex items-center justify-between mt-6">
            {[1, 2, 3, 4].map((step) => (
              <div key={step} className="flex items-center">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                  etapa >= step 
                    ? 'bg-amber-400 text-white'
                    : 'bg-muted-foreground/15 text-muted-foreground'
                }`}>
                  {step}
                </div>
                {step < 4 && (
                  <div className={`h-1 w-16 mx-2 ${
                    etapa > step ? 'bg-amber-400' : 'bg-muted-foreground/15'
                  }`} />
                )}
              </div>
            ))}
            <div className="text-sm text-muted-foreground">
              {['Selecionar', 'Mensalidades', 'Pagamento', 'Recibo'][etapa - 1]}
            </div>
          </div>
        </div>

        {/* Conteúdo */}
        <div className="p-6">
          {etapa === 1 && (
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4">Selecione as Mensalidades</h3>
              <div className="space-y-3">
                {mensalidadesPendentes.map((mensalidade, mi) => (
                  <label
                    // top-level element returned by map must have a unique key
                    key={mensalidade.id ?? `mensalidade-${mi}`}
                    className="flex items-center p-3 border border-border rounded-xl hover:bg-muted cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={mensalidadesSelecionadas.includes(mensalidade.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setMensalidadesSelecionadas([...mensalidadesSelecionadas, mensalidade.id]);
                        } else {
                          setMensalidadesSelecionadas(
                            mensalidadesSelecionadas.filter(id => id !== mensalidade.id)
                          );
                        }
                      }}
                      className="h-4 w-4 text-amber-400 rounded border-border focus:ring-amber-400"
                    />
                    <div className="ml-3 flex-1">
                      <div className="font-medium">
                        {mensalidade.mesReferencia}/{mensalidade.anoReferencia}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {formatVencimento(mensalidade)} • {mensalidade.valor.toLocaleString()} Kz
                      </div>
                    </div>
                  </label>
                ))}
              </div>
              
              <div className="mt-6 p-4 bg-emerald-50 rounded-xl">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-emerald-800">Total selecionado:</span>
                  <span className="text-2xl font-bold text-emerald-700">
                    {totalSelecionado.toLocaleString()} Kz
                  </span>
                </div>
              </div>
            </div>
          )}

          {etapa === 2 && (
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4">Método de Pagamento</h3>
              <div className="grid grid-cols-4 gap-4 mb-6">
                <button
                  onClick={() => setMetodoPagamento('dinheiro')}
                  className={`p-4 border rounded-xl flex flex-col items-center ${
                    metodoPagamento === 'dinheiro' 
                      ? 'border-amber-400 bg-amber-400/10'
                      : 'border-border hover:border-border'
                  }`}
                >
                  <Landmark className="h-8 w-8 text-muted-foreground mb-2" />
                  <span>Dinheiro</span>
                </button>
                <button
                  onClick={() => setMetodoPagamento('transferencia')}
                  className={`p-4 border rounded-xl flex flex-col items-center ${
                    metodoPagamento === 'transferencia' 
                      ? 'border-amber-400 bg-amber-400/10'
                      : 'border-border hover:border-border'
                  }`}
                >
                  <CreditCard className="h-8 w-8 text-muted-foreground mb-2" />
                  <span>Transferência</span>
                </button>
                <button
                  onClick={() => setMetodoPagamento('multicaixa')}
                  className={`p-4 border rounded-xl flex flex-col items-center ${
                    metodoPagamento === 'multicaixa' 
                      ? 'border-amber-400 bg-amber-400/10'
                      : 'border-border hover:border-border'
                  }`}
                >
                  <DollarSign className="h-8 w-8 text-muted-foreground mb-2" />
                  <span>Multicaixa</span>
                </button>
                <button
                  onClick={() => setMetodoPagamento('mbway')}
                  className={`p-4 border rounded-xl flex flex-col items-center ${
                    metodoPagamento === 'mbway' 
                      ? 'border-amber-400 bg-amber-400/10'
                      : 'border-border hover:border-border'
                  }`}
                >
                  <Smartphone className="h-8 w-8 text-muted-foreground mb-2" />
                  <span>MBWay</span>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Valor Recebido (Kz)
                  </label>
                  <input
                    type="number"
                    value={valorRecebido}
                    onChange={(e) => setValorRecebido(e.target.value)}
                    className="w-full px-4 py-2 border border-border rounded-xl focus:ring-4 focus:ring-amber/20 focus:border-amber"
                    placeholder="Ex: 45000"
                  />
                </div>

                {metodoPagamento === 'transferencia' && (
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      Referência
                    </label>
                    <input
                      type="text"
                      className="w-full px-4 py-2 border border-border rounded-xl focus:ring-4 focus:ring-amber/20 focus:border-amber"
                      placeholder="999123456789"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Comprovante (opcional)
                  </label>
                  <div className="mt-1 flex items-center">
                    <label className="cursor-pointer bg-card py-2 px-3 border border-border rounded-xl shadow-sm text-sm leading-4 font-medium text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-400">
                      <span>Escolher arquivo</span>
                      <input
                        type="file"
                        className="sr-only"
                        onChange={(e) => setComprovante(e.target.files?.[0] || null)}
                      />
                    </label>
                    {comprovante && (
                      <span className="ml-3 text-sm text-muted-foreground">
                        {comprovante.name}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {etapa === 3 && (
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4">Confirmar Pagamento</h3>
              <div className="bg-muted rounded-xl p-4 mb-6">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Aluno:</span>
                    <span className="font-medium">{aluno.nome}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Turma:</span>
                    <span className="font-medium">{aluno.turma}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Mensalidades:</span>
                    <span className="font-medium">
                      {mensalidadesSelecionadas.length} mensalidade(s)
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Método:</span>
                    <span className="font-medium capitalize">{metodoPagamento}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold pt-3 border-t border-border">
                    <span>Total:</span>
                    <span className="text-emerald-700">{totalSelecionado.toLocaleString()} Kz</span>
                  </div>
                </div>
              </div>
              
              <div className="text-center text-sm text-muted-foreground">
                Ao confirmar, o sistema irá atualizar o status das mensalidades e gerar um recibo automaticamente.
              </div>
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="border-t border-border px-6 py-4">
          <div className="flex justify-between">
            <button
              onClick={() => etapa > 1 ? setEtapa(etapa - 1) : onClose()}
              className="px-4 py-2 border border-border rounded-xl text-foreground hover:bg-muted"
            >
              {etapa === 1 ? 'Cancelar' : 'Voltar'}
            </button>
            <button
              onClick={handleContinuar}
              disabled={etapa === 1 && mensalidadesSelecionadas.length === 0 || 
                       etapa === 2 && (!metodoPagamento || !valorRecebido)}
              className={`px-4 py-2 rounded-xl ${
                etapa === 1 && mensalidadesSelecionadas.length === 0 ||
                etapa === 2 && (!metodoPagamento || !valorRecebido)
                  ? 'bg-muted-foreground/25 text-muted-foreground cursor-not-allowed'
                  : 'bg-amber-400 hover:brightness-95 text-white'
              }`}
            >
              {etapa === 3 ? 'Confirmar Pagamento' : 'Continuar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModalRegistrarPagamento;
