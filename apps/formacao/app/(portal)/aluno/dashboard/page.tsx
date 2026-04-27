import Link from "next/link";
import { redirect } from "next/navigation";
import { getFormacaoAuthContext } from "@/lib/auth-context";
import { supabaseServer } from "@/lib/supabaseServer";
import { 
  GraduationCap, 
  PlayCircle, 
  Award, 
  Clock, 
  CreditCard, 
  ChevronRight,
  CheckCircle2
} from "lucide-react";
import type { FormacaoSupabaseClient } from "@/lib/db-types";
import { TalentOptInPrompt } from "@/components/aluno/TalentOptInPrompt";

export const dynamic = "force-dynamic";

export default async function AlunoDashboardPage() {
  const auth = await getFormacaoAuthContext();
  if (!auth) redirect("/login");

  const s = (await supabaseServer()) as FormacaoSupabaseClient;

  // Buscar dados reais do aluno
  const [inscricoesRes, pagamentosRes] = await Promise.all([
    s.from("formacao_inscricoes").select("id, status:estado").eq("formando_user_id", auth.userId),
    s.from("formacao_faturas_lote_itens").select("id, status_pagamento").eq("formando_user_id", auth.userId)
  ]);

  const totalCursos = (inscricoesRes.data ?? []).length;
  const pendentes = (pagamentosRes.data ?? []).filter(p => p.status_pagamento !== 'pago').length;

  return (
    <div className="max-w-lg mx-auto space-y-6 pb-12">
      <TalentOptInPrompt escolaNome={auth.tenantName} />

      <header className="text-center py-4">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">portal do formando</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900 leading-tight">Olá, {auth.displayName?.split(' ')[0]}</h1>
      </header>

      {/* Card: Próxima Aula / Destaque */}
      <section className="rounded-[2.5rem] bg-[#1F6B3B] p-8 text-white shadow-2xl shadow-[#1F6B3B]/20 relative overflow-hidden group">
        <div className="relative z-10">
          <span className="inline-block px-3 py-1 rounded-full bg-white/10 border border-white/20 text-[10px] font-black uppercase tracking-widest">Acesso Rápido</span>
          <h2 className="mt-4 text-xl font-bold leading-tight">Continuar a Aprendizagem</h2>
          <p className="mt-2 text-sm text-white/70 font-medium italic">Retome de onde parou e avance no seu percurso.</p>
          
          <Link 
            href="/meus-cursos"
            className="mt-8 flex items-center justify-center gap-2 w-full py-4 rounded-2xl bg-white text-[#1F6B3B] font-black text-sm transition-all hover:scale-[1.02] active:scale-95 shadow-xl"
          >
            <PlayCircle size={18} /> Entrar na Sala de Aula
          </Link>
        </div>
        
        {/* Decorativo */}
        <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform duration-700">
          <GraduationCap size={160} />
        </div>
      </section>

      {/* Grid de Atalhos Rápidos */}
      <div className="grid grid-cols-2 gap-4">
        <article className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 mb-4">
            <CheckCircle2 size={20} />
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Inscrito</p>
          <div className="mt-1 text-2xl font-black text-slate-900">{totalCursos}</div>
          <p className="mt-1 text-[10px] font-bold text-slate-500 uppercase">Cursos Ativos</p>
        </article>

        <article className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 mb-4">
            <CreditCard size={20} />
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Financeiro</p>
          <div className="mt-1 text-2xl font-black text-slate-900">{pendentes}</div>
          <p className="mt-1 text-[10px] font-bold text-slate-500 uppercase">A Pagar</p>
        </article>
      </div>

      {/* Seção de Documentos */}
      <section className="space-y-3">
        <h3 className="px-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Documentos Oficiais</h3>
        <Link href="/meus-cursos" className="flex items-center justify-between p-5 rounded-[2rem] bg-white border border-slate-200 group active:scale-[0.98] transition-all">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
              <Award size={24} />
            </div>
            <div>
              <p className="font-bold text-slate-900">Meus Certificados</p>
              <p className="text-xs text-slate-500">Baixe os certificados concluídos</p>
            </div>
          </div>
          <ChevronRight className="text-slate-300 group-hover:text-orange-600 transition-colors" size={20} />
        </Link>
      </section>

      <section className="space-y-3">
        <h3 className="px-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Carreira</h3>
        <Link href="/aluno/carreira" className="flex items-center justify-between p-5 rounded-[2rem] bg-white border border-slate-200 group active:scale-[0.98] transition-all">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <GraduationCap size={24} />
            </div>
            <div>
              <p className="font-bold text-slate-900">Passaporte Profissional</p>
              <p className="text-xs text-slate-500">Ative o perfil anónimo e responda a entrevistas</p>
            </div>
          </div>
          <ChevronRight className="text-slate-300 group-hover:text-emerald-600 transition-colors" size={20} />
        </Link>
      </section>

      {/* Alerta de Pagamento se houver pendências */}
      {pendentes > 0 && (
        <Link href="/pagamentos" className="block p-6 rounded-[2rem] bg-amber-50 border border-amber-100 group active:scale-[0.98] transition-all">
          <div className="flex items-center gap-3">
            <Clock className="text-amber-600" size={20} />
            <p className="text-sm font-bold text-amber-900">Regularize os seus pagamentos</p>
          </div>
          <p className="mt-2 text-xs text-amber-700/70 leading-relaxed font-medium">
            Tens {pendentes} {pendentes === 1 ? 'fatura pendente' : 'faturas pendentes'}. Evite bloqueios automáticos no acesso à sala de aula.
          </p>
        </Link>
      )}
    </div>
  );
}
