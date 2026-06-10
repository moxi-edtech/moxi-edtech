'use client'

import { useState, useEffect } from "react";
import { FileText, Download, Loader2, CheckCircle2, Wallet, Clock, AlertCircle, Upload, XCircle } from "lucide-react";
import { AlunoCard } from "@/components/aluno/shared/AlunoCard";
import { useSearchParams } from "next/navigation";
import { useToast } from "@/components/feedback/FeedbackSystem";
import { formatKwanza } from "@/lib/formatters";
import { ServicePaymentDrawer } from "../layout/ServicePaymentDrawer";

type DocumentoStatus = 'available' | 'pending_payment' | 'pending' | 'blocked' | 'granted' | 'canceled' | 'rejected';

interface DocumentoCatalogo {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  valor: number;
  status: DocumentoStatus;
  pedido_id: string | null;
  pagamento_intent_id?: string | null;
  exige_pagamento_antes_de_liberar: boolean;
  reject_reason?: string | null;
}

export function TabDocumentos() {
  const searchParams = useSearchParams();
  const { error, success } = useToast();
  const studentId = searchParams?.get("aluno") ?? null;
  const query = studentId ? `?studentId=${studentId}` : '';

  const [loading, setLoading] = useState<string | null>(null);
  const [docs, setDocs] = useState<DocumentoCatalogo[]>([]);
  const [dadosPagamento, setDadosPagamento] = useState<any>(null);
  const [fetching, setFetching] = useState(true);
  
  // Modal state
  const [selectedDoc, setSelectedDoc] = useState<DocumentoCatalogo | null>(null);
  const [showDrawer, setShowDrawer] = useState(false);

  const fetchCatalogo = async () => {
    try {
      const res = await fetch(`/api/aluno/documentos/catalogo${query}`);
      const json = await res.json();
      if (json.ok) {
        setDocs(json.documentos);
        setDadosPagamento(json.dados_pagamento);
      }
    } catch (err) {
      console.error("Failed to fetch catalog", err);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    fetchCatalogo();
  }, [studentId]);

  const handleAction = async (doc: DocumentoCatalogo) => {
    if (doc.status === 'granted') {
        handleDownload(doc);
    } else if (doc.status === 'available' || doc.status === 'rejected') {
        handleRequest(doc);
    } else if (doc.status === 'pending_payment') {
        setSelectedDoc(doc);
        setShowDrawer(true);
    }
  };

  const handleRequest = async (doc: DocumentoCatalogo) => {
    setLoading(doc.codigo);
    try {
      const res = await fetch(`/api/aluno/documentos/solicitar${query}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo: doc.codigo })
      });
      
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Falha ao solicitar documento');
      
      if (json.pagamento_id) {
         // It's a paid document, show the drawer immediately
         setSelectedDoc({ ...doc, pagamento_intent_id: json.pagamento_id });
         setShowDrawer(true);
      } else {
         success("Solicitação enviada", json.message || "Seu pedido foi registrado com sucesso.");
      }
      
      fetchCatalogo(); // Refresh status
    } catch (err: unknown) {
      error("Erro na solicitação", err instanceof Error ? err.message : "Não foi possível processar o pedido.");
    } finally {
      setLoading(null);
    }
  };

  const handleDownload = async (doc: DocumentoCatalogo) => {
    setLoading(doc.codigo);
    try {
      const type = doc.codigo === 'DOC_DECLARACAO_NOTAS' ? 'boletim' : 'declaracao';
      
      const res = await fetch(`/api/aluno/documentos/emitir${query}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type })
      });
      
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Falha ao emitir documento');
      
      if (json.url) {
        window.open(json.url, '_blank');
      }
    } catch (err: unknown) {
      error("Erro no download", err instanceof Error ? err.message : "Não conseguimos obter o documento.");
    } finally {
      setLoading(null);
    }
  };

  if (fetching) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-400">
        <Loader2 className="animate-spin mb-4" />
        <p className="text-xs font-medium">Carregando secretaria digital...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header className="px-1">
        <h2 className="text-lg font-bold text-slate-900">Secretaria Digital</h2>
        <p className="text-xs text-slate-500">Emissão de documentos oficiais com validação digital.</p>
      </header>

      {docs.length === 0 ? (
        <div className="p-8 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
          <AlertCircle className="mx-auto h-8 w-8 text-slate-300 mb-2" />
          <p className="text-sm text-slate-500">Nenhum serviço de documentação disponível no momento.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {docs.map((doc) => (
            <AlunoCard 
              key={doc.id}
              onClick={() => handleAction(doc)}
              className={`group relative transition-all hover:scale-[1.01] active:scale-[0.99] border-l-4 ${
                doc.status === 'pending_payment' ? 'border-l-amber-500 border-amber-200 bg-amber-50/20' : 
                doc.status === 'pending' || doc.status === 'blocked' ? 'border-l-blue-500 border-blue-100 bg-blue-50/10' : 
                doc.status === 'granted' ? 'border-l-klasse-green-500 border-klasse-green-100' :
                doc.status === 'rejected' ? 'border-l-rose-500 border-rose-200 bg-rose-50/20' : 'border-l-slate-200'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex gap-4 flex-1">
                  <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl transition-colors shadow-sm ${
                    doc.status === 'granted' ? 'bg-klasse-green-50 text-klasse-green-600' :
                    doc.status === 'pending_payment' ? 'bg-amber-100 text-amber-600' :
                    doc.status === 'pending' || doc.status === 'blocked' ? 'bg-blue-100 text-blue-600' :
                    doc.status === 'rejected' ? 'bg-rose-100 text-rose-600' :
                    'bg-slate-100 text-slate-500'
                  }`}>
                    <FileText className="h-7 w-7" />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <p className="text-base font-black text-slate-900 leading-tight">{doc.nome}</p>
                    {doc.descricao && (
                        <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                            {doc.descricao}
                        </p>
                    )}
                    <div className="flex items-center gap-3 pt-1">
                      <p className="text-xs font-black text-klasse-gold uppercase tracking-tighter">
                        {doc.valor > 0 ? formatKwanza(doc.valor) : 'Gratuito'}
                      </p>
                      {doc.status !== 'available' && (
                         <>
                          <span className="h-1 w-1 rounded-full bg-slate-200" />
                          <StatusBadge status={doc.status} />
                         </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex h-14 items-center justify-center shrink-0">
                  {loading === doc.codigo ? (
                    <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                  ) : (
                    <div className={`p-3 rounded-full transition-all ${
                        doc.status === 'granted' ? 'bg-klasse-green-500 text-white' :
                        doc.status === 'pending_payment' ? 'bg-amber-500 text-white' :
                        'bg-slate-100 text-slate-400 group-hover:bg-slate-200'
                    }`}>
                        <ActionButton status={doc.status} />
                    </div>
                  )}
                </div>
              </div>
              {doc.status === 'rejected' && doc.reject_reason && (
                <div className="mt-4 rounded-xl bg-rose-50 p-3 text-[11px] font-bold text-rose-700 border border-rose-100 flex items-start gap-2">
                   <AlertCircle size={14} className="shrink-0" />
                   <span><b>Motivo:</b> {doc.reject_reason}</span>
                </div>
              )}
            </AlunoCard>
          ))}
        </div>
      )}

      <div className="mt-8 p-4 rounded-2xl bg-slate-100 border border-slate-200">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Dica de Segurança</p>
        <p className="text-xs text-slate-600 leading-relaxed">
          Todos os documentos emitidos pelo portal possuem um <strong>QR Code de Autenticidade</strong>. 
          A escola ou qualquer instituição interessada pode validar o documento apontando a câmera para o código.
        </p>
      </div>

      <ServicePaymentDrawer 
        open={showDrawer}
        onClose={() => setShowDrawer(false)}
        onSuccess={() => {
            success("Comprovativo enviado", "Aguarde a validação pela secretaria.");
            fetchCatalogo();
        }}
        dadosPagamento={dadosPagamento}
        documento={selectedDoc ? {
            codigo: selectedDoc.codigo,
            nome: selectedDoc.nome,
            valor: selectedDoc.valor,
            intentId: selectedDoc.pagamento_intent_id
        } : null}
      />
    </div>
  );
}

function StatusBadge({ status }: { status: DocumentoStatus }) {
  switch (status) {
    case 'pending_payment':
      return (
        <span className="flex items-center gap-1 text-[10px] font-black text-amber-600 uppercase tracking-tight">
          <Wallet size={10} /> Pagar para Liberar
        </span>
      );
    case 'pending':
      return (
        <span className="flex items-center gap-1 text-[10px] font-black text-blue-600 uppercase tracking-tight">
          <Clock size={10} /> Validando Comprovativo
        </span>
      );
    case 'rejected':
      return (
        <span className="flex items-center gap-1 text-[10px] font-black text-rose-600 uppercase tracking-tight">
          <XCircle size={10} /> Rejeitado
        </span>
      );
    case 'blocked':
      return (
        <span className="flex items-center gap-1 text-[10px] font-black text-blue-600 uppercase tracking-tight">
          <Clock size={10} /> Em Processamento
        </span>
      );
    case 'granted':
      return (
        <span className="flex items-center gap-1 text-[10px] font-black text-klasse-green-600 uppercase tracking-tight">
          <CheckCircle2 size={10} /> Disponível para Download
        </span>
      );
    default:
      return null;
  }
}

function ActionButton({ status }: { status: DocumentoStatus }) {
  switch (status) {
    case 'granted':
      return <Download className="h-4 w-4 text-klasse-green-600 animate-bounce" />;
    case 'pending_payment':
      return <Upload className="h-4 w-4 text-amber-400" />;
    case 'pending':
      return <Clock className="h-4 w-4 text-blue-400" />;
    case 'rejected':
      return <Upload className="h-4 w-4 text-rose-400" />;
    case 'blocked':
      return <Clock className="h-4 w-4 text-blue-400" />;
    default:
      return <Download className="h-4 w-4 text-slate-300 group-hover:text-slate-600" />;
  }
}
