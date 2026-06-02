'use client'

import { useState, useEffect, useMemo } from 'react'
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetDescription, 
  SheetFooter 
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { useTurmas } from '@/hooks/useTurmas'
import { useToast } from '@/components/feedback/FeedbackSystem'
import { 
  Check, 
  Loader2, 
  Info, 
  CreditCard, 
  Banknote, 
  GraduationCap, 
  User,
  AlertCircle,
  Upload,
  FileText,
  ShieldCheck,
  Send
} from 'lucide-react'
import { DocumentUpload } from '@/app/(publico)/admissoes/[escolaSlug]/DocumentUpload'
type Props = {
  isOpen: boolean
  onClose: () => void
  candidaturaId: string | null
  escolaId: string
  onSuccess: (matriculaId: string) => void
}

type CandidaturaDetail = {
  id: string
  nome_candidato: string
  curso_id: string | null
  classe_id: string | null
  turma_preferencial_id: string | null
  ano_letivo: number | null
  status: string
  dados_candidato: {
    tipo_documento?: string
    numero_documento?: string
    bi_numero?: string
    data_nascimento?: string
    telefone?: string
    email?: string
    pai_nome?: string
    mae_nome?: string
    responsavel_nome?: string
    responsavel_contato?: string
    encarregado_email?: string
    encarregado_relacao?: string
    documentos?: Record<string, string>
  }
}

type TurmaOption = {
  id: string
  nome: string
  turma_codigo: string
  curso_nome: string
  classe_nome: string
  curso_id?: string | null
}

const getErrorMessage = (err: unknown, fallback: string) => {
  return err instanceof Error ? err.message : fallback
}

export function AdmissaoConversionSheet({ 
  isOpen, 
  onClose, 
  candidaturaId, 
  escolaId,
  onSuccess 
}: Props) {
  const { success, error: toastError } = useToast()
  const { turmas, loading: loadingTurmas } = useTurmas(escolaId)

  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [detail, setDetail] = useState<CandidaturaDetail | null>(null)
  
  // Form State
  const [studentData, setStudentData] = useState({
    nome: '',
    tipo_documento: 'BI',
    numero_documento: '',
    data_nascimento: '',
    telefone: '',
    email: '',
    pai_nome: '',
    mae_nome: ''
  })
  const [guardianData, setGuardianData] = useState({
    nome: '',
    contato: '',
    email: '',
    relacao: ''
  })
  const [documentos, setDocumentos] = useState<Record<string, string>>({})

  const [academic, setAcademic] = useState({
    turmaId: '',
    cursoId: '',
    classeId: ''
  })
  const [payment, setPayment] = useState({
    metodo: 'CASH' as 'CASH' | 'TPA' | 'TRANSFERENCIA',
    referencia: '',
    amount: '',
    parcial: false,
    comprovativo_url: ''
  })
  
  const [priceHint, setPriceHint] = useState<string | null>(null)
  const [loadingPrice, setLoadingPrice] = useState(false)

  // Onboarding State
  const [enrollmentResult, setEnrollmentResult] = useState<{
    matriculaId: string;
    alunoId: string;
    numeroMatricula: string;
  } | null>(null)
  const [credentials, setCredentials] = useState<{
    login: string;
    senha?: string;
    status: string;
  } | null>(null)
  const [generatingAccess, setGeneratingAccess] = useState(false)

  // 1. Fetch Detail when ID changes
  useEffect(() => {
    if (!candidaturaId || !isOpen) {
      setEnrollmentResult(null)
      setCredentials(null)
      return
    }
    
    setLoading(true)
    setEnrollmentResult(null) // Reset on new ID
    setCredentials(null)
    
    fetch(`/api/secretaria/admissoes/lead?id=${candidaturaId}`)
      .then(res => res.json())
      .then(json => {
        if (json.ok && json.item) {
          const item = json.item as CandidaturaDetail
          setDetail(item)
          
          setStudentData({
            nome: item.nome_candidato || '',
            tipo_documento: item.dados_candidato?.tipo_documento || 'BI',
            numero_documento: item.dados_candidato?.numero_documento || item.dados_candidato?.bi_numero || '',
            data_nascimento: item.dados_candidato?.data_nascimento || '',
            telefone: item.dados_candidato?.telefone || '',
            email: item.dados_candidato?.email || '',
            pai_nome: item.dados_candidato?.pai_nome || '',
            mae_nome: item.dados_candidato?.mae_nome || ''
          })
          
          setGuardianData({
            nome: item.dados_candidato?.responsavel_nome || '',
            contato: item.dados_candidato?.responsavel_contato || '',
            email: item.dados_candidato?.encarregado_email || '',
            relacao: item.dados_candidato?.encarregado_relacao || ''
          })
          
          setDocumentos(item.dados_candidato?.documentos || {})

          setAcademic({
            cursoId: item.curso_id || '',
            classeId: item.classe_id || '',
            turmaId: item.turma_preferencial_id || ''
          })
        }
      })
      .catch(err => console.error('Fetch error:', err))
      .finally(() => setLoading(false))
  }, [candidaturaId, isOpen])

  // 2. Fetch Pricing
  useEffect(() => {
    if (!academic.turmaId || !detail?.ano_letivo) {
      setPriceHint(null)
      return
    }

    setLoadingPrice(true)
    const params = new URLSearchParams({
      ano: String(detail.ano_letivo),
      turma_id: academic.turmaId,
      escola_id: escolaId
    })

    fetch(`/api/financeiro/orcamento/matricula?${params.toString()}`)
      .then(res => res.json())
      .then(json => {
        if (json.ok && json.data?.valor_matricula) {
          setPriceHint(String(json.data.valor_matricula))
          if (!payment.parcial) {
            setPayment(p => ({ ...p, amount: String(json.data.valor_matricula) }))
          }
        }
      })
      .catch(err => console.error('Pricing error:', err))
      .finally(() => setLoadingPrice(false))
  }, [academic.turmaId, detail?.ano_letivo, escolaId])

  const handleSaveOnly = async () => {
    if (!candidaturaId) return
    setSubmitting(true)
    try {
      const syncRes = await fetch('/api/secretaria/admissoes/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          escolaId,
          candidaturaId,
          nome_candidato: studentData.nome,
          tipo_documento: studentData.tipo_documento,
          numero_documento: studentData.numero_documento,
          bi_numero: studentData.tipo_documento === 'BI' ? studentData.numero_documento : undefined,
          data_nascimento: studentData.data_nascimento,
          telefone: studentData.telefone,
          email: studentData.email,
          pai_nome: studentData.pai_nome,
          mae_nome: studentData.mae_nome,
          responsavel_nome: guardianData.nome,
          responsavel_contato: guardianData.contato,
          encarregado_email: guardianData.email,
          encarregado_relacao: guardianData.relacao,
          curso_id: academic.cursoId,
          classe_id: academic.classeId,
          turma_preferencial_id: academic.turmaId,
          documentos: documentos,
          ano_letivo: detail?.ano_letivo
        })
      })

      if (!syncRes.ok) {
        const syncJson = await syncRes.json()
        throw new Error(syncJson.error || 'Erro ao salvar alterações')
      }

      success('Alterações Salvas', 'Os dados da candidatura foram atualizados com sucesso.')
      onSuccess(candidaturaId) // Triggers refresh but doesn't close if we don't want to?
      // For high performance, maybe we close it too? 
      // Actually, if they clicked "Save Only", they probably want to stay or just finish this part.
      onClose()
    } catch (err: unknown) {
      toastError('Erro ao Salvar', getErrorMessage(err, 'Erro ao salvar alterações'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleEfetivar = async () => {
    if (!candidaturaId || !academic.turmaId) {
      toastError('Dados incompletos', 'Selecione uma turma para continuar.')
      return
    }

    setSubmitting(true)
    try {
      // 1. Sync Draft First (Ensures all edits are saved)
      const syncRes = await fetch('/api/secretaria/admissoes/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          escolaId,
          candidaturaId,
          nome_candidato: studentData.nome,
          tipo_documento: studentData.tipo_documento,
          numero_documento: studentData.numero_documento,
          bi_numero: studentData.tipo_documento === 'BI' ? studentData.numero_documento : undefined,
          data_nascimento: studentData.data_nascimento,
          telefone: studentData.telefone,
          email: studentData.email,
          pai_nome: studentData.pai_nome,
          mae_nome: studentData.mae_nome,
          responsavel_nome: guardianData.nome,
          responsavel_contato: guardianData.contato,
          encarregado_email: guardianData.email,
          encarregado_relacao: guardianData.relacao,
          curso_id: academic.cursoId,
          classe_id: academic.classeId,
          turma_preferencial_id: academic.turmaId,
          documentos: documentos,
          ano_letivo: detail?.ano_letivo
        })
      })

      if (!syncRes.ok) {
        const syncJson = await syncRes.json()
        throw new Error(syncJson.error || 'Erro ao sincronizar dados do rascunho')
      }

      // 2. Convert to Matricula
      const idempotencyKey =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

      const res = await fetch('/api/secretaria/admissoes/convert', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey
        },
        body: JSON.stringify({
          candidatura_id: candidaturaId,
          turma_id: academic.turmaId,
          metodo_pagamento: payment.metodo,
          referencia: payment.referencia,
          comprovativo_url: payment.comprovativo_url,
          amount: Number(payment.amount),
          parcial: payment.parcial
        })
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao converter matrícula')

      success('Matrícula Efetivada', `O aluno ${detail?.nome_candidato} foi matriculado com sucesso.`)
      
      setEnrollmentResult({
        matriculaId: json.matricula_id,
        alunoId: json.aluno_id || detail?.id, // Fallback safe
        numeroMatricula: json.numero_matricula
      })

      onSuccess(json.matricula_id)
      // We don't close yet to offer the onboarding CTA
    } catch (err: unknown) {
      toastError('Falha na Matrícula', getErrorMessage(err, 'Erro ao converter matrícula'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleGerarAcesso = async () => {
    if (!enrollmentResult?.alunoId) return

    setGeneratingAccess(true)
    try {
      const res = await fetch('/api/secretaria/alunos/liberar-acesso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alunoIds: [enrollmentResult.alunoId],
          escolaId,
          gerarCredenciais: true,
          canal: 'whatsapp'
        })
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Falha ao liberar acesso')

      const detalhe = json.detalhes?.[0]
      if (detalhe) {
        setCredentials({
          login: detalhe.login || '',
          senha: detalhe.senha,
          status: detalhe.status
        })
        success('Acesso Liberado', 'As credenciais do aluno foram geradas com sucesso.')
      }
    } catch (err: unknown) {
      toastError('Erro ao Liberar Acesso', getErrorMessage(err, 'Falha ao liberar acesso'))
    } finally {
      setGeneratingAccess(false)
    }
  }

  const handleNotifyWhatsApp = () => {
    if (!guardianData.contato || !detail) return;

    // Normalização do número para Angola (+244)
    let phone = guardianData.contato.replace(/\D/g, '');
    if (phone.length === 9) phone = `244${phone}`;
    else if (phone.length > 9 && !phone.startsWith('244')) phone = `244${phone}`;

    const message = `Olá ${guardianData.nome}! A matrícula de *${studentData.nome}* foi efetivada com sucesso no KLASSE. 🎓\n\nProtocolo: #${detail.id.split('-')[0].toUpperCase()}\n\nJá pode aceder ao Portal do Aluno para acompanhar as notas e pagamentos.`;
    
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  const removeDocument = async (documentKey: string, path: string) => {
    if (!candidaturaId) throw new Error('Candidatura não carregada.')

    const res = await fetch('/api/secretaria/admissoes/documentos/remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        escolaId,
        candidaturaId,
        documentKey,
        path,
      }),
    })
    const json = await res.json().catch(() => null)
    if (!res.ok || !json?.ok) {
      throw new Error(json?.error || 'Erro ao remover documento.')
    }
  }

  const filteredTurmas = useMemo(() => {
    const turmaOptions = turmas as TurmaOption[]
    if (!academic.cursoId) return turmas
    return turmaOptions.filter(t => t.curso_id === academic.cursoId)
  }, [turmas, academic.cursoId])

  // Get unique courses from turmas
  const cursosDisponiveis = useMemo(() => {
    const map = new Map<string, { value: string; label: string }>();
    ;(turmas as TurmaOption[]).forEach(t => {
      const cid = t.curso_id;
      if (cid && !map.has(cid)) {
        map.set(cid, { value: cid, label: t.curso_nome || 'Curso' });
      }
    });
    return Array.from(map.values());
  }, [turmas]);

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="sm:max-w-[540px] p-0 flex flex-col h-full border-l-0 shadow-2xl overflow-hidden">
        <SheetHeader className="p-8 bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-klasse-gold p-2 rounded-xl">
              <Check className="w-5 h-5 text-white" />
            </div>
            <Badge variant="outline" className="text-[10px] uppercase border-white/20 text-white/60">
              Conversão de Admissão
            </Badge>
          </div>
          <SheetTitle className="text-2xl font-black text-white">Efetivar Matrícula</SheetTitle>
          <SheetDescription className="text-white/60">
            Conclua o processo acadêmico e financeiro para este candidato sem sair do inbox.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="w-10 h-10 text-klasse-gold animate-spin" />
              <p className="text-sm font-bold text-slate-400">Carregando dados do candidato...</p>
            </div>
          ) : enrollmentResult ? (
            <div className="flex flex-col items-center justify-center py-10 text-center animate-in fade-in zoom-in-95 duration-500">
              <div className="h-20 w-20 rounded-full bg-green-100 flex items-center justify-center mb-6 shadow-sm">
                <Check className="h-10 w-10 text-green-600" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-2">Matrícula Efetivada!</h3>
              <p className="text-slate-500 mb-8 max-w-xs mx-auto">
                A matrícula de <strong className="text-slate-900">{studentData.nome}</strong> foi concluída com sucesso.
              </p>

              <div className="w-full space-y-4">
                {/* Ação Principal: Notificar */}
                <Button
                  onClick={handleNotifyWhatsApp}
                  className="w-full h-16 rounded-2xl bg-[#25D366] hover:bg-[#25D366]/90 text-white font-black text-lg shadow-xl shadow-green-500/20"
                >
                  <Send className="w-5 h-5 mr-3" />
                  Notificar via WhatsApp
                </Button>

                {!credentials ? (
                  <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-3">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">Onboarding Digital</p>
                    <p className="text-xs text-slate-600 text-left">
                      Gere as credenciais agora para que o encarregado possa aceder ao portal imediatamente.
                    </p>
                    <Button
                      onClick={handleGerarAcesso}
                      loading={generatingAccess}
                      tone="gold"
                      variant="outline"
                      className="w-full rounded-xl h-12 font-bold text-xs"
                    >
                      <ShieldCheck className="w-4 h-4 mr-2" />
                      Gerar Acesso ao Portal
                    </Button>
                  </div>
                ) : (
                  <div className="p-6 bg-green-50 rounded-3xl border border-green-100 space-y-4">
                    <div className="flex items-center justify-center gap-2 text-green-700 font-bold mb-1">
                      <ShieldCheck className="w-5 h-5" />
                      Credenciais Geradas
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-left">
                      <div className="bg-white p-3 rounded-xl border border-green-200/50">
                        <p className="text-[9px] font-bold text-slate-400 uppercase">Usuário</p>
                        <p className="text-sm font-mono font-bold text-slate-900">{credentials.login}</p>
                      </div>
                      <div className="bg-white p-3 rounded-xl border border-green-200/50">
                        <p className="text-[9px] font-bold text-slate-400 uppercase">Senha</p>
                        <p className="text-sm font-mono font-bold text-slate-900">{credentials.senha || '********'}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="pt-4 flex flex-col gap-3">
                  <button
                    onClick={onClose}
                    className="text-slate-400 hover:text-klasse-gold font-bold text-sm transition-colors"
                  >
                    Fechar e atender próximo candidato
                  </button>
                </div>
              </div>
            </div>
          ) : detail && (
            <>
              {/* Seção 1: Dados Pessoais do Estudante */}
              <section className="space-y-4">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400">
                  <User className="w-3.5 h-3.5" />
                  Dados Pessoais
                </div>
                <div className="grid gap-4 p-6 bg-white rounded-2xl border border-slate-200 shadow-sm">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">Nome Completo</label>
                    <Input 
                      value={studentData.nome}
                      onChange={(e) => setStudentData(prev => ({ ...prev, nome: e.target.value }))}
                      placeholder="Nome do aluno"
                      className="rounded-xl font-bold"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Select 
                      label="Documento"
                      value={studentData.tipo_documento} 
                      onChange={(e) => setStudentData(prev => ({ ...prev, tipo_documento: e.target.value }))}
                      options={[
                        { value: 'BI', label: 'BI' },
                        { value: 'Cédula Pessoal', label: 'Cédula' },
                        { value: 'Passaporte', label: 'Passaporte' },
                        { value: 'Folha de 25 linhas', label: 'Folha 25L' },
                        { value: 'Outro', label: 'Outro' }
                      ]}
                    />
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">Nº Documento</label>
                      <Input 
                        value={studentData.numero_documento}
                        onChange={(e) => setStudentData(prev => ({ ...prev, numero_documento: e.target.value.toUpperCase() }))}
                        placeholder="Número"
                        className="rounded-xl font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">Data Nascimento</label>
                      <Input 
                        type="date"
                        value={studentData.data_nascimento}
                        onChange={(e) => setStudentData(prev => ({ ...prev, data_nascimento: e.target.value }))}
                        className="rounded-xl"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">Telefone</label>
                      <Input 
                        value={studentData.telefone}
                        onChange={(e) => setStudentData(prev => ({ ...prev, telefone: e.target.value }))}
                        placeholder="+244"
                        className="rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">Nome do Pai</label>
                      <Input 
                        value={studentData.pai_nome}
                        onChange={(e) => setStudentData(prev => ({ ...prev, pai_nome: e.target.value }))}
                        placeholder="Nome do pai"
                        className="rounded-xl text-xs"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">Nome da Mãe</label>
                      <Input 
                        value={studentData.mae_nome}
                        onChange={(e) => setStudentData(prev => ({ ...prev, mae_nome: e.target.value }))}
                        placeholder="Nome da mãe"
                        className="rounded-xl text-xs"
                      />
                    </div>
                  </div>
                </div>
              </section>

              {/* Seção 2: Dados do Responsável */}
              <section className="space-y-4">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400">
                  <User className="w-3.5 h-3.5" />
                  Responsável / Encarregado
                </div>
                <div className="grid gap-4 p-6 bg-white rounded-2xl border border-slate-200 shadow-sm">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">Nome do Encarregado</label>
                    <Input 
                      value={guardianData.nome}
                      onChange={(e) => setGuardianData(prev => ({ ...prev, nome: e.target.value }))}
                      placeholder="Nome completo"
                      className="rounded-xl font-bold"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">Contato</label>
                      <Input 
                        value={guardianData.contato}
                        onChange={(e) => setGuardianData(prev => ({ ...prev, contato: e.target.value }))}
                        placeholder="Telefone"
                        className="rounded-xl"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">Relação</label>
                      <Select 
                        value={guardianData.relacao} 
                        onChange={(e) => setGuardianData(prev => ({ ...prev, relacao: e.target.value }))}
                        options={[
                          { value: 'Pai', label: 'Pai' },
                          { value: 'Mãe', label: 'Mãe' },
                          { value: 'Tio/a', label: 'Tio/a' },
                          { value: 'Avô/ó', label: 'Avô/ó' },
                          { value: 'Outro', label: 'Outro' }
                        ]}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">Email do Encarregado</label>
                    <Input 
                      value={guardianData.email}
                      onChange={(e) => setGuardianData(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="email@exemplo.com"
                      className="rounded-xl"
                    />
                  </div>
                </div>
              </section>

              {/* Seção 3: Documentação */}
              <section className="space-y-4">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400">
                  <FileText className="w-3.5 h-3.5" />
                  Documentação Obrigatória
                </div>
                <div className="grid gap-3">
                  <DocumentUpload
                    label="BI ou Cédula do Aluno"
                    description="Cópia do documento de identidade"
                    escolaId={escolaId}
                    candidaturaId={candidaturaId || 'temp'}
	                    initialPath={documentos.bi_aluno}
	                    onUploadSuccess={(path) => setDocumentos(prev => ({ ...prev, bi_aluno: path }))}
	                    onRemove={async (path) => {
	                      await removeDocument('bi_aluno', path)
	                      setDocumentos(prev => {
	                        const next = { ...prev }
	                        delete next.bi_aluno
	                        return next
	                      })
	                    }}
	                  />
                  <DocumentUpload
                    label="Certificado ou Declaração"
                    description="Certificado de habilitações ou declaração de notas"
                    escolaId={escolaId}
                    candidaturaId={candidaturaId || 'temp'}
	                    initialPath={documentos.notas}
	                    onUploadSuccess={(path) => setDocumentos(prev => ({ ...prev, notas: path }))}
	                    onRemove={async (path) => {
	                      await removeDocument('notas', path)
	                      setDocumentos(prev => {
	                        const next = { ...prev }
	                        delete next.notas
	                        return next
	                      })
	                    }}
	                  />
                  <DocumentUpload
                    label="Atestado Médico"
                    description="Declaração de aptidão física"
                    escolaId={escolaId}
                    candidaturaId={candidaturaId || 'temp'}
	                    initialPath={documentos.atestado_medico}
	                    onUploadSuccess={(path) => setDocumentos(prev => ({ ...prev, atestado_medico: path }))}
	                    onRemove={async (path) => {
	                      await removeDocument('atestado_medico', path)
	                      setDocumentos(prev => {
	                        const next = { ...prev }
	                        delete next.atestado_medico
	                        return next
	                      })
	                    }}
	                  />
                  <DocumentUpload
                    label="Folha de 25 linhas"
                    description="Documento complementar"
                    escolaId={escolaId}
                    candidaturaId={candidaturaId || 'temp'}
	                    initialPath={documentos.folha_25_linhas}
	                    onUploadSuccess={(path) => setDocumentos(prev => ({ ...prev, folha_25_linhas: path }))}
	                    onRemove={async (path) => {
	                      await removeDocument('folha_25_linhas', path)
	                      setDocumentos(prev => {
	                        const next = { ...prev }
	                        delete next.folha_25_linhas
	                        return next
	                      })
	                    }}
	                  />
                  <DocumentUpload
                    label="Outro documento"
                    description="Anexo genérico"
                    escolaId={escolaId}
                    candidaturaId={candidaturaId || 'temp'}
	                    initialPath={documentos.outro_documento}
	                    onUploadSuccess={(path) => setDocumentos(prev => ({ ...prev, outro_documento: path }))}
	                    onRemove={async (path) => {
	                      await removeDocument('outro_documento', path)
	                      setDocumentos(prev => {
	                        const next = { ...prev }
	                        delete next.outro_documento
	                        return next
	                      })
	                    }}
	                  />
                </div>
              </section>

              {/* Seção 3: Fit Acadêmico */}
              <section className="space-y-4">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400">
                  <GraduationCap className="w-3.5 h-3.5" />
                  Ajuste Académico
                </div>
                
                <div className="grid gap-4 p-6 bg-white rounded-2xl border border-slate-200 shadow-sm">
                  <Select 
                    label="Curso Pretendido"
                    value={academic.cursoId} 
                    onChange={(e) => setAcademic(prev => ({ ...prev, cursoId: e.target.value, turmaId: '' }))}
                    options={[
                      { value: '', label: 'Selecione o curso' },
                      ...cursosDisponiveis
                    ]}
                  />

                  <Select 
                    label="Turma Designada"
                    value={academic.turmaId} 
                    onChange={(e) => setAcademic(prev => ({ ...prev, turmaId: e.target.value }))}
                    options={[
                      { value: '', label: 'Escolha a turma' },
                      ...filteredTurmas.map(t => ({ value: t.id, label: `${t.nome} (${t.classe_nome})` }))
                    ]}
                  />
                  
                  {filteredTurmas.length === 0 && academic.cursoId && (
                    <p className="text-[10px] text-rose-500 font-bold flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Nenhuma turma disponível para este curso.
                    </p>
                  )}
                </div>
              </section>

              {/* Seção 3: Financeiro */}
              <section className="space-y-4">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400">
                  <CreditCard className="w-3.5 h-3.5" />
                  Pagamento de Matrícula
                </div>

                <div className="grid gap-6 p-6 bg-white rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between p-3 bg-amber-50 rounded-xl border border-amber-100">
                    <div className="flex items-center gap-2">
                      <Banknote className="w-4 h-4 text-amber-600" />
                      <span className="text-xs font-bold text-amber-900">Taxa de Matrícula</span>
                    </div>
                    {loadingPrice ? (
                      <Loader2 className="w-3 h-3 animate-spin text-amber-600" />
                    ) : (
                      <span className="text-sm font-black text-amber-900">
                        {priceHint ? `${Number(priceHint).toLocaleString('pt-AO')} Kz` : '—'}
                      </span>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700">Método de Pagamento</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['CASH', 'TPA', 'TRANSFERENCIA'] as const).map(m => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setPayment(p => ({ ...p, metodo: m }))}
                          className={`py-3 px-2 rounded-xl text-[10px] font-black border transition-all ${
                            payment.metodo === m 
                              ? 'bg-slate-900 text-white border-slate-900' 
                              : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>

                  {payment.metodo !== 'CASH' && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">Referência do Comprovativo</label>
                      <Input 
                        value={payment.referencia}
                        onChange={(e) => setPayment(p => ({ ...p, referencia: e.target.value.toUpperCase() }))}
                        placeholder="Ex: MCX-12345"
                        className="rounded-xl font-mono uppercase"
                      />
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700">Valor Pago</label>
                      <button 
                        onClick={() => setPayment(p => ({ ...p, parcial: !p.parcial }))}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-lg transition-colors ${
                          payment.parcial ? 'bg-rose-100 text-rose-700' : 'text-slate-400 hover:text-slate-600'
                        }`}
                      >
                        {payment.parcial ? 'Pagamento Parcial ON' : 'Definir Parcial?'}
                      </button>
                    </div>
                    <Input 
                      type="number"
                      value={payment.amount}
                      onChange={(e) => setPayment(p => ({ ...p, amount: e.target.value }))}
                      placeholder="0.00"
                      className="rounded-xl text-lg font-black"
                    />
                  </div>

                  {payment.metodo !== 'CASH' && (
                    <div className="pt-2">
                      <p className="text-xs font-bold text-slate-700 mb-2">Comprovativo de Pagamento</p>
                      <DocumentUpload
                        label="Upload Comprovativo"
                        description="PDF ou Imagem do talão"
                        escolaId={escolaId}
	                        candidaturaId={candidaturaId || 'temp'}
	                        onUploadSuccess={(url) => setPayment(p => ({ ...p, comprovativo_url: url }))}
	                        initialPath={payment.comprovativo_url || null}
	                        onRemove={async (path) => {
	                          await removeDocument('comprovativo_pagamento', path)
	                          setPayment(p => ({ ...p, comprovativo_url: '' }))
	                        }}
	                      />
                    </div>
                  )}
                </div>
              </section>

              <div className="rounded-xl bg-blue-50 p-4 flex gap-3 items-start border border-blue-100">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <p className="text-[10px] font-medium text-blue-700 leading-relaxed">
                  Ao efetivar, o sistema irá criar o perfil do aluno, alocá-lo na turma, 
                  gerar a fatura de matrícula e liquidar o pagamento automaticamente.
                </p>
              </div>
            </>
          )}
        </div>

        {!enrollmentResult && (
          <SheetFooter className="p-8 bg-slate-50 border-t border-slate-100 shrink-0 gap-3">
            <Button
              variant="outline"
              onClick={handleSaveOnly}
              disabled={submitting}
              className="flex-1 h-14 rounded-2xl border-slate-200 text-slate-600 font-bold"
            >
              Salvar Apenas
            </Button>
            <Button
              onClick={handleEfetivar}
              disabled={submitting || !academic.turmaId || !payment.amount}
              className="flex-[2] h-14 rounded-2xl bg-klasse-gold hover:brightness-95 text-white font-black text-base shadow-xl shadow-klasse-gold/20"
              loading={submitting}
            >
              {submitting ? 'Processando...' : 'Efetivar Matrícula Agora'}
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  )
}
