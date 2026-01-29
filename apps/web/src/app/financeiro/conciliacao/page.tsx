'use client';
import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Upload,
  FileUp,
  Landmark,
  CheckCircle,
  XCircle,
  Search,
  Filter,
  ArrowsRightLeft,
  Clock,
  User,
  DollarSign,
  FileText,
  BarChart,
  Settings,
  Trash2,
  Check,
  AlertTriangle,
  Link,
  Copy,
  Eye,
  ChevronRight,
  ChevronDown,
  Plus,
  Loader2
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

interface TransacaoBancaria {
  id: string;
  data: Date;
  descricao: string;
  referencia: string;
  valor: number;
  tipo: 'credito' | 'debito';
  banco: string;
  conta: string;
  status: 'pendente' | 'conciliado' | 'ignorado';
  alunoMatch?: {
    id: string;
    nome: string;
    turma: string;
    mensalidadesPendentes: Array<{
      id: string;
      mes: number;
      ano: number;
      valor: number;
    }>;
  };
  matchConfianca: number; // 0-100%
}

interface MatchSugerido {
  transacaoId: string;
  alunoId: string;
  mensalidadeId?: string;
  confianca: number;
  razao: string; // 'referencia_exata', 'valor_similar', 'nome_similar', 'data_proxima'
}

const ConciliacaoBancaria: React.FC = () => {
  // Estados
  const [transacoes, setTransacoes] = useState<TransacaoBancaria[]>([]);
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [bancoSelecionado, setBancoSelecionado] = useState<string>('BAI');
  const [contaSelecionada, setContaSelecionada] = useState<string>(''); // New state for account
  const [filtroStatus, setFiltroStatus] = useState<string>('pendente');
  const [matchSugestoes, setMatchSugestoes] = useState<MatchSugerido[]>([]);
  const [mostrarConfiguracoes, setMostrarConfiguracoes] = useState(false);
  const [processingUpload, setProcessingUpload] = useState(false);
  const [loadingTransactions, setLoadingTransactions] = useState(false); // New state for loading transactions


  // Fetch transactions from API
  const fetchTransactions = useCallback(async () => {
    setLoadingTransactions(true);
    try {
      const response = await fetch(`/api/financeiro/conciliacao/transacoes?status=${filtroStatus}`);
      const result = await response.json();
      if (response.ok && result.ok && Array.isArray(result.transactions)) {
        const parsedTransactions = result.transactions.map((t: any) => ({
          ...t,
          data: new Date(t.data), // Convert date string to Date object
          alunoMatch: t.alunoMatch ? t.alunoMatch : undefined, // Ensure nullable
          mensalidadesPendentes: t.mensalidadesPendentes ? t.mensalidadesPendentes : [],
        }));
        setTransacoes(parsedTransactions);
      } else {
        toast.error(result.error || 'Erro ao carregar transações.');
        setTransacoes([]);
      }
    } catch (error) {
      console.error("Erro ao carregar transações:", error);
      toast.error('Erro de conexão ao carregar transações.');
      setTransacoes([]);
    } finally {
      setLoadingTransactions(false);
    }
  }, [filtroStatus]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);


  // Configurações de matching
  const [configMatching, setConfigMatching] = useState({
    toleranciaValor: 100, // Kz
    diasToleranciaVencimento: 5,
    usarNomeSimilar: true,
    confiancaMinima: 70,
    autoConciliarAltaConfianca: true
  });

  // Dropzone para upload
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) {
        toast.error('Por favor, selecione um arquivo.');
        return;
    }
    if (!bancoSelecionado) {
        toast.error('Por favor, selecione o banco.');
        return;
    }

    setProcessingUpload(true);
    const file = acceptedFiles[0]; // Process only one file at a time
    const formData = new FormData();
    formData.append('file', file);
    formData.append('banco', bancoSelecionado);
    if (contaSelecionada) {
      formData.append('conta', contaSelecionada);
    }
    
    try {
        const response = await fetch('/api/financeiro/conciliacao/upload', {
            method: 'POST',
            body: formData,
        });

        const result = await response.json();

        if (response.ok && result.ok) {
            toast.success('Extrato importado com sucesso!');
            setArquivos([file]); // Only keep the successfully uploaded file
            fetchTransactions(); // Refresh the list of transactions
        } else {
            toast.error(result.error || 'Erro ao importar extrato.');
            setArquivos([]);
        }
    } catch (error) {
        console.error("Erro no upload:", error);
        toast.error('Erro de conexão ou servidor.');
        setArquivos([]);
    } finally {
        setProcessingUpload(false);
    }
  }, [bancoSelecionado, contaSelecionada, fetchTransactions]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
    }
  });

  // Funções
  const processarMatchingAutomatico = () => {
    // Simular matching automático
    const sugestoes: MatchSugerido[] = transacoes
      .filter(t => t.status === 'pendente')
      .map(transacao => ({
        transacaoId: transacao.id,
        alunoId: '1', // Simulado
        confianca: transacao.matchConfianca,
        razao: transacao.referencia ? 'referencia_exata' : 'valor_similar'
      }));
    
    setMatchSugestoes(sugestoes);
    
    // Auto-conciliar se configurado
    if (configMatching.autoConciliarAltaConfianca) {
      const transacoesParaAutoConciliar = transacoes.map(t => {
        if (t.status === 'pendente' && t.matchConfianca >= configMatching.confiancaMinima) {
          return { ...t, status: 'conciliado' as const };
        }
        return t;
      });
      setTransacoes(transacoesParaAutoConciliar);
    }
  };

  const conciliarTransacao = async (transacaoId: string, alunoId: string, mensalidadeId?: string) => {
    setProcessingUpload(true); // Re-using state for global processing feedback
    try {
      const response = await fetch('/api/financeiro/conciliacao/confirmar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transacaoId, alunoId, mensalidadeId }),
      });
      const result = await response.json();

      if (response.ok && result.ok) {
        toast.success('Transação conciliada e pagamento registrado com sucesso!');
        fetchTransactions(); // Refresh transactions
      } else {
        toast.error(result.error || 'Erro ao conciliar transação.');
      }
    } catch (error) {
      console.error("Erro ao conciliar transação:", error);
      toast.error('Erro de conexão ou servidor ao conciliar transação.');
    } finally {
      setProcessingUpload(false);
    }
  };

  const ignorarTransacao = (transacaoId: string) => {
    setTransacoes(prev => prev.map(t => 
      t.id === transacaoId 
        ? { ...t, status: 'ignorado' }
        : t
    ));
  };

  const calcularResumo = () => {
    const pendentes = transacoes.filter(t => t.status === 'pendente');
    const conciliados = transacoes.filter(t => t.status === 'conciliado');
    
    return {
      total: transacoes.length,
      pendentes: pendentes.length,
      conciliados: conciliados.length,
      valorPendente: pendentes.reduce((sum, t) => sum + t.valor, 0),
      valorConciliado: conciliados.reduce((sum, t) => sum + t.valor, 0)
    };
  };

  const resumo = calcularResumo();

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Conteúdo Principal */}
      <main className="flex-1 p-4 md:p-6">
        {/* Cabeçalho */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800">Conciliação Bancária</h1>
          <p className="text-slate-600">Importe extratos e concilie pagamentos automaticamente</p>
        </div>

        {/* Cards de Resumo */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Transações</p>
                <p className="text-2xl font-bold text-slate-800">{resumo.total}</p>
              </div>
              <FileUp className="h-8 w-8 text-blue-500" />
            </div>
          </div>
          
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Pendentes</p>
                <p className="text-2xl font-bold text-amber-600">{resumo.pendentes}</p>
              </div>
              <Clock className="h-8 w-8 text-amber-500" />
            </div>
          </div>
          
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Conciliados</p>
                <p className="text-2xl font-bold text-emerald-600">{resumo.conciliados}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-emerald-500" />
            </div>
          </div>
          
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Valor Pendente</p>
                <p className="text-2xl font-bold text-slate-800">{resumo.valorPendente.toLocaleString()} Kz</p>
              </div>
              <DollarSign className="h-8 w-8 text-red-500" />
            </div>
          </div>
        </div>

        {/* Área de Upload */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-800">Importar Extrato Bancário</h2>
            <button
              onClick={() => setMostrarConfiguracoes(!mostrarConfiguracoes)}
              className="flex items-center space-x-2 text-sm text-slate-600 hover:text-slate-800"
            >
              <Settings className="h-5 w-5" />
              <span>Configurar Matching</span>
            </button>
          </div>

          {/* Configurações de Matching (Collapsible) */}
          {mostrarConfiguracoes && (
            <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <h3 className="font-medium text-slate-800 mb-3">Configurações de Matching Automático</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Tolerância de Valor (Kz)
                  </label>
                  <input
                    type="number"
                    value={configMatching.toleranciaValor}
                    onChange={(e) => setConfigMatching({
                      ...configMatching,
                      toleranciaValor: parseInt(e.target.value)
                    })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-4 focus:ring-klasse-gold/20 focus:border-klasse-gold"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Dias de Tolerância (Vencimento)
                  </label>
                  <input
                    type="number"
                    value={configMatching.diasToleranciaVencimento}
                    onChange={(e) => setConfigMatching({
                      ...configMatching,
                      diasToleranciaVencimento: parseInt(e.target.value)
                    })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-4 focus:ring-klasse-gold/20 focus:border-klasse-gold"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Confiança Mínima (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={configMatching.confiancaMinima}
                    onChange={(e) => setConfigMatching({
                      ...configMatching,
                      confiancaMinima: parseInt(e.target.value)
                    })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-4 focus:ring-klasse-gold/20 focus:border-klasse-gold"
                  />
                </div>
                
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={configMatching.usarNomeSimilar}
                    onChange={(e) => setConfigMatching({
                      ...configMatching,
                      usarNomeSimilar: e.target.checked
                    })}
                    className="h-4 w-4 text-klasse-gold-400 rounded border-slate-300 focus:ring-klasse-gold-400"
                  />
                  <span className="text-sm text-slate-700">Usar matching por nome</span>
                </div>
                
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={configMatching.autoConciliarAltaConfianca}
                    onChange={(e) => setConfigMatching({
                      ...configMatching,
                      autoConciliarAltaConfianca: e.target.checked
                    })}
                    className="h-4 w-4 text-klasse-gold-400 rounded border-slate-300 focus:ring-klasse-gold-400"
                  />
                  <span className="text-sm text-slate-700">Auto-conciliar alta confiança</span>
                </div>
              </div>
            </div>
          )}

          {/* Seleção de Banco */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Banco
            </label>
            <div className="flex flex-wrap gap-2">
              {['BAI', 'BFA', 'BIC', 'MBWay', 'Multicaixa', 'Outro'].map((banco) => (
                <button
                  key={banco}
                  onClick={() => setBancoSelecionado(banco)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium ${
                    bancoSelecionado === banco
                      ? 'bg-klasse-gold-400/10 text-klasse-gold-700 border border-klasse-gold-400/30'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {banco}
                </button>
              ))}
            </div>
            {bancoSelecionado !== 'MBWay' && ( // Add input for account only if not MBWay
              <div className="mt-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Conta Bancária (opcional)
                </label>
                <input
                  type="text"
                  value={contaSelecionada}
                  onChange={(e) => setContaSelecionada(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-4 focus:ring-klasse-gold/20 focus:border-klasse-gold"
                  placeholder="Número da conta"
                />
              </div>
            )}
          </div>

          {/* Dropzone */}
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition ${
              isDragActive
                ? 'border-klasse-gold-400 bg-klasse-gold-400/5'
                : 'border-slate-300 hover:border-slate-400'
            }`}
          >
            <input {...getInputProps()} />
            {processingUpload ? (
              <Loader2 className="h-12 w-12 text-slate-400 mx-auto mb-4 animate-spin" />
            ) : (
              <Upload className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            )}
            <p className="text-lg font-medium text-slate-700 mb-2">
              {isDragActive ? 'Solte o arquivo aqui...' : 'Arraste ou clique para selecionar'}
            </p>
            <p className="text-sm text-slate-500 mb-4">
              Suporta CSV, XLS, XLSX (Extratos bancários)
            </p>
            <button
              className="px-6 py-2 bg-klasse-gold-400 text-white rounded-xl hover:brightness-95"
              disabled={processingUpload}
            >
              {processingUpload ? 'Processando...' : 'Selecionar Arquivo'}
            </button>
          </div>

          {/* Arquivos selecionados */}
          {arquivos.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-slate-700 mb-2">Arquivo processado:</h3>
              <div className="space-y-2">
                {arquivos.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="flex items-center space-x-3">
                      <FileUp className="h-5 w-5 text-slate-500" />
                      <div>
                        <p className="text-sm font-medium text-slate-800">{file.name}</p>
                        <p className="text-xs text-slate-500">
                          {(file.size / 1024).toFixed(2)} KB
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => { setArquivos([]); setTransacoes([]); }} // Clear file and transactions
                      className="text-slate-400 hover:text-red-500"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Mensagem se não houver transações e não estiver carregando */}
          {!processingUpload && transacoes.length === 0 && arquivos.length > 0 && (
            <div className="mt-6 p-4 bg-amber-50 rounded-xl border border-amber-200 text-amber-800">
                <p className="font-medium">Nenhuma transação válida encontrada no arquivo processado.</p>
                <p className="text-sm">Verifique o formato do arquivo ou as configurações de matching.</p>
            </div>
          )}
        </div>

        {/* Botões de Ação */}
        <div className="flex flex-wrap gap-3 mb-6">
          <button
            onClick={processarMatchingAutomatico}
            className="flex items-center space-x-2 bg-klasse-gold-400 hover:brightness-95 text-white px-4 py-2 rounded-xl"
            disabled={transacoes.filter(t => t.status === 'pendente').length === 0}
          >
            <Search className="h-5 w-5" />
            <span>Processar Matching Automático</span>
          </button>
          
          <button className="flex items-center space-x-2 bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded-xl">
            <BarChart className="h-5 w-5" />
            <span>Gerar Relatório de Conciliação</span>
          </button>
          
          <select 
            className="border border-slate-300 rounded-xl px-4 py-2 text-sm focus:ring-4 focus:ring-klasse-gold/20 focus:border-klasse-gold"
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
          >
            <option value="todos">Todos</option>
            <option value="pendente">Pendentes</option>
            <option value="conciliado">Conciliados</option>
            <option value="ignorado">Ignorados</option>
          </select>
        </div>

        {/* Tabela de Transações */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Data
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Descrição
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Referência
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Valor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Banco
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Match
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {loadingTransactions ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-slate-500">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                      Carregando transações...
                    </td>
                  </tr>
                ) : transacoes.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-slate-500">
                      Nenhuma transação encontrada com o filtro atual.
                    </td>
                  </tr>
                ) : (
                  transacoes
                    .filter(t => filtroStatus === 'todos' || t.status === filtroStatus)
                    .map((transacao) => (
                      <tr key={transacao.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-slate-900">
                            {transacao.data.toLocaleDateString('pt-AO')}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-slate-900">
                            {transacao.descricao}
                          </div>
                          <div className="text-sm text-slate-500">
                            {transacao.conta}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-slate-900">
                            {transacao.referencia || '-'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className={`text-sm font-bold ${
                            transacao.tipo === 'credito' ? 'text-emerald-600' : 'text-red-600'
                          }`}>
                            {transacao.valor.toLocaleString()} Kz
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-slate-900">
                            {transacao.banco}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {transacao.alunoMatch ? (
                            <div className="flex items-center space-x-2">
                              <div className={`h-2 w-2 rounded-full ${
                                transacao.matchConfianca >= 90 ? 'bg-emerald-500' :
                                transacao.matchConfianca >= 70 ? 'bg-amber-500' : 'bg-red-500'
                              }`} />
                              <div>
                                <div className="text-sm font-medium text-slate-900">
                                  {transacao.alunoMatch.nome}
                                </div>
                                <div className="text-xs text-slate-500">
                                  {transacao.alunoMatch.turma} • {transacao.matchConfianca}% confiança
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="text-sm text-slate-500">
                              <AlertTriangle className="h-4 w-4 inline mr-1" />
                              Sem match
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            transacao.status === 'conciliado'
                              ? 'bg-emerald-100 text-emerald-800'
                              : transacao.status === 'pendente'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-800'
                          }`}>
                            {transacao.status === 'conciliado' ? 'Conciliado' :
                              transacao.status === 'pendente' ? 'Pendente' : 'Ignorado'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-2">
                            {transacao.status === 'pendente' && transacao.alunoMatch && (
                              <button
                                onClick={() => conciliarTransacao(
                                  transacao.id,
                                  transacao.alunoMatch!.id,
                                  transacao.alunoMatch!.mensalidadesPendentes[0]?.id
                                )}
                                className="p-1 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-xl"
                                title="Conciliar"
                              >
                                <Check className="h-5 w-5" />
                              </button>
                            )}
                            
                            {transacao.status === 'pendente' && !transacao.alunoMatch && (
                              <button
                                className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-xl"
                                title="Buscar aluno"
                              >
                                <Search className="h-5 w-5" />
                              </button>
                            )}
                            
                            <button
                              onClick={() => ignorarTransacao(transacao.id)}
                              className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl"
                              title="Ignorar"
                            >
                              <XCircle className="h-5 w-5" />
                            </button>
                            
                            <button
                              className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl"
                              title="Ver detalhes"
                            >
                              <Eye className="h-5 w-5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ConciliacaoBancaria;