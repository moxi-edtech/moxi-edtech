"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  ChevronRight,
  Mail,
  Phone,
  Search,
  Users,
} from "lucide-react";

type AlunoFicha = {
  id: string;
  created_at: string | null;
  updated_at: string | null;
  nome: string;
  status: string | null;
  telefone: string | null;
  email: string | null;
  bi_numero: string | null;
  data_nascimento: string | null;
  sexo: string | null;
  naturalidade: string | null;
  responsavel_nome?: string | null;
  responsavel_contato?: string | null;
  responsavel?: string | null;
  telefone_responsavel?: string | null;
  profile_id?: string | null;
  escola_id?: string | null;
};

type Props = {
  aluno?: AlunoFicha | null;
  error?: string | null;
};

export default function FichaAluno360Client({ aluno, error }: Props) {
  const router = useRouter();

  if (error) {
    return (
      <div className="bg-slate-100 text-slate-900 font-sans min-h-screen flex flex-col items-center justify-center">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 max-w-md w-full text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-slate-800">Falha ao carregar dados</h2>
          <p className="text-sm text-slate-600 mt-2 mb-6">{error}</p>
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition text-sm inline-flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </button>
        </div>
      </div>
    );
  }

  if (!aluno) {
    // This should ideally not be reached if error is handled, but as a fallback:
    return (
      <div className="bg-slate-100 text-slate-900 font-sans min-h-screen flex flex-col items-center justify-center">
         <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 max-w-md w-full text-center">
          <h2 className="text-lg font-bold text-slate-800">Aluno não encontrado</h2>
           <p className="text-sm text-slate-600 mt-2 mb-6">O aluno que você está procurando não foi encontrado.</p>
           <button
            onClick={() => router.back()}
            className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition text-sm inline-flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </button>
        </div>
      </div>
    );
  }

  const isAtivo = (aluno.status || "").toLowerCase() === "ativo";
  const displayIdCurto = useMemo(
    () => aluno.id.slice(0, 8).toUpperCase(),
    [aluno.id]
  );

  const encarregadoNome =
    aluno.responsavel_nome || aluno.responsavel || "Sem responsável definido";
  const encarregadoContato =
    aluno.responsavel_contato || aluno.telefone_responsavel || aluno.telefone || "—";

  const dataNascFmt = aluno.data_nascimento
    ? new Date(aluno.data_nascimento).toLocaleDateString("pt-PT")
    : null;

  return (
    <div className="bg-slate-100 text-slate-900 font-sans min-h-screen flex flex-col">
      <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-6 sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="h-6 w-px bg-slate-200" />

          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-400">Alunos</span>
            <ChevronRight className="w-4 h-4 text-slate-300" />
            <span className="font-bold text-slate-800">{aluno.nome}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Procurar outro aluno..."
              className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none w-64 transition-all"
            />
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        <aside className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden relative">
            <div className="h-24 bg-gradient-to-r from-slate-800 to-slate-900 relative">
              <div className="absolute top-4 right-4">
                <span
                  className={`text-[10px] font-bold px-2 py-1 rounded-full shadow-sm border border-white/20 flex items-center gap-1 ${
                    isAtivo
                      ? "bg-emerald-500 text-white"
                      : "bg-slate-400 text-slate-900"
                  }`}
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  {(aluno.status || "N/D").toUpperCase()}
                </span>
              </div>
            </div>

            <div className="px-6 pb-6 text-center -mt-12 relative">
              <div className="relative inline-block">
                <div className="w-24 h-24 rounded-full border-4 border-white shadow-md bg-slate-200 flex items-center justify-center text-xl font-bold text-slate-600">
                  {aluno.nome.charAt(0)}
                </div>
              </div>

              <h1 className="text-xl font-bold text-slate-900 mt-3">{aluno.nome}</h1>

              <p className="text-xs text-slate-500 font-mono bg-slate-100 inline-block px-2 py-1 rounded mt-1">
                ID: {displayIdCurto}
              </p>

              <div className="mt-4 flex flex-wrap justify-center gap-2 text-[11px] text-slate-500">
                {aluno.bi_numero && (
                  <span className="bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
                    BI: {aluno.bi_numero}
                  </span>
                )}
                {dataNascFmt && (
                  <span className="bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
                    Nasc.: {dataNascFmt}
                  </span>
                )}
                {aluno.sexo && (
                  <span className="bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
                    Sexo: {aluno.sexo}
                  </span>
                )}
                {aluno.naturalidade && (
                  <span className="bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
                    Nat.: {aluno.naturalidade}
                  </span>
                )}
              </div>

              <div className="mt-6 grid grid-cols-2 gap-2 text-left">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Telefone</p>
                  <p className="text-sm font-bold text-slate-800">{aluno.telefone || "—"}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Email</p>
                  <p className="text-xs font-bold text-slate-800 truncate">{aluno.email || "—"}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Users className="w-4 h-4 text-teal-600" />
                Encarregado
              </h3>
              <button className="text-xs text-teal-600 hover:underline">Editar</button>
            </div>

            <div className="mb-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs">
                {encarregadoNome
                  .split(" ")
                  .map((p) => p[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-bold text-slate-700">{encarregadoNome}</p>
                <p className="text-xs text-slate-400">Responsável financeiro / pedagógico</p>
              </div>
            </div>

            <div className="space-y-2">
              <button className="w-full flex items-center justify-between p-3 bg-slate-50 rounded-xl hover:bg-teal-50 hover:text-teal-700 transition group border border-slate-100">
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-slate-400 group-hover:text-teal-600" />
                  <span className="text-xs font-bold">{encarregadoContato}</span>
                </div>
                <span className="text-[10px] bg-white border border-slate-200 px-2 py-0.5 rounded text-slate-500">
                  Ligar
                </span>
              </button>

              {aluno.email && (
                <button className="w-full flex items-center justify-between p-3 bg-slate-50 rounded-xl hover:bg-teal-50 hover:text-teal-700 transition group border border-slate-100">
                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 text-slate-400 group-hover:text-teal-600" />
                    <span className="text-xs font-bold">{aluno.email}</span>
                  </div>
                  <span className="text-[10px] bg-white border border-slate-200 px-2 py-0.5 rounded text-slate-500">
                    Email
                  </span>
                </button>
              )}
            </div>
          </div>
        </aside>

        <div className="lg:col-span-8 space-y-6">
          <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-rose-100 text-rose-600 rounded-lg">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-rose-700">Mensalidade em atraso</p>
                <p className="text-xs text-rose-600">Mês de Outubro • 25.000 Kz (inclui multa)</p>
              </div>
            </div>
            <button className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-lg shadow-rose-200 transition">
              Regularizar agora
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
            <p className="text-sm text-slate-500">Visão 360º do aluno (histórico, documentos, pagamentos) pode ser ligada aqui.</p>
          </div>
        </div>
      </main>
    </div>
  );
}

