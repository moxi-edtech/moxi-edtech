"use client";

import { useEffect, useState } from "react";
import { useParams, usePathname } from "next/navigation";
import { 
  Wallet, 
  CalendarClock, 
  Percent, 
  AlertTriangle, 
  Landmark, 
  Lock 
} from "lucide-react";
import ConfigSystemShell from "@/components/escola/settings/ConfigSystemShell";
import { buildConfigMenuItems } from "../_shared/menuItems";
import { useToast } from "@/components/feedback/FeedbackSystem";
import { useEscolaId } from "@/hooks/useEscolaId";
import { buildContextualPortalHref } from "@/lib/navigation";

// --- TYPES ---
type FinanceiroConfig = {
  dia_vencimento_padrao: number;
  multa_atraso_percent: number;
  juros_diarios_percent: number;
  bloquear_inadimplentes: boolean;
  moeda: string;
  desconto_familiar_2_filhos: number;
  desconto_familiar_3_filhos: number;
};

type FamilyStudent = { id: string; nome: string; nome_completo?: string | null };
type FamilyGroup = { id: string; nome: string; telefone?: string | null; financeiro_agregados_membros?: Array<{ aluno_id: string; alunos?: FamilyStudent | null }> };


const DEFAULT_CONFIG: FinanceiroConfig = {
  dia_vencimento_padrao: 5,
  multa_atraso_percent: 10, // Comum em Angola
  juros_diarios_percent: 0.5,
  bloquear_inadimplentes: false,
  moeda: "AOA",
  desconto_familiar_2_filhos: 0,
  desconto_familiar_3_filhos: 0,
};

export default function FinanceiroConfiguracoesPage() {
  const params = useParams() as { id?: string };
  const escolaId = params?.id;
  const { escolaSlug } = useEscolaId();
  const escolaParam = escolaSlug || escolaId;
  const baseRaw = "/admin/configuracoes";
  const pathname = usePathname();
  const base = buildContextualPortalHref(escolaParam, baseRaw, pathname);
  const { toast, dismiss, success, error } = useToast();
  
  const menuItems = buildConfigMenuItems(base);

  // --- STATE ---
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<FinanceiroConfig>(DEFAULT_CONFIG);
  const [familyGroups, setFamilyGroups] = useState<FamilyGroup[]>([]);
  const [familyStudents, setFamilyStudents] = useState<FamilyStudent[]>([]);
  const [familyName, setFamilyName] = useState("");
  const [familyPhone, setFamilyPhone] = useState("");
  const [familyGroupId, setFamilyGroupId] = useState("");
  const [familyStudentId, setFamilyStudentId] = useState("");
  const [familySaving, setFamilySaving] = useState(false);
  const [familyFeedback, setFamilyFeedback] = useState<string | null>(null);

  const loadFamilyGroups = async () => {
    if (!escolaParam) return;
    const response = await fetch(`/api/escola/${escolaParam}/admin/financeiro/agregados-familiares`, { cache: "no-store" });
    const json = await response.json().catch(() => null);
    if (response.ok && json?.ok) {
      setFamilyGroups(json.agregados ?? []);
      setFamilyStudents(json.alunos ?? []);
    }
  };

  // --- FETCH ---
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!escolaParam) return;
      try {
        const res = await fetch(`/api/escola/${escolaParam}/admin/configuracoes/financeiro`, {
          cache: "no-store",
        });
        const json = await res.json().catch(() => null);
        
        if (cancelled) return;

        if (!res.ok) {
          if (res.status === 404) {
            setLoading(false);
            return;
          }
          throw new Error(json?.error || "Falha ao carregar financeiro");
        }

        if (json?.data) setConfig(json.data);
      } catch (error) {
        console.error("Erro ao carregar financeiro", error);
        // Mantém default silenciosamente ou avisa
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    void loadFamilyGroups();
    return () => { cancelled = true; };
  }, [escolaParam]);

  const handleFamilySave = async () => {
    if (!escolaParam || !familyStudentId || (!familyGroupId && !familyName.trim())) return;
    setFamilySaving(true);
    try {
      const response = await fetch(`/api/escola/${escolaParam}/admin/financeiro/agregados-familiares`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agregado_id: familyGroupId || undefined, aluno_id: familyStudentId, nome: familyName, telefone: familyPhone || null }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) throw new Error(json?.error || "Falha ao associar aluno.");
      setFamilyName("");
      setFamilyPhone("");
      setFamilyStudentId("");
      await loadFamilyGroups();
      const applied = Number(json.aplicacao?.mensalidades_atualizadas ?? 0);
      setFamilyFeedback(applied > 0 ? `${applied} mensalidade(s) pendente(s) recalculada(s).` : "Associação guardada; não havia mensalidades pendentes para recalcular.");
      success("Aluno associado ao agregado familiar.");
    } catch (familyError) {
      error(familyError instanceof Error ? familyError.message : "Não foi possível associar o aluno.");
    } finally {
      setFamilySaving(false);
    }
  };

  const handleFamilyRemove = async (agregadoId: string, alunoId: string) => {
    if (!escolaParam) return;
    setFamilySaving(true);
    try {
      const response = await fetch(`/api/escola/${escolaParam}/admin/financeiro/agregados-familiares`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agregado_id: agregadoId, aluno_id: alunoId }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) throw new Error(json?.error || "Falha ao remover aluno.");
      await loadFamilyGroups();
      setFamilyFeedback("Aluno removido; a política foi recalculada.");
    } catch (familyError) {
      error(familyError instanceof Error ? familyError.message : "Não foi possível remover o aluno.");
    } finally {
      setFamilySaving(false);
    }
  };

  const assignedStudentIds = new Set(
    familyGroups.flatMap((group) => (group.financeiro_agregados_membros ?? []).map((member) => member.aluno_id))
  );

  // --- HANDLERS ---
  const handleSave = async () => {
    if (!escolaParam) return;
    setSaving(true);
    
    const promise = fetch(`/api/escola/${escolaParam}/admin/configuracoes/financeiro`, {
      method: "POST", // Ou PUT/PATCH dependendo da sua API
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    }).then(async (res) => {
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const detail = json?.error || (res.status === 404
          ? "Endpoint financeiro indisponível."
          : "Falha ao salvar");
        throw new Error(detail);
      }
      
      // Commit do setup step
      const commitRes = await fetch(`/api/escola/${escolaParam}/admin/setup/commit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({ changes: { financeiro: true } }),
      });
      const commitJson = await commitRes.json().catch(() => ({}));
      if (!commitRes.ok || commitJson?.ok === false) {
        throw new Error(commitJson?.error || "Falha ao publicar configurações.");
      }
    });

    const tid = toast({ variant: "syncing", title: "Aplicando regras financeiras...", duration: 0 });

    try {
      await promise;
      dismiss(tid);
      success("Política financeira atualizada.");
    } catch (err) {
      dismiss(tid);
      error("Erro ao salvar regras.");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ConfigSystemShell
      escolaId={escolaParam ?? ""}
      title="Financeiro · Políticas de Cobrança"
      subtitle="Defina as regras globais de pagamentos, multas e restrições."
      menuItems={menuItems}
      showInternalMenu={false}
      embedded
      backHref={base}
      prevHref={buildContextualPortalHref(escolaParam, `${baseRaw}/turmas`, pathname)}
      nextHref={buildContextualPortalHref(escolaParam, `${baseRaw}/fluxos`, pathname)}
      testHref={buildContextualPortalHref(escolaParam, `${baseRaw}/sandbox`, pathname)}
      onSave={handleSave}
      saveDisabled={saving}
    >
      {loading ? (
         <div className="py-12 text-center text-sm text-slate-500">Carregando dados financeiros...</div>
      ) : (
        <div className="space-y-6">
          
          {/* CARD 1: REGRAS GERAIS */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-6 border-b border-slate-100 pb-4">
              <div className="rounded-lg bg-klasse-green-100 p-2 text-klasse-green-700">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Regras de Cobrança</h3>
                <p className="text-xs text-slate-500">Padrões aplicados a todas as mensalidades.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Dia de Vencimento */}
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                  <CalendarClock className="h-3.5 w-3.5 text-slate-400" />
                  Dia de Vencimento Padrão
                </label>
                <select
                  value={config.dia_vencimento_padrao}
                  onChange={(e) => setConfig({ ...config, dia_vencimento_padrao: Number(e.target.value) })}
                  className="w-full rounded-lg border-slate-200 bg-slate-50 text-sm font-medium text-slate-900 focus:border-klasse-gold focus:ring-klasse-gold"
                >
                  {[1, 5, 10, 15, 20, 25, 30].map(d => (
                    <option key={d} value={d}>Dia {d}</option>
                  ))}
                </select>
                <p className="mt-1.5 text-[10px] text-slate-400">
                  Data limite padrão para evitar multas.
                </p>
              </div>

              {/* Multa Fixa */}
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                  <AlertTriangle className="h-3.5 w-3.5 text-slate-400" />
                  Multa por Atraso (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={config.multa_atraso_percent}
                    onChange={(e) => setConfig({ ...config, multa_atraso_percent: Number(e.target.value) })}
                    className="w-full rounded-lg border-slate-200 pl-3 pr-8 text-sm font-semibold text-slate-900 focus:border-klasse-gold focus:ring-klasse-gold"
                  />
                  <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">%</span>
                </div>
                <p className="mt-1.5 text-[10px] text-slate-400">
                  Aplicada uma única vez após o vencimento.
                </p>
              </div>

              {/* Juros Diários */}
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                  <Percent className="h-3.5 w-3.5 text-slate-400" />
                  Juros Diários (Mora)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    value={config.juros_diarios_percent}
                    onChange={(e) => setConfig({ ...config, juros_diarios_percent: Number(e.target.value) })}
                    className="w-full rounded-lg border-slate-200 pl-3 pr-8 text-sm font-semibold text-slate-900 focus:border-klasse-gold focus:ring-klasse-gold"
                  />
                  <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">%</span>
                </div>
                <p className="mt-1.5 text-[10px] text-slate-400">
                  Acumulado a cada dia de atraso.
                </p>
              </div>
            </div>
          </div>

          {/* CARD 2: POLÍTICA DE INADIMPLÊNCIA */}
          <div className="rounded-xl border border-klasse-green-100 bg-klasse-green-50/30 p-6">
            <div className="flex items-start gap-4">
              <div className="rounded-full bg-klasse-green-100 p-2 text-klasse-green-700">
                <Wallet className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-slate-900">Benefício para irmãos</h3>
                <p className="mt-1 text-xs text-slate-600">
                  Identifica irmãos pelo telefone do encarregado e aplica a maior faixa configurada às mensalidades pendentes.
                  Descontos manuais e pagamentos já feitos são preservados.
                </p>
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  {[2, 3].map((minimum) => {
                    const key = minimum === 2 ? "desconto_familiar_2_filhos" : "desconto_familiar_3_filhos";
                    return (
                      <label key={key} className="text-xs font-semibold text-slate-700">
                        {minimum === 2 ? "2 filhos" : "3 ou mais filhos"}
                        <div className="relative mt-1.5">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.5"
                            value={config[key]}
                            onChange={(e) => setConfig({ ...config, [key]: Number(e.target.value) })}
                            className="w-full rounded-lg border-slate-200 bg-white pl-3 pr-8 text-sm font-semibold text-slate-900 focus:border-klasse-green focus:ring-klasse-green"
                          />
                          <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">%</span>
                        </div>
                      </label>
                    );
                  })}
                </div>
                <p className="mt-3 text-[10px] text-slate-500">Exemplo: 5% para duas crianças e 10% para três ou mais.</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Agregados familiares</h3>
                <p className="mt-1 text-xs text-slate-500">Associe explicitamente irmãos. O telefone serve apenas como referência e não ativa descontos sozinho.</p>
              </div>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500">{familyGroups.length} agregado(s)</span>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <select value={familyGroupId} onChange={(e) => setFamilyGroupId(e.target.value)} className="rounded-lg border-slate-200 text-sm">
                <option value="">Novo agregado familiar</option>
                {familyGroups.map((group) => <option key={group.id} value={group.id}>{group.nome}</option>)}
              </select>
              <select value={familyStudentId} onChange={(e) => setFamilyStudentId(e.target.value)} className="rounded-lg border-slate-200 text-sm">
                <option value="">Selecionar aluno</option>
                {familyStudents.filter((student) => !assignedStudentIds.has(student.id)).map((student) => <option key={student.id} value={student.id}>{student.nome_completo || student.nome}</option>)}
              </select>
              {!familyGroupId && <input value={familyName} onChange={(e) => setFamilyName(e.target.value)} placeholder="Nome do encarregado / família" className="rounded-lg border-slate-200 text-sm" />}
              {!familyGroupId && <input value={familyPhone} onChange={(e) => setFamilyPhone(e.target.value)} placeholder="Telefone de referência (opcional)" className="rounded-lg border-slate-200 text-sm" />}
            </div>
            <button type="button" onClick={() => void handleFamilySave()} disabled={familySaving || !familyStudentId || (!familyGroupId && !familyName.trim())} className="mt-4 rounded-lg bg-klasse-green px-4 py-2 text-xs font-bold text-white disabled:opacity-50">
              {familySaving ? "A associar..." : "Associar aluno ao agregado"}
            </button>
            {familyFeedback ? <p className="mt-3 text-xs font-semibold text-klasse-green-700">{familyFeedback}</p> : null}
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {familyGroups.map((group) => (
                <div key={group.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold text-slate-800">{group.nome}</p>
                    {group.telefone ? <span className="text-[10px] text-slate-400">{group.telefone}</span> : null}
                  </div>
                  <div className="mt-2 space-y-1">
                    {(group.financeiro_agregados_membros ?? []).map((member) => (
                      <div key={member.aluno_id} className="flex items-center justify-between gap-2 text-[11px] text-slate-600">
                        <span>{member.alunos?.nome_completo || member.alunos?.nome || "Aluno"}</span>
                        <button type="button" onClick={() => void handleFamilyRemove(group.id, member.aluno_id)} className="font-semibold text-rose-600 hover:text-rose-700">Remover</button>
                      </div>
                    ))}
                    {!group.financeiro_agregados_membros?.length ? <p className="text-[10px] text-slate-400">Sem alunos associados.</p> : null}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* CARD 3: POLÍTICA DE INADIMPLÊNCIA */}
          <div className="rounded-xl border border-red-100 bg-red-50/30 p-6">
            <div className="flex items-start gap-4">
              <div className="rounded-full bg-red-100 p-2 text-red-600">
                <Lock className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900">Restrição Automática</h3>
                  
                  {/* Toggle Switch */}
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input 
                      type="checkbox" 
                      className="peer sr-only"
                      checked={config.bloquear_inadimplentes}
                      onChange={(e) => setConfig({ ...config, bloquear_inadimplentes: e.target.checked })}
                    />
                    <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-red-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-red-300"></div>
                  </label>
                </div>
                
                <p className="mt-1 text-xs text-slate-600">
                  Se ativado, alunos com mensalidades vencidas há mais de 30 dias terão o acesso ao Portal do Aluno bloqueado automaticamente.
                </p>
                {config.bloquear_inadimplentes && (
                  <div className="mt-3 inline-flex items-center gap-2 rounded-md bg-red-100 px-3 py-1.5 text-xs font-medium text-red-800">
                    <AlertTriangle className="h-3 w-3" />
                    Modo rigoroso ativado. Certifique-se que isso está no contrato.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* CARD 3: INFO SOBRE MENSALIDADES */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-6">
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-white p-2 shadow-sm ring-1 ring-slate-100 text-slate-600">
                <Landmark className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Mensalidades & Emolumentos</h3>
                <p className="text-xs text-slate-500">
                  Configure preços e catálogo na aba dedicada do menu.
                </p>
              </div>
            </div>
          </div>

        </div>
      )}
    </ConfigSystemShell>
  );
}
