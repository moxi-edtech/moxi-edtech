"use client";

import { useEffect, useState, use } from "react";
import { 
  School, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  UploadCloud, 
  FileText, 
  ArrowLeft,
  Calendar,
  User,
  Building2,
  Users,
  Check,
  RefreshCw,
  Info
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { toast } from "sonner";

interface OnboardingRequest {
  id: string;
  escola_nome: string;
  tracking_token: string;
  status: "pendente" | "em_configuracao" | "activo" | "cancelado";
  financeiro: {
    total_alunos?: string;
    plano_interesse_label?: string;
  };
}

interface OnboardingStep {
  id: string;
  step_code: string;
  title: string;
  status: "pendente" | "em_progresso" | "concluido";
  owner_type: "escola" | "parceiro" | "klasse";
  sla_days: number;
  deadline_at: string;
  completed_at: string | null;
}

interface OnboardingUpload {
  id: string;
  step_code: string;
  file_path: string;
  status: "pendente" | "processando" | "aprovado" | "rejeitado";
  rejection_reason: string | null;
  created_by: "escola" | "parceiro";
  created_at: string;
}

const STEP_META: Record<string, { short: string; ownerLabel: string; uploadableBySchool: boolean }> = {
  diagnostico: { short: "Diagnóstico", ownerLabel: "Parceiro Comercial", uploadableBySchool: false },
  docs_legais: { short: "Docs Legais", ownerLabel: "Escola", uploadableBySchool: true },
  planilhas: { short: "Planilhas", ownerLabel: "Escola", uploadableBySchool: true },
  validacao: { short: "Validação", ownerLabel: "KLASSE", uploadableBySchool: false },
  config: { short: "Configuração", ownerLabel: "Parceiro Comercial", uploadableBySchool: false },
  treinamento: { short: "Treinamento", ownerLabel: "Parceiro Comercial", uploadableBySchool: false },
  live: { short: "Go-live", ownerLabel: "KLASSE", uploadableBySchool: false },
};

function getStepMeta(stepCode: string, ownerType: OnboardingStep["owner_type"]) {
  const fallbackOwner =
    ownerType === "escola" ? "Escola" : ownerType === "parceiro" ? "Parceiro Comercial" : "KLASSE";
  return STEP_META[stepCode] ?? {
    short: stepCode,
    ownerLabel: fallbackOwner,
    uploadableBySchool: ownerType === "escola",
  };
}

export default function OnboardingAcompanharPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);

  const [loading, setLoading] = useState(true);
  const [request, setRequest] = useState<OnboardingRequest | null>(null);
  const [steps, setSteps] = useState<OnboardingStep[]>([]);
  const [uploads, setUploads] = useState<OnboardingUpload[]>([]);
  const [selectedStep, setSelectedStep] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const loadData = async () => {
    try {
      const response = await fetch(`/api/onboarding/acompanhar/${token}`, { cache: "no-store" });
      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Erro ao carregar dados");
      }

      setRequest(data.request);
      setSteps(data.steps);
      setUploads(data.uploads);
      
      const pendingSchoolStep = data.steps.find(
        (s: OnboardingStep) => s.status !== "concluido" && getStepMeta(s.step_code, s.owner_type).uploadableBySchool
      );
      if (pendingSchoolStep) {
        setSelectedStep(pendingSchoolStep.step_code);
      } else {
        setSelectedStep("");
      }
    } catch (err: any) {
      toast.error(err.message || "Erro de conexão");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [token]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setValidationErrors([]);
    }
  };

  const validateSpreadsheet = (file: File): Promise<string[]> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        
        if (lines.length === 0) {
          resolve(["O arquivo está vazio."]);
          return;
        }

        let delimiter = ',';
        if (lines[0].includes(';')) {
          delimiter = ';';
        }

        const parseLine = (line: string, delim: string): string[] => {
          const result: string[] = [];
          let current = '';
          let inQuotes = false;
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === delim && !inQuotes) {
              result.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          result.push(current.trim());
          return result;
        };

        const headers = parseLine(lines[0], delimiter).map(h => h.trim().toUpperCase());
        const errors: string[] = [];

        const isAlunos = headers.includes("NUMERO_PROCESSO") || headers.includes("NOME_ENCARREGADO") || headers.includes("TURMA_CODIGO");
        const isProfessores = headers.includes("DISCIPLINAS_CODIGOS") || headers.includes("HABILITACOES");

        if (!isAlunos && !isProfessores) {
          resolve(["O cabeçalho do arquivo não corresponde a nenhum dos modelos de planilha oficiais (Alunos ou Professores). Verifique se usou as colunas do cabeçalho recomendadas."]);
          return;
        }

        if (isAlunos) {
          const required = ["NOME_COMPLETO", "NUMERO_PROCESSO", "GENERO", "DATA_NASCIMENTO", "TURMA_CODIGO"];
          const missing = required.filter(col => !headers.includes(col));
          if (missing.length > 0) {
            resolve([`Cabeçalho de Alunos inválido. Colunas em falta: ${missing.join(", ")}`]);
            return;
          }

          for (let idx = 1; idx < lines.length; idx++) {
            const cols = parseLine(lines[idx], delimiter);
            if (cols.length === 0 || (cols.length === 1 && cols[0] === "")) continue;

            const rowNum = idx + 1;
            if (cols.length < headers.length) {
              errors.push(`Linha ${rowNum}: Número de colunas insuficiente (${cols.length} de ${headers.length}).`);
              continue;
            }

            const rowData: Record<string, string> = {};
            headers.forEach((h, hIdx) => {
              rowData[h] = cols[hIdx] || "";
            });

            if (!rowData["NOME_COMPLETO"]) {
              errors.push(`Linha ${rowNum}: NOME_COMPLETO está vazio.`);
            }

            const gen = rowData["GENERO"].toUpperCase();
            if (gen && gen !== "M" && gen !== "F") {
              errors.push(`Linha ${rowNum}: GENERO inválido (${rowData["GENERO"]}). Use apenas M ou F.`);
            }

            const dataNasc = rowData["DATA_NASCIMENTO"];
            if (dataNasc) {
              const dateRegex = /^(\d{2}\/\d{2}\/\d{4})|(\d{4}-\d{2}-\d{2})$/;
              if (!dateRegex.test(dataNasc)) {
                errors.push(`Linha ${rowNum}: DATA_NASCIMENTO em formato inválido (${dataNasc}). Use DD/MM/AAAA.`);
              }
            }

            if (!rowData["TURMA_CODIGO"]) {
              errors.push(`Linha ${rowNum}: TURMA_CODIGO está vazio.`);
            }

            const email = rowData["EMAIL_ENCARREGADO"];
            if (email) {
              const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
              if (!emailRegex.test(email)) {
                errors.push(`Linha ${rowNum}: EMAIL_ENCARREGADO inválido (${email}).`);
              }
            }
          }
        } else {
          const required = ["NOME_COMPLETO", "GENERO", "DATA_NASCIMENTO", "TELEFONE", "EMAIL", "HABILITACOES", "DISCIPLINAS_CODIGOS"];
          const missing = required.filter(col => !headers.includes(col));
          if (missing.length > 0) {
            resolve([`Cabeçalho de Professores inválido. Colunas em falta: ${missing.join(", ")}`]);
            return;
          }

          for (let idx = 1; idx < lines.length; idx++) {
            const cols = parseLine(lines[idx], delimiter);
            if (cols.length === 0 || (cols.length === 1 && cols[0] === "")) continue;

            const rowNum = idx + 1;
            if (cols.length < headers.length) {
              errors.push(`Linha ${rowNum}: Número de colunas insuficiente (${cols.length} de ${headers.length}).`);
              continue;
            }

            const rowData: Record<string, string> = {};
            headers.forEach((h, hIdx) => {
              rowData[h] = cols[hIdx] || "";
            });

            if (!rowData["NOME_COMPLETO"]) {
              errors.push(`Linha ${rowNum}: NOME_COMPLETO está vazio.`);
            }

            const gen = rowData["GENERO"].toUpperCase();
            if (gen && gen !== "M" && gen !== "F") {
              errors.push(`Linha ${rowNum}: GENERO inválido (${rowData["GENERO"]}). Use apenas M ou F.`);
            }

            const email = rowData["EMAIL"];
            if (!email) {
              errors.push(`Linha ${rowNum}: EMAIL está vazio.`);
            } else {
              const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
              if (!emailRegex.test(email)) {
                errors.push(`Linha ${rowNum}: EMAIL inválido (${email}).`);
              }
            }

            if (!rowData["DISCIPLINAS_CODIGOS"]) {
              errors.push(`Linha ${rowNum}: DISCIPLINAS_CODIGOS está vazio.`);
            }
          }
        }

        resolve(errors);
      };
      reader.onerror = () => {
        resolve(["Erro ao ler o arquivo CSV."]);
      };
      reader.readAsText(file);
    });
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStep || !selectedFile) {
      toast.warning("Selecione um arquivo e a etapa correspondente.");
      return;
    }

    setUploading(true);
    setValidationErrors([]);

    if (selectedStep === "planilhas") {
      if (selectedFile.name.endsWith(".csv")) {
        const errs = await validateSpreadsheet(selectedFile);
        if (errs.length > 0) {
          setValidationErrors(errs.slice(0, 10)); // Exibir apenas os 10 primeiros erros na UI para evitar sobrecarga
          setUploading(false);
          toast.error("O arquivo contém erros de formatação e não pôde ser enviado.");
          return;
        }
      }
    }

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("step_code", selectedStep);
    formData.append("created_by", "escola");

    try {
      const response = await fetch(`/api/onboarding/${token}/upload`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Erro ao realizar upload");
      }

      toast.success("Documento enviado com sucesso! Aguarda validação da equipe KLASSE.");
      setSelectedFile(null);
      
      // Reset file input
      const fileInput = document.getElementById("fileInput") as HTMLInputElement;
      if (fileInput) fileInput.value = "";
      
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Erro no upload");
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAF9] flex items-center justify-center p-6">
        <div className="text-center space-y-4">
          <RefreshCw className="w-12 h-12 animate-spin text-[#1F6B3B] mx-auto" />
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Carregando painel de ativação...</p>
        </div>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="min-h-screen bg-[#F8FAF9] flex items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-white border border-slate-200 p-8 rounded-3xl space-y-6 shadow-sm">
          <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle size={32} />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-slate-900">Acesso Inválido</h2>
            <p className="text-slate-500 text-sm">Este token de acompanhamento de onboarding expirou ou não existe.</p>
          </div>
          <Link href="/onboarding" className="inline-block bg-[#1F6B3B] hover:bg-[#1F6B3B]/90 text-white rounded-xl font-bold text-xs uppercase tracking-widest px-6 py-3 no-underline">
            Voltar para Onboarding
          </Link>
        </div>
      </div>
    );
  }

  const completedSteps = steps.filter(s => s.status === "concluido").length;
  const progressPercent = steps.length > 0 ? Math.round((completedSteps / steps.length) * 100) : 0;
  const schoolUploadableSteps = steps.filter(
    (step) => step.status !== "concluido" && getStepMeta(step.step_code, step.owner_type).uploadableBySchool
  );

  return (
    <div className="min-h-screen bg-[#F8FAF9] font-sans pb-20">
      
      {/* Header */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#E8F5EE] flex items-center justify-center text-[#1F6B3B]">
              <School size={20} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Portal de Ativação Colaborativo</p>
              <h1 className="text-lg font-black text-slate-950 tracking-tight">{request.escola_nome}</h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden md:block">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Token de Acompanhamento</p>
              <p className="text-xs font-mono font-bold text-slate-600">{request.tracking_token}</p>
            </div>
            <button onClick={loadData} className="p-2 hover:bg-slate-50 rounded-xl transition-colors border border-slate-200">
              <RefreshCw size={16} className="text-slate-500" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        
        {/* Progress Card */}
        <div className="bg-slate-950 text-white rounded-3xl p-6 md:p-8 shadow-xl flex flex-col md:flex-row items-center gap-6 justify-between border border-white/5">
          <div className="space-y-3 max-w-xl text-center md:text-left">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-white/10 text-klasse-gold">
              Progresso do Onboarding
            </div>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight">Estamos quase prontos para ativar o vosso portal!</h2>
            <p className="text-xs md:text-sm text-slate-400 leading-relaxed">
              O onboarding segue 7 fases oficiais. Aqui a escola acompanha a jornada completa e envia apenas os documentos sob sua responsabilidade.
            </p>
          </div>
          
          <div className="flex flex-col items-center gap-2 flex-shrink-0">
            <div className="relative w-28 h-28 flex items-center justify-center">
              {/* Outer Circular Track */}
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="56" cy="56" r="48" stroke="rgba(255,255,255,0.05)" strokeWidth="8" fill="transparent" />
                <circle cx="56" cy="56" r="48" stroke="#E3B23C" strokeWidth="8" fill="transparent"
                  strokeDasharray={2 * Math.PI * 48}
                  strokeDashoffset={2 * Math.PI * 48 * (1 - progressPercent / 100)}
                  strokeLinecap="round"
                  className="transition-all duration-1000 ease-out"
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="text-2xl font-black text-white">{progressPercent}%</span>
                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{completedSteps}/{steps.length} Concluído</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Timeline / Checklist */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Etapas e Controlo de SLA</h3>
            
            <div className="space-y-3">
              {steps.map((step, index) => {
                const isCompleted = step.status === "concluido";
                const isProgress = step.status === "em_progresso";
                const isOverdue = new Date() >= new Date(step.deadline_at) && !isCompleted;
                const meta = getStepMeta(step.step_code, step.owner_type);

                return (
                  <div key={step.id} className={`bg-white border rounded-2xl p-5 transition-all flex items-start gap-4 shadow-sm hover:shadow-md ${isProgress ? 'border-[#1F6B3B]' : 'border-slate-200'}`}>
                    <div className="flex flex-col items-center gap-1.5 flex-shrink-0 mt-0.5">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm
                        ${isCompleted ? 'bg-[#E8F5EE] text-[#1F6B3B]' : isProgress ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-400'}`}>
                        {isCompleted ? <Check size={16} /> : index + 1}
                      </div>
                      <div className="text-[8px] font-black uppercase text-slate-400">{meta.short}</div>
                    </div>
                    
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h4 className="font-bold text-slate-900 truncate">{step.title}</h4>
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-bold border
                            ${step.owner_type === 'escola' ? 'bg-blue-50 text-blue-700 border-blue-100' : step.owner_type === 'parceiro' ? 'bg-purple-50 text-purple-700 border-purple-100' : 'bg-slate-50 text-slate-600 border-slate-100'}`}>
                            {meta.ownerLabel}
                          </span>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-bold border
                            ${isCompleted ? 'bg-[#E8F5EE] text-[#1F6B3B] border-emerald-100' : isOverdue ? 'bg-rose-50 text-rose-700 border-rose-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                            {isCompleted ? 'Concluído' : isOverdue ? 'Atrasado SLA' : 'No Prazo'}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 font-medium">
                        <span className="flex items-center gap-1.5"><Calendar size={12} /> Limite: {format(new Date(step.deadline_at), "dd 'de' MMMM", { locale: pt })}</span>
                        {step.completed_at && (
                          <span className="flex items-center gap-1.5 text-klasse-green"><CheckCircle2 size={12} /> Concluído a: {format(new Date(step.completed_at), "dd/MM/yyyy", { locale: pt })}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          
          {/* Side Panels - Upload Widget & History */}
          <div className="space-y-6">
            
            {/* Upload Widget */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="space-y-1">
                <h3 className="font-black text-slate-900 text-sm">Enviar Pendências</h3>
                <p className="text-xs text-slate-500 leading-relaxed">Envie apenas documentos das fases da escola: documentos legais e planilhas operacionais.</p>
              </div>
              
              <form onSubmit={handleUpload} className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Etapa de Destino</label>
                  <select 
                    value={selectedStep} 
                    onChange={e => setSelectedStep(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none cursor-pointer focus:ring-4 focus:ring-[#1F6B3B]/5 focus:border-[#1F6B3B]/30"
                  >
                    <option value="" disabled>
                      {schoolUploadableSteps.length > 0 ? "Selecione a fase da escola" : "Nenhuma fase da escola pendente"}
                    </option>
                    {schoolUploadableSteps.map(s => (
                      <option key={s.id} value={s.step_code}>{getStepMeta(s.step_code, s.owner_type).short} · {s.title}</option>
                    ))}
                  </select>
                </div>
                {schoolUploadableSteps.length === 0 && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-[11px] font-medium text-slate-600 leading-relaxed">
                    No momento não há pendências documentais da escola. As próximas fases estão com o parceiro comercial ou com a equipa KLASSE.
                  </div>
                )}
                
                <div className="border-2 border-dashed border-slate-200 rounded-2xl p-5 text-center bg-slate-50 hover:bg-slate-50/80 transition-colors relative cursor-pointer">
                  <input 
                    type="file" 
                    id="fileInput"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <UploadCloud className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-600">{selectedFile ? selectedFile.name : "Clique ou arraste um arquivo"}</p>
                  <p className="text-[10px] text-slate-400 mt-1">PDF, Imagem, Excel ou CSV até 10MB</p>
                </div>
                
                <button
                  type="submit"
                  disabled={uploading || !selectedFile || !selectedStep || schoolUploadableSteps.length === 0}
                  className="w-full bg-[#1F6B3B] hover:bg-[#1F6B3B]/90 text-white font-black text-xs uppercase tracking-widest py-3 rounded-xl shadow-lg shadow-emerald-700/10 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      ENVIANDO...
                    </>
                  ) : (
                    <>
                      <UploadCloud size={14} />
                      ENVIAR FICHEIRO
                    </>
                  )}
                </button>

                {validationErrors.length > 0 && (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 space-y-2 animate-in fade-in duration-200">
                    <div className="flex items-center gap-2 text-rose-800 font-bold text-xs">
                      <AlertCircle size={14} />
                      <span>Erros encontrados na planilha:</span>
                    </div>
                    <ul className="list-disc pl-4 text-[10px] text-rose-700 font-medium space-y-1 max-h-[150px] overflow-y-auto">
                      {validationErrors.map((err, idx) => (
                        <li key={idx}>{err}</li>
                      ))}
                    </ul>
                    <p className="text-[9px] text-rose-500 font-bold">Por favor, corrija os erros na planilha e tente enviar novamente.</p>
                  </div>
                )}
              </form>
            </div>
            
            {/* Modelos de Planilha */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="space-y-1">
                <h3 className="font-black text-slate-900 text-sm">Modelos de Planilhas</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Baixe os modelos oficiais abaixo para preencher os dados solicitados na etapa de planilhas.
                </p>
              </div>
              <div className="space-y-2">
                <a
                  href="/templates/modelo_alunos.csv"
                  download="modelo_importacao_alunos.csv"
                  className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100 hover:bg-slate-100/70 transition-all text-xs font-bold text-slate-700 no-underline"
                >
                  <span className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#1F6B3B]" />
                    Planilha de Alunos (.csv)
                  </span>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Baixar</span>
                </a>
                <a
                  href="/templates/modelo_professores.csv"
                  download="modelo_importacao_professores.csv"
                  className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100 hover:bg-slate-100/70 transition-all text-xs font-bold text-slate-700 no-underline"
                >
                  <span className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-purple-600" />
                    Planilha de Professores (.csv)
                  </span>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Baixar</span>
                </a>
              </div>
            </div>

            {/* History of Uploads */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-black text-slate-900 text-sm">Histórico de Envios</h3>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{uploads.length} envios</span>
              </div>
              
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {uploads.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                    <p className="text-xs text-slate-400 font-medium italic">Nenhum envio registrado.</p>
                  </div>
                ) : (
                  uploads.map((upload) => {
                    const statusText = 
                      upload.status === "aprovado" ? "Aprovado" :
                      upload.status === "rejeitado" ? "Rejeitado" :
                      upload.status === "processando" ? "Processando" : "Aguardando Revisão";
                      
                    const statusColor = 
                      upload.status === "aprovado" ? "text-emerald-600 bg-emerald-50 border-emerald-100" :
                      upload.status === "rejeitado" ? "text-rose-600 bg-rose-50 border-rose-100" :
                      upload.status === "processando" ? "text-blue-600 bg-blue-50 border-blue-100" : "text-amber-600 bg-amber-50 border-amber-100";

                    return (
                      <div key={upload.id} className="p-3 rounded-xl border border-slate-100 space-y-2 bg-slate-50/50">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-800 truncate">{upload.file_path.split("/").pop()}</p>
                            <p className="text-[9px] font-bold text-[#1F6B3B] uppercase tracking-wider mt-0.5">
                              Etapa: {getStepMeta(upload.step_code, upload.created_by === "escola" ? "escola" : "parceiro").short}
                            </p>
                          </div>
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold border ${statusColor}`}>
                            {statusText}
                          </span>
                        </div>
                        
                        {upload.rejection_reason && (
                          <div className="p-2 rounded-lg bg-rose-50 border border-rose-100 text-[10px] text-rose-700 leading-relaxed font-medium">
                            <Info size={10} className="inline mr-1" />
                            Motivo: {upload.rejection_reason}
                          </div>
                        )}
                        
                        <p className="text-[9px] text-slate-400 font-medium text-right">
                          {format(new Date(upload.created_at), "dd/MM/yyyy HH:mm")}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

          </div>

        </div>

      </main>

    </div>
  );
}
