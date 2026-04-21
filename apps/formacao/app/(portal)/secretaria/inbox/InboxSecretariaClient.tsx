"use client";

import { useTransition, useState } from "react";
import { 
  CheckCircle, 
  XCircle, 
  Mail, 
  Eye, 
  Loader2, 
  ArrowRight,
  ExternalLink
} from "lucide-react";
import { aprovarInscricaoAction, rejeitarInscricaoAction, reenviarAcessoAction } from "@/app/actions/secretaria-actions";
import { toast } from "@/lib/toast";

// Mock Data
const MOCK_INSCRICOES = [
  {
    id: "123e4567-e89b-12d3-a456-426614174000",
    nome: "António Manuel",
    curso: "Gestão de Projectos",
    valor: "45.000 AOA",
    url_talao: "#",
    email: "antonio@exemplo.ao"
  },
  {
    id: "123e4567-e89b-12d3-a456-426614174001",
    nome: "Maria José",
    curso: "Marketing Digital",
    valor: "35.000 AOA",
    url_talao: "#",
    email: "maria@exemplo.ao"
  },
  {
    id: "123e4567-e89b-12d3-a456-426614174002",
    nome: "José Carlos",
    curso: "Programação Web",
    valor: "60.000 AOA",
    url_talao: "#",
    email: "jose@exemplo.ao"
  }
];

export default function InboxSecretariaClient() {
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<"pagamentos" | "suporte">("pagamentos");
  const [inscricoes, setInscricoes] = useState(MOCK_INSCRICOES);

  async function handleAprovar(id: string) {
    const formData = new FormData();
    formData.append("id", id);

    startTransition(async () => {
      const result = await aprovarInscricaoAction(formData);
      if (result.success) {
        toast({ title: "Acesso Libertado", description: result.message });
        setInscricoes(prev => prev.filter(i => i.id !== id));
      } else {
        toast({ title: "Erro na Aprovação", description: result.error, variant: "destructive" });
      }
    });
  }

  async function handleRejeitar(id: string) {
    const motivo = prompt("Motivo da rejeição (mínimo 5 caracteres):");
    if (!motivo || motivo.length < 5) return;

    const formData = new FormData();
    formData.append("id", id);
    formData.append("motivo", motivo);

    startTransition(async () => {
      const result = await rejeitarInscricaoAction(formData);
      if (result.success) {
        toast({ title: "Sucesso", description: result.message });
        setInscricoes(prev => prev.filter(i => i.id !== id));
      } else {
        toast({ title: "Erro", description: result.error, variant: "destructive" });
      }
    });
  }

  async function handleReenviar(email: string) {
    const formData = new FormData();
    formData.append("email", email);

    startTransition(async () => {
      const result = await reenviarAcessoAction(formData);
      if (result.success) {
        toast({ title: "Sucesso", description: result.message });
      } else {
        toast({ title: "Erro", description: result.error, variant: "destructive" });
      }
    });
  }

  return (
    <div className="min-h-full bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black tracking-tight text-slate-900">Inbox Operacional</h1>
            <p className="mt-2 text-slate-500 font-medium max-w-md">
              Triagem de pagamentos e suporte técnico para alunos ativos e novos ingressos.
            </p>
          </div>
          <div className="flex gap-2 bg-white p-1 rounded-2xl border border-slate-200 shadow-sm">
            {(["pagamentos", "suporte"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-2.5 text-sm font-black rounded-xl transition-all ${
                  activeTab === tab 
                    ? "bg-slate-900 text-white shadow-lg shadow-slate-900/20" 
                    : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                }`}
              >
                {tab === "pagamentos" ? "Validação de Pagamentos" : "Suporte & Acessos"}
              </button>
            ))}
          </div>
        </header>

        <main className="mt-8">
          {activeTab === "pagamentos" ? (
            <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-xl shadow-slate-200/50">
              {/* Tabela Desktop-First */}
              <div className="hidden md:block">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50">
                      <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Formando</th>
                      <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Evento / Mentoria</th>
                      <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Valor Pago</th>
                      <th className="px-6 py-5 text-right text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Ações de Triagem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {inscricoes.map((item) => (
                      <tr key={item.id} className="group hover:bg-slate-50/80 transition-colors">
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500 font-bold group-hover:bg-white group-hover:shadow-sm transition-all">
                              {item.nome.charAt(0)}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900">{item.nome}</p>
                              <p className="text-xs text-slate-400 font-medium">{item.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <span className="text-sm font-bold text-slate-700">{item.curso}</span>
                        </td>
                        <td className="px-6 py-5">
                          <span className="inline-flex items-center rounded-lg bg-emerald-50 px-2 py-1 text-xs font-black text-emerald-600 border border-emerald-100">
                            {item.valor}
                          </span>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center justify-end gap-2">
                            <a 
                              href={item.url_talao} 
                              target="_blank" 
                              className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-white hover:text-klasse-gold hover:shadow-md transition-all border border-transparent hover:border-slate-100"
                              title="Ver Talão"
                            >
                              <Eye size={18} />
                            </a>
                            <button
                              onClick={() => handleRejeitar(item.id)}
                              disabled={isPending}
                              className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-white hover:text-rose-600 hover:shadow-md transition-all border border-transparent hover:border-slate-100"
                              title="Rejeitar"
                            >
                              <XCircle size={18} />
                            </button>
                            <button
                              onClick={() => handleAprovar(item.id)}
                              disabled={isPending}
                              className="flex items-center gap-2 px-5 py-2 text-xs font-black text-white bg-klasse-gold hover:brightness-110 rounded-xl shadow-lg shadow-klasse-gold/20 transition-all active:scale-95 disabled:opacity-50"
                            >
                              {isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={16} />}
                              Aprovar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Grid Mobile-Fallback */}
              <div className="md:hidden space-y-px bg-slate-100">
                {inscricoes.map((item) => (
                  <div key={item.id} className="bg-white p-5 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 font-bold">{item.nome.charAt(0)}</div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-900 truncate">{item.nome}</p>
                        <p className="text-xs text-slate-500 font-medium truncate">{item.curso}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-black text-emerald-600">{item.valor}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <a href={item.url_talao} target="_blank" className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-50 text-[10px] font-black uppercase text-slate-500 border border-slate-100">
                        <Eye size={14} /> Talão
                      </a>
                      <button onClick={() => handleAprovar(item.id)} disabled={isPending} className="flex-[2] flex items-center justify-center gap-2 py-3 rounded-xl bg-klasse-gold text-[10px] font-black uppercase text-white shadow-lg shadow-klasse-gold/20">
                        {isPending ? <Loader2 size={14} className="animate-spin" /> : "Aprovar"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {inscricoes.length === 0 && (
                <div className="text-center py-20 bg-white">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 text-slate-300 mb-4">
                    <CheckCircle size={32} />
                  </div>
                  <p className="text-slate-400 font-bold">Sem pendências para processar.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {inscricoes.map((item) => (
                <article key={item.id} className="group bg-white border border-slate-200 shadow-sm rounded-3xl p-6 flex flex-col justify-between hover:shadow-xl transition-all hover:-translate-y-1">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-klasse-gold/10 group-hover:text-klasse-gold transition-colors">
                      <Mail size={24} />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900">{item.nome}</h3>
                      <p className="text-xs text-slate-500 font-medium truncate max-w-[180px]">{item.email}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleReenviar(item.email)}
                    disabled={isPending}
                    className="mt-6 flex items-center justify-center gap-2 px-4 py-3 text-xs font-black text-slate-700 bg-slate-50 border border-slate-100 hover:bg-white hover:border-slate-200 hover:shadow-sm rounded-2xl transition-all disabled:opacity-50"
                  >
                    <Mail size={16} /> Reenviar Credenciais
                  </button>
                </article>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
