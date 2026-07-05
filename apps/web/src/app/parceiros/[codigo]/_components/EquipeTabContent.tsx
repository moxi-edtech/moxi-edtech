"use client";

import { Loader2, Users, ShieldCheck, Plus, KeyRound, BarChart3, Clock, Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  MANAGEABLE_PARTNER_MEMBER_ROLES,
  PARTNER_ROLE_LABELS,
  type PartnerTeamMember,
  type PartnerMemberRole,
  type PartnerOperatorProductivity,
} from "./partner-dashboard-model";

type ManageablePartnerRole = "admin" | "vendas" | "implantacao" | "suporte_l1" | "operator";

type EquipeTabContentProps = {
  loadingTeam: boolean;
  canManageTeam: boolean;
  loadTeamMembers: (force?: boolean) => void;
  newMemberName: string;
  setNewMemberName: (name: string) => void;
  newMemberRole: ManageablePartnerRole;
  setNewMemberRole: (role: ManageablePartnerRole) => void;
  newMemberPin: string;
  setNewMemberPin: (pin: string) => void;
  savingTeamMember: boolean;
  handleCreateTeamMember: () => void;
  teamMembers: PartnerTeamMember[];
  operatorProductivity: PartnerOperatorProductivity[];
  handleUpdateTeamMember: (id: string, updates: { role?: PartnerMemberRole; ativo?: boolean; pin?: string }) => void;
  handleDeleteTeamMember: (id: string) => void;
  resetPins: Record<string, string>;
  setResetPins: React.Dispatch<React.SetStateAction<Record<string, string>>>;
};

export function EquipeTabContent({
  loadingTeam,
  canManageTeam,
  loadTeamMembers,
  newMemberName,
  setNewMemberName,
  newMemberRole,
  setNewMemberRole,
  newMemberPin,
  setNewMemberPin,
  savingTeamMember,
  handleCreateTeamMember,
  teamMembers,
  operatorProductivity,
  handleUpdateTeamMember,
  handleDeleteTeamMember,
  resetPins,
  setResetPins,
}: EquipeTabContentProps) {
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 border-b border-slate-200/80 pb-5 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1">Operação AELS</p>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Equipe do Parceiro</h2>
          <p className="mt-1 text-xs font-medium text-slate-500">
            Controle quem entra no CRM e qual responsabilidade cada operador assume no fluxo comercial.
          </p>
        </div>
        <Button
          onClick={() => loadTeamMembers(true)}
          disabled={loadingTeam || !canManageTeam}
          className="h-10 rounded-xl bg-slate-900 px-4 text-xs font-bold uppercase tracking-widest text-white hover:bg-slate-800"
        >
          {loadingTeam ? <Loader2 size={14} className="animate-spin" /> : <Users size={14} />}
          Atualizar
        </Button>
      </div>

      {!canManageTeam ? (
        <Card className="rounded-2xl border-amber-100 bg-amber-50 shadow-sm">
          <CardContent className="flex items-start gap-4 p-6">
            <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-amber-700" />
            <div>
              <h3 className="text-sm font-bold text-amber-950">Acesso reservado</h3>
              <p className="mt-1 text-xs font-semibold leading-relaxed text-amber-800">
                Apenas o proprietário ou admin do parceiro pode gerir membros, papéis e PINs de acesso.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card className="rounded-2xl border-zinc-200/70 bg-white shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700">
                  <BarChart3 size={18} />
                </div>
                <div>
                  <CardTitle className="text-base font-bold text-zinc-900">Produtividade por operador</CardTitle>
                  <CardDescription className="text-xs">
                    Mede carteira ativa, follow-ups vencidos, leads sem próxima ação e conversões por responsável.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {operatorProductivity.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-8 text-center">
                  <BarChart3 className="mx-auto mb-3 h-8 w-8 text-zinc-300" />
                  <p className="text-sm font-bold text-zinc-600">Sem dados de produtividade.</p>
                  <p className="mt-1 text-xs text-zinc-500">Cadastre leads e atribua responsáveis para alimentar esta visão.</p>
                </div>
              ) : (
                <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
                  {operatorProductivity.map((operator) => (
                    <div key={operator.membro_id} className="rounded-xl border border-zinc-200/70 bg-zinc-50/70 p-4">
                      <div className="mb-4 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-zinc-900">{operator.membro_nome}</p>
                          <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                            {operator.active_leads} ativos · {operator.total_leads} totais
                          </p>
                        </div>
                        <Badge className={`rounded-lg px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider shadow-none ${
                          operator.overdue_tasks > 0
                            ? "bg-rose-50 text-rose-700 border border-rose-100"
                            : "bg-emerald-50 text-emerald-700 border border-emerald-100"
                        }`}>
                          {operator.overdue_tasks > 0 ? `${operator.overdue_tasks} vencidos` : "Em dia"}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div className="rounded-lg border border-white bg-white p-2">
                          <Clock className="mb-1 h-3.5 w-3.5 text-rose-500" />
                          <p className="text-lg font-bold leading-none text-zinc-900">{operator.overdue_tasks}</p>
                          <p className="mt-1 text-[8px] font-bold uppercase tracking-wider text-zinc-400">Vencidos</p>
                        </div>
                        <div className="rounded-lg border border-white bg-white p-2">
                          <Users className="mb-1 h-3.5 w-3.5 text-amber-500" />
                          <p className="text-lg font-bold leading-none text-zinc-900">{operator.missing_next_action}</p>
                          <p className="mt-1 text-[8px] font-bold uppercase tracking-wider text-zinc-400">Sem ação</p>
                        </div>
                        <div className="rounded-lg border border-white bg-white p-2">
                          <Trophy className="mb-1 h-3.5 w-3.5 text-emerald-500" />
                          <p className="text-lg font-bold leading-none text-zinc-900">{operator.won_leads}</p>
                          <p className="mt-1 text-[8px] font-bold uppercase tracking-wider text-zinc-400">Ganhos</p>
                        </div>
                      </div>

                      <div className="mt-3 rounded-lg bg-zinc-950 px-3 py-2 text-white">
                        <p className="text-[8px] font-bold uppercase tracking-wider text-zinc-500">Pipeline potencial</p>
                        <p className="mt-0.5 text-sm font-bold text-klasse-gold">
                          Kz {operator.pipeline_value_kz.toLocaleString("pt-PT")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
          <Card className="rounded-2xl border-zinc-200/70 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-bold text-zinc-900">Novo membro</CardTitle>
              <CardDescription className="text-xs">
                Crie operadores para vendas, implantação e suporte L1 sem partilhar o PIN do proprietário.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Nome</label>
                <input
                  value={newMemberName}
                  onChange={(event) => setNewMemberName(event.target.value)}
                  placeholder="Ex: Maria Comercial"
                  className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm font-semibold text-zinc-900 outline-none transition focus:border-zinc-400 focus:bg-white"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Papel</label>
                  <select
                    value={newMemberRole}
                    onChange={(event) => setNewMemberRole(event.target.value as ManageablePartnerRole)}
                    className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm font-semibold text-zinc-900 outline-none transition focus:border-zinc-400 focus:bg-white"
                  >
                    {MANAGEABLE_PARTNER_MEMBER_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {PARTNER_ROLE_LABELS[role]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">PIN inicial</label>
                  <input
                    value={newMemberPin}
                    onChange={(event) => setNewMemberPin(event.target.value)}
                    placeholder="mínimo 4 dígitos"
                    type="password"
                    className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm font-semibold text-zinc-900 outline-none transition focus:border-zinc-400 focus:bg-white"
                  />
                </div>
              </div>
              <Button
                onClick={handleCreateTeamMember}
                disabled={savingTeamMember}
                className="h-11 w-full rounded-xl bg-zinc-900 text-xs font-semibold uppercase tracking-wider text-white hover:bg-zinc-800 transition-all border-none"
              >
                {savingTeamMember ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Adicionar membro
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-zinc-200/70 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-bold text-zinc-900">Membros cadastrados</CardTitle>
              <CardDescription className="text-xs">
                Papéis definem responsabilidade operacional; admin também consegue gerir a equipe.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingTeam ? (
                <div className="flex h-48 items-center justify-center text-zinc-400">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : teamMembers.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-10 text-center">
                  <Users className="mx-auto mb-3 h-8 w-8 text-zinc-300" />
                  <p className="text-sm font-bold text-zinc-600">Nenhum membro encontrado.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {teamMembers.map((member) => (
                    <div key={member.id} className="rounded-xl border border-zinc-200/70 bg-zinc-50/70 p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-bold text-zinc-900">{member.nome}</p>
                            <Badge className={`rounded-lg px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider shadow-none ${
                              member.ativo
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                                : "bg-zinc-200 text-zinc-500 border border-zinc-300"
                            }`}>
                              {member.ativo ? "Ativo" : "Inativo"}
                            </Badge>
                          </div>
                          <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                            {PARTNER_ROLE_LABELS[member.role] ?? member.role}
                          </p>
                        </div>

                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                          {member.role !== "owner" && (
                            <select
                              value={member.role}
                              disabled={savingTeamMember}
                              onChange={(event) =>
                                handleUpdateTeamMember(member.id, { role: event.target.value as PartnerMemberRole })
                              }
                              className="h-9 rounded-lg border border-zinc-200 bg-white px-2 text-xs font-bold text-zinc-700 outline-none"
                            >
                              {MANAGEABLE_PARTNER_MEMBER_ROLES.map((role) => (
                                <option key={role} value={role}>
                                  {PARTNER_ROLE_LABELS[role]}
                                </option>
                              ))}
                            </select>
                          )}
                          {member.role !== "owner" && (
                            <Button
                              onClick={() => handleUpdateTeamMember(member.id, { ativo: !member.ativo })}
                              disabled={savingTeamMember}
                              variant="outline"
                              className="h-9 rounded-lg border-zinc-200 bg-white px-3 text-[10px] font-bold uppercase tracking-wider text-zinc-700 font-sans"
                            >
                              {member.ativo ? "Desativar" : "Ativar"}
                            </Button>
                          )}
                          {member.role !== "owner" && (
                            <Button
                              onClick={() => {
                                if (window.confirm(`Tem certeza que deseja remover permanentemente o membro "${member.nome}"?`)) {
                                  handleDeleteTeamMember(member.id);
                                }
                              }}
                              disabled={savingTeamMember}
                              className="h-9 rounded-lg bg-rose-600 hover:bg-rose-700 text-white px-3 text-[10px] font-bold uppercase tracking-wider border-none font-sans"
                            >
                              Remover
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 flex flex-col gap-2 border-t border-zinc-200/70 pt-4 sm:flex-row">
                        <div className="relative flex-1">
                          <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
                          <input
                            value={resetPins[member.id] ?? ""}
                            onChange={(event) => setResetPins((current) => ({ ...current, [member.id]: event.target.value }))}
                            placeholder="Novo PIN"
                            type="password"
                            className="h-9 w-full rounded-lg border border-zinc-200 bg-white pl-9 pr-3 text-xs font-semibold text-zinc-900 outline-none"
                          />
                        </div>
                        <Button
                          onClick={() => handleUpdateTeamMember(member.id, { pin: resetPins[member.id] ?? "" })}
                          disabled={savingTeamMember || !(resetPins[member.id] ?? "").trim()}
                          className="h-9 rounded-lg bg-zinc-900 px-3 text-[10px] font-bold uppercase tracking-wider text-white hover:bg-zinc-800"
                        >
                          Redefinir PIN
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          </div>
        </div>
      )}
    </div>
  );
}
