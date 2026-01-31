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

  const mensalidadesPendentes = mensalidades.filter(m => m.status !== 'paga');
  const totalSelecionado = mensalidadesPendentes
    .filter(m => mensalidadesSelecionadas.includes(m.id))
    .reduce((sum, m) => sum + m.valor, 0);

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
    <div className="fixed inset-0 bg-slate-900 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Cabeçalho */}
        <div className="border-b border-slate-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-800">Registrar Pagamento</h2>
              <p className="text-slate-600">{aluno.nome} • {aluno.turma}</p>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-500"
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
                    ? 'bg-klasse-gold-400 text-white' 
                    : 'bg-slate-200 text-slate-400'
                }`}>
                  {step}
                </div>
                {step < 4 && (
                  <div className={`h-1 w-16 mx-2 ${
                    etapa > step ? 'bg-klasse-gold-400' : 'bg-slate-200'
                  }`} />
                )}
              </div>
            ))}
            <div className="text-sm text-slate-500">
              {['Selecionar', 'Mensalidades', 'Pagamento', 'Recibo'][etapa - 1]}
            </div>
          </div>
        </div>

        {/* Conteúdo */}
        <div className="p-6">
          {etapa === 1 && (
            <div>
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Selecione as Mensalidades</h3>
              <div className="space-y-3">
                {mensalidadesPendentes.map((mensalidade, mi) => (
                  <label
                    // top-level element returned by map must have a unique key
                    key={mensalidade.id ?? `mensalidade-${mi}`}
                    className="flex items-center p-3 border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer"
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
                      className="h-4 w-4 text-klasse-gold-400 rounded border-slate-300 focus:ring-klasse-gold-400"
                    />
                    <div className="ml-3 flex-1">
                      <div className="font-medium">
                        {mensalidade.mesReferencia}/{mensalidade.anoReferencia}
                      </div>
                      <div className="text-sm text-slate-500">
                        Venceu há 5 dias • {mensalidade.valor.toLocaleString()} Kz
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
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Método de Pagamento</h3>
              <div className="grid grid-cols-4 gap-4 mb-6">
                <button
                  onClick={() => setMetodoPagamento('dinheiro')}
                  className={`p-4 border rounded-xl flex flex-col items-center ${
                    metodoPagamento === 'dinheiro' 
                      ? 'border-klasse-gold-400 bg-klasse-gold-400/10' 
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <Landmark className="h-8 w-8 text-slate-600 mb-2" />
                  <span>Dinheiro</span>
                </button>
                <button
                  onClick={() => setMetodoPagamento('transferencia')}
                  className={`p-4 border rounded-xl flex flex-col items-center ${
                    metodoPagamento === 'transferencia' 
                      ? 'border-klasse-gold-400 bg-klasse-gold-400/10' 
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <CreditCard className="h-8 w-8 text-slate-600 mb-2" />
                  <span>Transferência</span>
                </button>
                <button
                  onClick={() => setMetodoPagamento('multicaixa')}
                  className={`p-4 border rounded-xl flex flex-col items-center ${
                    metodoPagamento === 'multicaixa' 
                      ? 'border-klasse-gold-400 bg-klasse-gold-400/10' 
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <DollarSign className="h-8 w-8 text-slate-600 mb-2" />
                  <span>Multicaixa</span>
                </button>
                <button
                  onClick={() => setMetodoPagamento('mbway')}
                  className={`p-4 border rounded-xl flex flex-col items-center ${
                    metodoPagamento === 'mbway' 
                      ? 'border-klasse-gold-400 bg-klasse-gold-400/10' 
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <Smartphone className="h-8 w-8 text-slate-600 mb-2" />
                  <span>MBWay</span>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Valor Recebido (Kz)
                  </label>
                  <input
                    type="number"
                    value={valorRecebido}
                    onChange={(e) => setValorRecebido(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-4 focus:ring-klasse-gold/20 focus:border-klasse-gold"
                    placeholder="Ex: 45000"
                  />
                </div>

                {metodoPagamento === 'transferencia' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Referência
                    </label>
                    <input
                      type="text"
                      className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-4 focus:ring-klasse-gold/20 focus:border-klasse-gold"
                      placeholder="999123456789"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Comprovante (opcional)
                  </label>
                  <div className="mt-1 flex items-center">
                    <label className="cursor-pointer bg-white py-2 px-3 border border-slate-300 rounded-xl shadow-sm text-sm leading-4 font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-klasse-gold-400">
                      <span>Escolher arquivo</span>
                      <input
                        type="file"
                        className="sr-only"
                        onChange={(e) => setComprovante(e.target.files?.[0] || null)}
                      />
                    </label>
                    {comprovante && (
                      <span className="ml-3 text-sm text-slate-500">
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
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Confirmar Pagamento</h3>
              <div className="bg-slate-50 rounded-xl p-4 mb-6">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Aluno:</span>
                    <span className="font-medium">{aluno.nome}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Turma:</span>
                    <span className="font-medium">{aluno.turma}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Mensalidades:</span>
                    <span className="font-medium">
                      {mensalidadesSelecionadas.length} mensalidade(s)
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Método:</span>
                    <span className="font-medium capitalize">{metodoPagamento}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold pt-3 border-t border-slate-200">
                    <span>Total:</span>
                    <span className="text-emerald-700">{totalSelecionado.toLocaleString()} Kz</span>
                  </div>
                </div>
              </div>
              
              <div className="text-center text-sm text-slate-500">
                Ao confirmar, o sistema irá atualizar o status das mensalidades e gerar um recibo automaticamente.
              </div>
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="border-t border-slate-200 px-6 py-4">
          <div className="flex justify-between">
            <button
              onClick={() => etapa > 1 ? setEtapa(etapa - 1) : onClose()}
              className="px-4 py-2 border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50"
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
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  : 'bg-klasse-gold-400 hover:brightness-95 text-white'
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
