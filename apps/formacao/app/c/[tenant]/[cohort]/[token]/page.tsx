import { notFound } from "next/navigation";
import { validateCorporateToken } from "@/lib/corporate-logic";
import { supabaseServer } from "@/lib/supabaseServer";
import { CorporateEnrollmentForm } from "./CorporateEnrollmentForm";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{
    tenant: string;
    cohort: string;
    token: string;
  }>;
};

export default async function CorporateLandingPage({ params }: Props) {
  const { token } = await params;

  // 1. Validar o Token Corporativo e Status de Pagamento
  const validation = await validateCorporateToken(token);
  if (!validation.valid) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-center">
        <div className="max-w-md space-y-4 rounded-3xl bg-white p-8 shadow-xl border border-slate-200">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-50 text-rose-500">
            <svg viewBox="0 0 24 24" fill="none" className="h-8 w-8" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 8v4m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </div>
          <h1 className="text-xl font-black text-slate-900">Acesso Restrito</h1>
          <p className="text-sm text-slate-500 leading-relaxed">{validation.error}</p>
          <a href="/" className="mt-4 inline-block text-xs font-bold uppercase tracking-widest text-klasse-gold">Voltar ao Início</a>
        </div>
      </div>
    );
  }

  // 2. Buscar detalhes da Cohort
  const s = await supabaseServer();
  const { data: cohort } = await s
    .from("formacao_cohorts")
    .select("id, nome, curso_nome, escola:escolas(nome, logo_url)")
    .eq("id", validation.cohortId)
    .single();

  if (!cohort) notFound();

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Banner de Patrocínio */}
      <div className="bg-slate-900 py-3 text-center">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-klasse-gold">
          Inscrição Patrocinada por: {validation.empresa}
        </p>
      </div>

      <main className="mx-auto max-w-lg px-4 py-12">
        <header className="mb-10 text-center">
          {cohort.escola?.logo_url ? (
            <img src={cohort.escola.logo_url} alt="Logo" className="mx-auto mb-6 h-12 w-auto object-contain" />
          ) : (
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-klasse-gold text-2xl font-black text-white shadow-lg">
              {cohort.escola?.nome?.charAt(0)}
            </div>
          )}
          <h1 className="text-3xl font-black tracking-tight text-slate-900">{cohort.curso_nome}</h1>
          <p className="mt-2 text-slate-500 font-medium italic">{cohort.nome}</p>
        </header>

        <div className="rounded-[2.5rem] border border-slate-200 bg-white p-8 shadow-2xl shadow-slate-200/50">
          <div className="mb-8 rounded-2xl bg-emerald-50 p-4 text-center border border-emerald-100">
            <p className="text-sm font-bold text-emerald-700">
              Vaga Garantida via {validation.empresa}
            </p>
            <p className="text-[10px] uppercase font-black tracking-widest text-emerald-600/70 mt-1">
              Custo Zero para o Funcionário
            </p>
          </div>

          <CorporateEnrollmentForm 
            escolaId={validation.escolaId}
            cohortId={validation.cohortId}
            faturaId={validation.contratoId}
            b2bToken={token}
            empresa={validation.empresa}
          />
        </div>

        <footer className="mt-12 text-center text-[10px] font-bold uppercase tracking-widest text-slate-400">
          Powered by KLASSE Formação
        </footer>
      </main>
    </div>
  );
}
