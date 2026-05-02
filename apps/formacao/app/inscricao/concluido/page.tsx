import Link from "next/link";
import { CheckCircle2, Clock, ArrowRight, UserPlus, AlertCircle } from "lucide-react";

type Params = Promise<{ [key: string]: string | string[] | undefined }>;
type SearchParams = Promise<{
  nome?: string;
  curso?: string;
  waitlist?: string;
}>;

export default async function InscricaoConcluidaPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { nome, curso, waitlist } = await searchParams;
  const isWaitlist = waitlist === "true";

  return (
    <main className="min-h-screen bg-[#F5F0E8] flex items-center justify-center px-4 py-12 text-slate-900">
      <div className="max-w-md w-full bg-white rounded-3xl border border-[#E4EBE6] p-8 shadow-sm text-center">
        <div className="flex justify-center mb-6">
          {isWaitlist ? (
            <div className="h-20 w-20 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center">
              <Clock size={40} />
            </div>
          ) : (
            <div className="h-20 w-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
              <CheckCircle2 size={40} />
            </div>
          )}
        </div>

        <h1 className="text-2xl font-bold text-slate-900 mb-2">
          {isWaitlist ? "Lista de Espera" : "Inscrição Concluída!"}
        </h1>
        
        <p className="text-slate-600 mb-8">
          Olá <span className="font-semibold">{nome || "Formando"}</span>, 
          {isWaitlist 
            ? ` registramos seu interesse no curso ${curso || "selecionado"}. Como a turma está lotada, você foi inserido na lista de espera.`
            : ` sua inscrição no curso ${curso || "selecionado"} foi realizada com sucesso.`}
        </p>

        {isWaitlist ? (
          <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-6 mb-8 text-left">
            <h2 className="text-base font-bold text-amber-900 flex items-center gap-2 mb-2">
              <AlertCircle size={20} className="text-amber-600" /> NÃO REALIZE O PAGAMENTO
            </h2>
            <p className="text-sm text-amber-800 leading-relaxed">
              Como você está na <strong>Lista de Espera</strong>, pedimos que <strong>não faça transferências bancárias</strong> agora. 
              Aguarde o contacto da nossa secretaria. Caso uma vaga seja libertada, entraremos em contacto para autorizar o pagamento.
            </p>
          </div>
        ) : (
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 mb-8 text-left">
            <h2 className="text-sm font-bold text-emerald-900 flex items-center gap-2">
              <UserPlus size={16} /> Próximo Passo: Perfil
            </h2>
            <p className="text-xs text-emerald-800 mt-1">
              Para agilizar sua admissão, acesse o portal e complete seu perfil com a foto do BI e certificados.
            </p>
          </div>
        )}

        <div className="space-y-3">
          <Link
            href="/login"
            className="w-full flex items-center justify-center gap-2 bg-[#E3B23C] text-slate-900 py-3 rounded-xl font-bold transition hover:brightness-95"
          >
            Aceder ao Portal <ArrowRight size={18} />
          </Link>
          
          <Link
            href="/"
            className="w-full block text-slate-500 text-sm font-medium py-2 hover:text-slate-700 transition"
          >
            Voltar para o início
          </Link>
        </div>
      </div>
    </main>
  );
}
