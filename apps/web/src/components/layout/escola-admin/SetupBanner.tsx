"use client";

import { Sparkles, UploadCloud, UserPlus, FileSpreadsheet } from "lucide-react";
import { useState } from "react";

export default function SetupBanner({ escolaId }: { escolaId?: string }) {
  const [showImportModal, setShowImportModal] = useState(false);

  const openImportModal = () => {
    setShowImportModal(true);
  };

  const closeImportModal = () => {
    setShowImportModal(false);
  };

  return (
    <>
      <div className="bg-gradient-to-br from-brand-900 to-slate-800 rounded-3xl p-8 md:p-12 text-white relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 bg-white/10 px-3 py-1 rounded-full text-xs font-bold text-teal-300 mb-4 border border-white/5">
            <Sparkles className="w-3 h-3" />
            Setup Concluído
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-4">
            A sua escola está pronta a arrancar. 🚀
          </h1>
          <p className="text-slate-300 text-sm md:text-base leading-relaxed mb-8">
            A estrutura de classes e turmas já foi criada. O próximo passo é trazer os seus alunos para dentro do sistema para começar a gerir matrículas e pagamentos.
          </p>

          <div className="flex flex-col sm:flex-row gap-4">
            <button 
              onClick={openImportModal}
              className="flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-400 text-white px-6 py-3.5 rounded-xl font-bold transition-all shadow-lg shadow-teal-500/20 hover:-translate-y-1"
            >
              <UploadCloud className="w-5 h-5" />
              Importar Lista CSV
            </button>
            <button className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white px-6 py-3.5 rounded-xl font-bold transition-all border border-white/10">
              <UserPlus className="w-5 h-5" />
              Adicionar Manualmente
            </button>
          </div>
        </div>

        <div className="hidden md:block absolute right-12 top-1/2 -translate-y-1/2 opacity-20">
          <FileSpreadsheet className="w-48 h-48 text-white" />
        </div>
      </div>

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-2xl p-8 shadow-2xl transform scale-100 transition-transform duration-300">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Importação de Alunos</h2>
                <p className="text-sm text-slate-500">Carregue o CSV oficial para matricular em massa.</p>
              </div>
              <button 
                onClick={closeImportModal}
                className="text-slate-400 hover:text-slate-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="border-2 border-dashed border-slate-300 rounded-xl h-48 flex flex-col items-center justify-center bg-slate-50 hover:bg-white hover:border-teal-500 transition cursor-pointer group">
              <div className="p-4 bg-white rounded-full shadow-sm mb-3 group-hover:scale-110 transition">
                <UploadCloud className="w-8 h-8 text-teal-500" />
              </div>
              <p className="text-sm font-bold text-slate-600">Clique para carregar ficheiro</p>
              <p className="text-xs text-slate-400 mt-1">CSV até 10MB</p>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button 
                onClick={closeImportModal}
                className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-800"
              >
                Cancelar
              </button>
              <button className="px-6 py-2 bg-slate-200 text-slate-400 text-sm font-bold rounded-lg cursor-not-allowed">
                Importar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}