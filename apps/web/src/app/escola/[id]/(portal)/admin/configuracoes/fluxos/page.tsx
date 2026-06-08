"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { 
  FileText, // Ícone de validação (papel)
  User,     // Ícone de professor
  Users,    // Ícone de conselho
  ShieldCheck, // Ícone de sistema
  Clock, 
  Mail, 
  Stamp, 
  FileSignature,
  LayoutDashboard
} from "lucide-react";
import ConfigSystemShell from "@/components/escola/settings/ConfigSystemShell";
import { buildConfigMenuItems } from "../_shared/menuItems";
import { SistemaStatusModal } from "../_components/SistemaStatusModal";
import { useToast } from "@/components/feedback/FeedbackSystem";
import { useEscolaId } from "@/hooks/useEscolaId";
import { buildPortalHref } from "@/lib/navigation";

// --- TYPES ---
type WorkflowStep = {
  id: string;
  title: string;
  description: string;
  role: string;
  icon: any;
  mandatory: boolean;
  active: boolean;
  sla_hours?: number;
};

type DocumentoAdmissao = {
  id: string;
  label: string;
};

type AnoLetivoOption = {
  id: string;
  ano: number;
  ativo?: boolean | null;
  label?: string | null;
};

function normalizeDocumentoId(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);
}

export default function FluxosConfiguracaoPage() {
  const params = useParams() as { id?: string };
  const escolaId = params?.id;
  const { escolaSlug } = useEscolaId();
  const escolaParam = escolaSlug || escolaId;
  const base = buildPortalHref(escolaParam, "/admin/configuracoes");
  const { success, error: toastError } = useToast();
  
  const menuItems = buildConfigMenuItems(base);

  const [saving, setSaving] = useState(false);
  const [auditStatus, setAuditStatus] = useState<string[]>([]);
  const [isSistemaModalOpen, setIsSistemaModalOpen] = useState(false);
  const [reservaExpiracaoHoras, setReservaExpiracaoHoras] = useState(48);
  const [pendenciaSlaHoras, setPendenciaSlaHoras] = useState(72);
  const [anoLetivoAdmissoes, setAnoLetivoAdmissoes] = useState<number | null>(null);
  const [anosLetivos, setAnosLetivos] = useState<AnoLetivoOption[]>([]);
  const [documentosAdmissao, setDocumentosAdmissao] = useState<DocumentoAdmissao[]>([]);
  const [loadingAdmissoes, setLoadingAdmissoes] = useState(true);
  
  // Estado inicial fiel à imagem do print
  const [steps, setSteps] = useState<WorkflowStep[]>([
    {
      id: "step_1",
      title: "Lançamento de Notas",
      description: "O professor insere as notas e fecha o diário.",
      role: "PROFESSOR",
      icon: User,
      mandatory: true,
      active: true,
      sla_hours: 48
    },
    {
      id: "step_2",
      title: "Validação Pedagógica",
      description: "Coordenação verifica conformidade e médias.",
      role: "COORDENADOR",
      icon: FileText,
      mandatory: false,
      active: true,
      sla_hours: 24
    },
    {
      id: "step_3",
      title: "Conselho de Classe",
      description: "Deliberação sobre casos especiais e aprovação final.",
      role: "SECRETARIA (ATA)",
      icon: Users,
      mandatory: false,
      active: false, // Desativado na imagem (Cinza)
      sla_hours: 0
    },
    {
      id: "step_4",
      title: "Publicação Oficial",
      description: "Boletins são liberados no portal e app dos pais.",
      role: "SISTEMA (AUTO)",
      icon: ShieldCheck,
      mandatory: true,
      active: true, // Ativo na imagem (Escudo verde)
      sla_hours: 0
    }
  ]);

  // Simula busca de status para bater com a imagem "Barra de status"
  useEffect(() => {
    setAuditStatus([
      "null (01/02/2026)", 
      "null (01/02/2026)", 
      "UPDATE (01/02/2026)"
    ]);
  }, []);

  useEffect(() => {
    if (!escolaId) return;
    let cancelled = false;

    async function loadAdmissoesConfig() {
      setLoadingAdmissoes(true);
      try {
        const res = await fetch(`/api/secretaria/admissoes/config?escolaId=${encodeURIComponent(escolaId as string)}`, {
          cache: "no-store",
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Falha ao carregar configuração de admissões");
        if (!cancelled) {
          setReservaExpiracaoHoras(Number(json?.admissoes?.reserva_expiracao_horas) || 48);
          setPendenciaSlaHoras(Number(json?.admissoes?.pendencia_sla_horas) || 72);
          setAnoLetivoAdmissoes(Number.isFinite(Number(json?.admissoes?.ano_letivo_admissoes)) ? Number(json.admissoes.ano_letivo_admissoes) : null);
          setAnosLetivos(Array.isArray(json?.anos_letivos) ? json.anos_letivos : []);
          setDocumentosAdmissao(Array.isArray(json?.admissoes?.documentos_admissao_catalogo) ? json.admissoes.documentos_admissao_catalogo : []);
        }
      } catch (err) {
        if (!cancelled) {
          toastError("Não foi possível carregar admissões", err instanceof Error ? err.message || "Erro desconhecido" : "Erro desconhecido");
        }
      } finally {
        if (!cancelled) setLoadingAdmissoes(false);
      }
    }

    loadAdmissoesConfig();
    return () => {
      cancelled = true;
    };
  }, [escolaId]);

  const toggleStep = (id: string) => {
    setSteps(prev => prev.map(step => 
      step.id === id && !step.mandatory ? { ...step, active: !step.active } : step
    ));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (escolaId) {
        const normalizedReservaExpiracaoHoras = Math.min(168, Math.max(1, Math.trunc(reservaExpiracaoHoras || 48)));
        const normalizedPendenciaSlaHoras = Math.min(720, Math.max(1, Math.trunc(pendenciaSlaHoras || 72)));
        const normalizedDocumentos = documentosAdmissao
          .map((doc) => ({
            id: normalizeDocumentoId(doc.id || doc.label),
            label: doc.label.trim(),
          }))
          .filter((doc) => doc.id && doc.label.length >= 2);
        const res = await fetch("/api/secretaria/admissoes/config", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            escolaId,
            reserva_expiracao_horas: normalizedReservaExpiracaoHoras,
            pendencia_sla_horas: normalizedPendenciaSlaHoras,
            ano_letivo_admissoes: anoLetivoAdmissoes,
            documentos_admissao_catalogo: normalizedDocumentos,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Falha ao guardar configuração");
        setReservaExpiracaoHoras(Number(json?.admissoes?.reserva_expiracao_horas) || normalizedReservaExpiracaoHoras);
        setPendenciaSlaHoras(Number(json?.admissoes?.pendencia_sla_horas) || normalizedPendenciaSlaHoras);
        setAnoLetivoAdmissoes(Number.isFinite(Number(json?.admissoes?.ano_letivo_admissoes)) ? Number(json.admissoes.ano_letivo_admissoes) : anoLetivoAdmissoes);
        setDocumentosAdmissao(Array.isArray(json?.admissoes?.documentos_admissao_catalogo) ? json.admissoes.documentos_admissao_catalogo : normalizedDocumentos);
      }
      success("Fluxo atualizado com sucesso.");
    } catch (err) {
      toastError("Não foi possível guardar", err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <ConfigSystemShell
        escolaId={escolaParam ?? ""}
        title="Fluxos de Trabalho"
        subtitle="Defina o caminho que a nota percorre até o boletim."
        menuItems={menuItems}
        showInternalMenu={false}
        embedded
        backHref={base}
        prevHref={`${base}/financeiro`}
        nextHref={`${base}/avancado`}
        statusItems={auditStatus}
        onSave={handleSave}
        saveDisabled={saving}
        testHref={`${base}/sandbox`} // Botão "Testar" Dourado
      >
        <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-bold text-slate-900">Pipeline de Aprovação de Notas</h3>
            <button 
                onClick={() => setIsSistemaModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200"
            >
                <LayoutDashboard className="h-4 w-4" />
                Ver Status do Sistema
            </button>
        </div>
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          
          {/* COLUNA DA ESQUERDA: PIPELINE */}
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Administração de Candidaturas</h3>
                  <p className="mt-1 max-w-xl text-xs leading-relaxed text-slate-500">
                    Defina o prazo padrão de reserva mostrado no Cofre e usado quando a secretaria aprova uma candidatura para pagamento.
                  </p>
                </div>
                <div className="rounded-full border border-amber-100 bg-amber-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                  Reserva ativa
                </div>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                <label className="block">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Ano de admissões
                  </span>
                  <select
                    disabled={loadingAdmissoes}
                    value={anoLetivoAdmissoes ?? ""}
                    onChange={(event) => {
                      const nextValue = Number(event.target.value);
                      setAnoLetivoAdmissoes(Number.isFinite(nextValue) ? nextValue : null);
                    }}
                    className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-bold text-slate-900 outline-none focus:border-[#1F6B3B] focus:ring-2 focus:ring-[#1F6B3B]/10"
                  >
                    <option value="">Ano mais recente</option>
                    {anosLetivos.map((ano) => (
                      <option key={ano.id} value={ano.ano}>
                        {ano.label ?? `${ano.ano}/${ano.ano + 1}`}{ano.ativo ? " · operacional ativo" : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Expiração da reserva
                  </span>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={168}
                      disabled={loadingAdmissoes}
                      value={reservaExpiracaoHoras}
                      onChange={(event) => {
                        const nextValue = Number(event.target.value);
                        setReservaExpiracaoHoras(Number.isFinite(nextValue) ? nextValue : 48);
                      }}
                      className="h-10 w-24 rounded-lg border border-slate-200 px-3 text-sm font-bold text-slate-900 outline-none focus:border-[#1F6B3B] focus:ring-2 focus:ring-[#1F6B3B]/10"
                    />
                    <span className="text-sm font-semibold text-slate-600">horas</span>
                  </div>
                </label>
                <label className="block">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Prazo para corrigir pendência
                  </span>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={720}
                      disabled={loadingAdmissoes}
                      value={pendenciaSlaHoras}
                      onChange={(event) => {
                        const nextValue = Number(event.target.value);
                        setPendenciaSlaHoras(Number.isFinite(nextValue) ? nextValue : 72);
                      }}
                      className="h-10 w-24 rounded-lg border border-slate-200 px-3 text-sm font-bold text-slate-900 outline-none focus:border-[#1F6B3B] focus:ring-2 focus:ring-[#1F6B3B]/10"
                    />
                    <span className="text-sm font-semibold text-slate-600">horas</span>
                  </div>
                </label>
              </div>

              <div className="mt-6 border-t border-slate-100 pt-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-500">Documentos do catálogo</h4>
                    <p className="mt-1 text-xs text-slate-500">A secretaria deve usar estes nomes ao solicitar correções.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDocumentosAdmissao((prev) => [...prev, { id: `documento_${prev.length + 1}`, label: "Novo documento" }])}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                  >
                    Adicionar
                  </button>
                </div>
                <div className="mt-4 grid gap-3">
                  {documentosAdmissao.map((doc, index) => (
                    <div key={`${doc.id}-${index}`} className="grid gap-2 sm:grid-cols-[180px_1fr_auto]">
                      <input
                        value={doc.id}
                        onChange={(event) => {
                          const id = normalizeDocumentoId(event.target.value);
                          setDocumentosAdmissao((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, id } : item));
                        }}
                        className="h-10 rounded-lg border border-slate-200 px-3 text-xs font-mono text-slate-700 outline-none focus:border-[#1F6B3B]"
                      />
                      <input
                        value={doc.label}
                        onChange={(event) => {
                          const label = event.target.value;
                          setDocumentosAdmissao((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, label, id: item.id || normalizeDocumentoId(label) } : item));
                        }}
                        className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-900 outline-none focus:border-[#1F6B3B]"
                      />
                      <button
                        type="button"
                        onClick={() => setDocumentosAdmissao((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}
                        className="h-10 rounded-lg border border-rose-100 px-3 text-xs font-bold text-rose-600 hover:bg-rose-50"
                      >
                        Remover
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-4">
                <p className="text-xs leading-relaxed text-slate-500">
                  O padrão atual é aplicado em novas reservas e novas pendências. Registos já emitidos mantêm as datas gravadas.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              
              <div className="relative space-y-0">
                {steps.map((step, index) => (
                  <div key={step.id} className="relative flex gap-4 pb-6 last:pb-0">
                    
                    {/* Linha Conectora */}
                    {index !== steps.length - 1 && (
                      <div className={`absolute left-[19px] top-10 h-full w-[2px] border-l-2 border-dashed z-0 ${step.active ? 'border-slate-300' : 'border-slate-100'}`} />
                    )}

                    {/* Ícone Redondo */}
                    <div className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                      step.active 
                        ? 'border-[#1F6B3B] bg-white text-[#1F6B3B]' 
                        : 'border-slate-200 bg-slate-50 text-slate-300'
                    }`}>
                      <step.icon className="h-5 w-5" strokeWidth={1.5} />
                    </div>

                    {/* Card do Passo */}
                    <div className={`flex flex-1 flex-col justify-between gap-4 rounded-xl border p-4 sm:flex-row sm:items-center transition-all ${
                      step.active 
                        ? 'border-slate-200 bg-white' 
                        : 'border-slate-100 bg-slate-50/50 opacity-70'
                    }`}>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-bold text-slate-900">{step.title}</span>
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                            {step.role}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed">{step.description}</p>
                      </div>

                      {/* Controles (Badge Horas + Toggle) */}
                      <div className="flex items-center gap-4">
                        {step.sla_hours && step.sla_hours > 0 && step.active && (
                          <div className="flex items-center gap-1 text-[10px] font-semibold text-klasse-gold-700 bg-klasse-gold-50 border border-klasse-gold-100 px-2 py-1 rounded-full">
                            <Clock className="h-3 w-3" />
                            {step.sla_hours}h
                          </div>
                        )}
                        
                        <label className={`relative inline-flex cursor-pointer items-center ${step.mandatory ? 'opacity-50 cursor-not-allowed' : ''}`}>
                          <input 
                            type="checkbox" 
                            className="peer sr-only"
                            checked={step.active}
                            onChange={() => !step.mandatory && toggleStep(step.id)}
                            disabled={step.mandatory}
                          />
                          <div className="peer h-6 w-11 rounded-full bg-slate-200 
                            peer-focus:outline-none 
                            peer-checked:bg-[#1F6B3B] 
                            after:content-[''] 
                            after:absolute after:top-[2px] after:left-[2px] 
                            after:bg-white after:border-gray-300 after:border 
                            after:rounded-full after:h-5 after:w-5 
                            after:transition-all 
                            peer-checked:after:translate-x-full peer-checked:after:border-white">
                          </div>
                        </label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* COLUNA DA DIREITA: RECURSOS EXTRAS (Fiel ao print) */}
          <div className="space-y-4">
            <div className="rounded-xl bg-[#020617] p-5 text-white shadow-md">
              <h4 className="text-sm font-bold text-white">Automações Disponíveis</h4>
              <p className="mt-1 text-xs text-slate-400">Recursos extras para turbinar seu fluxo.</p>
              
              <div className="mt-4 space-y-3">
                <div className="flex items-start gap-3 rounded-lg bg-white/5 p-3 hover:bg-white/10 transition cursor-pointer group">
                  <Mail className="h-4 w-4 mt-0.5 text-white" />
                  <div>
                    <p className="text-xs font-bold text-white">Notificação Automática</p>
                    <p className="text-[10px] text-slate-400 leading-tight">Email para pais ao publicar.</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3 rounded-lg bg-white/5 p-3 hover:bg-white/10 transition cursor-pointer group">
                  <Stamp className="h-4 w-4 mt-0.5 text-slate-400 group-hover:text-white" />
                  <div>
                    <p className="text-xs font-bold text-slate-300 group-hover:text-white">Assinatura Digital</p>
                    <p className="text-[10px] text-slate-500 leading-tight">Exige e-CPF do Diretor (Em breve).</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-lg bg-white/5 p-3 hover:bg-white/10 transition cursor-pointer group">
                  <FileSignature className="h-4 w-4 mt-0.5 text-slate-400 group-hover:text-white" />
                  <div>
                    <p className="text-xs font-bold text-slate-300 group-hover:text-white">Ata de Conselho</p>
                    <p className="text-[10px] text-slate-500 leading-tight">Gera PDF da ata (Em breve).</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-klasse-gold-100 bg-klasse-gold-50 p-4">
              <p className="text-xs text-klasse-gold-900 leading-relaxed">
                <strong>Nota:</strong> Alterações no fluxo só valem para novos lançamentos. Notas em processo seguem o fluxo antigo.
              </p>
            </div>
          </div>

        </div>
      </ConfigSystemShell>
      <SistemaStatusModal open={isSistemaModalOpen} onClose={() => setIsSistemaModalOpen(false)} />
    </>
  );
}
