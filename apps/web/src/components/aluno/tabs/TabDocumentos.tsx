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
              className={`group transition-all ${
                doc.status === 'pending_payment' ? 'border-amber-200 bg-amber-50/30' : 
                doc.status === 'pending' ? 'border-blue-100 bg-blue-50/20' : 
                doc.status === 'rejected' ? 'border-rose-200 bg-rose-50/30' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
                    doc.status === 'granted' ? 'bg-klasse-green-50 text-klasse-green-600' :
                    doc.status === 'pending_payment' ? 'bg-amber-100 text-amber-600' :
                    doc.status === 'pending' ? 'bg-blue-100 text-blue-600' :
                    doc.status === 'rejected' ? 'bg-rose-100 text-rose-600' :
                    'bg-slate-100 text-slate-500'
                  }`}>
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{doc.nome}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                        {doc.valor > 0 ? formatKwanza(doc.valor) : 'Gratuito'}
                      </p>
                      {doc.status !== 'available' && (
                         <>
                          <span className="h-1 w-1 rounded-full bg-slate-300" />
                          <StatusBadge status={doc.status} />
                         </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {loading === doc.codigo ? (
                    <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                  ) : (
                    <ActionButton status={doc.status} />
                  )}
                </div>
              </div>
              {doc.status === 'rejected' && doc.reject_reason && (
                <div className="mt-3 rounded-lg bg-rose-50/50 p-2 text-[10px] font-medium text-rose-700 border border-rose-100">
                   <b>Motivo da rejeição:</b> {doc.reject_reason}
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
