// apps/web/src/components/super-admin/MorningBriefing.tsx
"use client";

interface Props {
  data?: {
    escolasEmRisco: number
    scoreMedio: number
  }
}

export default function MorningBriefing({ data }: Props) {
  const escolasEmRisco = data?.escolasEmRisco ?? 0
  const scoreMedio = data?.scoreMedio ?? 100
  const tudoBem = escolasEmRisco === 0
  
  const hora = new Date().getHours()
  const saudacao = hora < 12 ? "Bom dia" : hora < 19 ? "Boa tarde" : "Boa noite"
  const agora = new Date().toLocaleTimeString('pt-AO', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="relative group overflow-hidden rounded-3xl bg-white border border-slate-200/60 p-1 shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all duration-500">
      <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6 p-6">
        <div className="flex items-center gap-6">
          <div className="relative flex-shrink-0">
            <div className={`h-16 w-16 rounded-2xl flex items-center justify-center transition-all duration-500 ${
              tudoBem ? "bg-[#1F6B3B]/10 text-[#1F6B3B]" : "bg-rose-50 text-rose-600"
            }`}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
                {tudoBem ? (
                  <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
                ) : (
                  <path fillRule="evenodd" d="M9.401 3.003c1.155-2 2.843-2 4 0l8.598 14.85c1.154 2 .31 4.5-1.999 4.5H3.999c-2.31 0-3.153-2.5-2-4.5l8.599-14.85zM12 9.75a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5a.75.75 0 01-.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
                )}
              </svg>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Estado da Rede</span>
              <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">• Actualizado às {agora}</span>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight leading-tight">
              {saudacao}, que bom ter-te de volta.
            </h2>
            <p className="text-sm font-medium text-slate-500 mt-1">
              {tudoBem 
                ? "Está tudo a correr bem com as nossas escolas hoje." 
                : `Temos ${escolasEmRisco} escola${escolasEmRisco > 1 ? "s que não dão" : " que não dá"} notícias há algum tempo.`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-8 md:border-l border-slate-100 md:pl-10">
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Bem-estar Global</span>
            <div className="flex items-baseline gap-1">
              <span className={`text-4xl font-black tracking-tighter ${scoreMedio > 90 ? "text-[#1F6B3B]" : "text-rose-600"}`}>
                {scoreMedio}
              </span>
              <span className="text-lg font-bold text-slate-300">%</span>
            </div>
          </div>
          
          <button 
            onClick={() => window.location.reload()}
            className="h-12 w-12 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:text-[#1F6B3B] hover:border-[#1F6B3B] hover:bg-slate-50 transition-all duration-300"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
