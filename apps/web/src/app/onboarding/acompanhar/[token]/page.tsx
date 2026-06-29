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
  planilhas: { short: "Planilhas", ownerLabel: "Escola + Parceiro", uploadableBySchool: true },
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
        <div className="max-w-md w-full bg-white border border-zinc-200/50 p-8 rounded-xl space-y-6 shadow-sm">
          <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto border border-rose-100/50">
            <AlertCircle size={28} />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-bold text-zinc-900">Acesso Inválido</h2>
            <p className="text-zinc-500 text-xs leading-relaxed">Este token de acompanhamento de onboarding expirou ou não existe.</p>
          </div>
          <Link href="/onboarding" className="inline-block bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold text-xs uppercase tracking-wider px-5 py-2.5 no-underline">
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
    <div className="min-h-screen bg-zinc-50/50 font-sans pb-20">
      
      {/* Header */}
      <header className="bg-white border-b border-zinc-200/55 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600">
              <School size={18} />
            </div>
            <div>
              <p className="text-[9px] font-semibold text-zinc-400 uppercase tracking-wider mb-0.5">Portal de Ativação Colaborativo</p>
              <h1 className="text-base font-bold text-zinc-950 tracking-tight leading-none">{request.escola_nome}</h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden md:block">
              <p className="text-[9px] font-semibold text-zinc-400 uppercase tracking-wider mb-0.5">Token de Acompanhamento</p>
              <p className="text-xs font-mono font-semibold text-zinc-500">{request.tracking_token}</p>
            </div>
            <button onClick={loadData} className="p-2 hover:bg-zinc-50 rounded-lg transition-colors border border-zinc-200/60 bg-white">
              <RefreshCw size={14} className="text-zinc-500" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        
        {/* Progress Card */}
        <div className="bg-zinc-950 text-white rounded-xl p-6 md:p-8 shadow-xl flex flex-col md:flex-row items-center gap-6 justify-between border border-zinc-800">
          <div className="space-y-2.5 max-w-xl text-center md:text-left">
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[8px] font-semibold uppercase tracking-wider bg-white/10 text-amber-400">
              Progresso do Onboarding
            </div>
            <h2 className="text-xl md:text-2xl font-bold tracking-tight">Estamos quase prontos para ativar o vosso portal!</h2>
            <p className="text-xs text-zinc-400 leading-relaxed">
              O onboarding segue 7 fases oficiais. Aqui a escola acompanha a jornada completa e envia apenas os documentos sob sua responsabilidade.
            </p>
          </div>
          
          <div className="flex flex-col items-center gap-2 flex-shrink-0">
            <div className="relative w-24 h-24 flex items-center justify-center">
              {/* Outer Circular Track */}
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="48" cy="48" r="40" stroke="rgba(255,255,255,0.05)" strokeWidth="6" fill="transparent" />
                <circle cx="48" cy="48" r="40" stroke="#fbbf24" strokeWidth="6" fill="transparent"
                  strokeDasharray={2 * Math.PI * 40}
                  strokeDashoffset={2 * Math.PI * 40 * (1 - progressPercent / 100)}
                  strokeLinecap="round"
                  className="transition-all duration-1000 ease-out"
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="text-xl font-bold text-white font-mono leading-none">{progressPercent}%</span>
                <span className="text-[7.5px] font-semibold text-zinc-500 uppercase tracking-wider mt-1">{completedSteps}/{steps.length} Concluído</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Timeline / Checklist */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Etapas e Controlo de SLA</h3>
            
            <div className="space-y-3">
              {steps.map((step, index) => {
                const isCompleted = step.status === "concluido";
                const isProgress = step.status === "em_progresso";
                const isOverdue = new Date() >= new Date(step.deadline_at) && !isCompleted;
                const meta = getStepMeta(step.step_code, step.owner_type);

                return (
                  <div key={step.id} className={`bg-white border rounded-xl p-4.5 transition-all flex items-start gap-4 shadow-sm hover:shadow-[0_4px_12px_rgba(0,0,0,0.02)] ${isProgress ? 'border-emerald-500/80 ring-1 ring-emerald-500/10' : 'border-zinc-200/50'}`}>
                    <div className="flex flex-col items-center gap-1.5 flex-shrink-0 mt-0.5">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs
                        ${isCompleted ? 'bg-emerald-500/10 text-emerald-600' : isProgress ? 'bg-amber-500/10 text-amber-600' : 'bg-zinc-100 text-zinc-400'}`}>
                        {isCompleted ? <Check size={14} /> : index + 1}
                      </div>
                      <div className="text-[7.5px] font-semibold uppercase text-zinc-400 tracking-wider font-mono">{meta.short}</div>
                    </div>
                    
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h4 className="font-bold text-zinc-900 text-sm truncate">{step.title}</h4>
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[8px] font-semibold border
                            ${step.owner_type === 'escola' ? 'bg-blue-500/10 text-blue-600 border-none' : step.owner_type === 'parceiro' ? 'bg-purple-500/10 text-purple-600 border-none' : 'bg-zinc-100 text-zinc-600 border-none'}`}>
                            {meta.ownerLabel}
                          </span>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[8px] font-semibold border
                            ${isCompleted ? 'bg-emerald-500/10 text-emerald-600 border-none' : isOverdue ? 'bg-rose-500/10 text-rose-600 border-none' : 'bg-amber-500/10 text-amber-600 border-none'}`}>
                            {isCompleted ? 'Concluído' : isOverdue ? 'Atrasado SLA' : 'No Prazo'}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10.5px] text-zinc-400 font-medium font-mono">
                        <span className="flex items-center gap-1.5"><Calendar size={11} className="text-zinc-300" /> Limite: {format(new Date(step.deadline_at), "dd 'de' MMMM", { locale: pt })}</span>
                        {step.completed_at && (
                          <span className="flex items-center gap-1.5 text-emerald-600"><CheckCircle2 size={11} /> Concluído: {format(new Date(step.completed_at), "dd/MM/yyyy", { locale: pt })}</span>
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
            <div className="bg-white border border-zinc-200/50 rounded-xl p-5 shadow-sm space-y-4">
              <div className="space-y-1">
                <h3 className="font-bold text-zinc-900 text-sm">Enviar Pendências</h3>
                <p className="text-xs text-zinc-500 leading-relaxed">Envie apenas documentos das fases da escola: documentos legais e planilhas operacionais.</p>
              </div>
              
              <form onSubmit={handleUpload} className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-[9px] font-semibold uppercase tracking-wider text-zinc-400">Etapa de Destino</label>
                  <select 
                    value={selectedStep} 
                    onChange={e => setSelectedStep(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-xs font-semibold outline-none cursor-pointer focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500/30"
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
                  <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-[11px] font-medium text-zinc-600 leading-relaxed">
                    No momento não há pendências documentais da escola. As próximas fases estão com o parceiro comercial ou com a equipa KLASSE.
                  </div>
                )}
                
                <div className="border border-dashed border-zinc-200 rounded-lg p-5 text-center bg-zinc-50/50 hover:bg-zinc-50/80 transition-colors relative cursor-pointer">
                  <input 
                    type="file" 
                    id="fileInput"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <UploadCloud className="w-8 h-8 text-zinc-400 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-zinc-600">{selectedFile ? selectedFile.name : "Clique ou arraste um arquivo"}</p>
                  <p className="text-[9px] text-zinc-400 mt-1">PDF, Imagem, Excel ou CSV até 10MB</p>
                </div>
                
                <button
                  type="submit"
                  disabled={uploading || !selectedFile || !selectedStep || schoolUploadableSteps.length === 0}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs uppercase tracking-wider py-2.5 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed border-none shadow-none"
                >
                  {uploading ? (
                    <>
                      <RefreshCw size={13} className="animate-spin mr-1.5" />
                      ENVIANDO...
                    </>
                  ) : (
                    <>
                      <UploadCloud size={13} />
                      ENVIAR FICHEIRO
                    </>
                  )}
                </button>

                {validationErrors.length > 0 && (
                  <div className="rounded-lg border border-rose-200 bg-rose-500/5 p-4 space-y-2 animate-in fade-in duration-200">
                    <div className="flex items-center gap-2 text-rose-600 font-semibold text-xs">
                      <AlertCircle size={14} />
                      <span>Erros encontrados na planilha:</span>
                    </div>
                    <ul className="list-disc pl-4 text-[10px] text-rose-600/95 font-medium space-y-1 max-h-[150px] overflow-y-auto font-mono">
                      {validationErrors.map((err, idx) => (
                        <li key={idx}>{err}</li>
                      ))}
                    </ul>
                    <p className="text-[9px] text-rose-500 font-semibold">Por favor, corrija os erros na planilha e tente enviar novamente.</p>
                  </div>
                )}
              </form>
            </div>
            
            {/* Modelos de Planilha */}
            <div className="bg-white border border-zinc-200/50 rounded-xl p-5 shadow-sm space-y-4">
              <div className="space-y-1">
                <h3 className="font-bold text-zinc-900 text-sm">Modelos de Planilhas</h3>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Baixe os modelos oficiais abaixo para preencher os dados solicitados na etapa de planilhas.
                </p>
              </div>
              <div className="space-y-2">
                <a
                  href="/templates/modelo_alunos.csv"
                  download="modelo_importacao_alunos.csv"
                  className="w-full flex items-center justify-between p-3 rounded-lg bg-zinc-50 border border-zinc-200/40 hover:bg-zinc-100/70 transition-all text-xs font-semibold text-zinc-700 no-underline"
                >
                  <span className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-emerald-600" />
                    Planilha de Alunos (.csv)
                  </span>
                  <span className="text-[9px] text-zinc-400 font-semibold uppercase tracking-wider">Baixar</span>
                </a>
                <a
                  href="/templates/modelo_professores.csv"
                  download="modelo_importacao_professores.csv"
                  className="w-full flex items-center justify-between p-3 rounded-lg bg-zinc-50 border border-zinc-200/40 hover:bg-zinc-100/70 transition-all text-xs font-semibold text-zinc-700 no-underline"
                >
                  <span className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-purple-600" />
                    Planilha de Professores (.csv)
                  </span>
                  <span className="text-[9px] text-zinc-400 font-semibold uppercase tracking-wider">Baixar</span>
                </a>
              </div>
            </div>

            {/* History of Uploads */}
            <div className="bg-white border border-zinc-200/50 rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-zinc-900 text-sm">Histórico de Envios</h3>
                <span className="text-[9px] font-semibold text-zinc-400 uppercase tracking-wider font-mono">{uploads.length} envios</span>
              </div>
              
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {uploads.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="w-8 h-8 text-zinc-200 mx-auto mb-2" />
                    <p className="text-xs text-zinc-400 font-medium italic">Nenhum envio registrado.</p>
                  </div>
                ) : (
                  uploads.map((upload) => {
                    const statusText = 
                      upload.status === "aprovado" ? "Aprovado" :
                      upload.status === "rejeitado" ? "Rejeitado" :
                      upload.status === "processando" ? "Processando" : "Aguardando Revisão";
                      
                    const statusColor = 
                      upload.status === "aprovado" ? "text-emerald-600 bg-emerald-500/5 border-emerald-500/10" :
                      upload.status === "rejeitado" ? "text-rose-600 bg-rose-500/5 border-rose-500/10" :
                      upload.status === "processando" ? "text-blue-600 bg-blue-500/5 border-blue-500/10" : "text-amber-600 bg-amber-500/5 border-amber-500/10";

                    return (
                      <div key={upload.id} className="p-3 rounded-lg border border-zinc-200/50 space-y-2 bg-zinc-50/30">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-zinc-800 truncate" title={upload.file_path.split("/").pop()}>{upload.file_path.split("/").pop()}</p>
                            <p className="text-[9px] font-semibold text-emerald-600 uppercase tracking-wider mt-0.5">
                              Etapa: {getStepMeta(upload.step_code, upload.created_by === "escola" ? "escola" : "parceiro").short}
                            </p>
                          </div>
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-semibold border ${statusColor} shadow-none`}>
                            {statusText}
                          </span>
                        </div>
                        
                        {upload.rejection_reason && (
                          <div className="p-2 rounded bg-rose-500/5 border border-rose-500/10 text-[10px] text-rose-600 leading-relaxed font-medium">
                            <Info size={10} className="inline mr-1" />
                            Motivo: {upload.rejection_reason}
                          </div>
                        )}
                        
                        <p className="text-[9px] text-zinc-400 font-medium text-right font-mono">
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
