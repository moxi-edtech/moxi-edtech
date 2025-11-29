export function LogoUpload() {
  // Fase 1: só placeholder visual.
  // Fase 2/3: plugar em Supabase Storage e salvar URL.
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2 block">
        Logótipo
      </label>
      <div className="flex items-center gap-4">
        <div className="w-20 h-20 rounded-xl bg-slate-50 border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 text-[10px]">
          LOGO
        </div>
        <p className="text-[11px] text-slate-500 leading-tight">
          Em breve: upload do logo oficial da escola, com preview em tempo real
          nos documentos. Nesta fase, o foco é a sessão académica & períodos.
        </p>
      </div>
    </div>
  );
}
