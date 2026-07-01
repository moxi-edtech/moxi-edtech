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
  Info,
  Send,
  Mail,
  MessageSquare
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

type PublicLifecycleMeta = {
  badge: string;
  title: string;
  description: string;
  nextOwner: string;
  tone: string;
};

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

function getLifecycleMeta(
  status: OnboardingRequest["status"],
  steps: OnboardingStep[]
): PublicLifecycleMeta {
  const nextPendingStep = steps.find((step) => step.status !== "concluido") ?? null;
  const nextStepMeta = nextPendingStep ? getStepMeta(nextPendingStep.step_code, nextPendingStep.owner_type) : null;

  if (status === "activo") {
    return {
      badge: "Escola provisionada",
      title: "A base da escola já foi provisionada pela KLASSE.",
      description: "Os envios documentais desta jornada foram concluídos. O próximo passo é entrar no portal escolar para terminar o setup interno e avançar para a prontidão operacional.",
      nextOwner: "Escola",
      tone: "border-emerald-100 bg-emerald-50 text-emerald-800",
    };
  }

  if (status === "em_configuracao") {
    return {
      badge: "Onboarding em curso",
      title: nextStepMeta
        ? `Estamos a avançar para ${nextStepMeta.short}.`
        : "O onboarding operacional está em curso.",
      description: nextStepMeta
        ? `A próxima etapa real está com ${nextStepMeta.ownerLabel}. Envie apenas o que estiver pendente sob responsabilidade da escola.`
        : "A escola acompanha aqui o progresso e envia apenas os itens pedidos neste momento.",
      nextOwner: nextStepMeta?.ownerLabel ?? "Parceiro / KLASSE",
      tone: "border-amber-100 bg-amber-50 text-amber-800",
    };
  }

  return {
    badge: "Pedido criado",
    title: "O pedido de onboarding da escola já está registado.",
    description: "A equipa vai avançar pelas etapas operacionais. Quando houver pendências da escola, elas aparecerão aqui com o próximo passo certo.",
    nextOwner: nextStepMeta?.ownerLabel ?? "Parceiro Comercial",
    tone: "border-blue-100 bg-blue-50 text-blue-800",
  };
}
const validateSingleRow = (rowData: any, isAlunos: boolean, headers: string[]): Record<string, string> => {
  const rowErrors: Record<string, string> = {};
  
  if (!rowData["NOME_COMPLETO"]) {
    rowErrors["NOME_COMPLETO"] = "Nome é obrigatório.";
  }

  const gen = String(rowData["GENERO"] || "").toUpperCase().trim();
  if (!gen) {
    rowErrors["GENERO"] = "Gênero é obrigatório.";
  } else if (gen !== "M" && gen !== "F") {
    rowErrors["GENERO"] = "M ou F.";
  }

  const dataNasc = String(rowData["DATA_NASCIMENTO"] || "").trim();
  if (!dataNasc) {
    rowErrors["DATA_NASCIMENTO"] = "Data de nascimento é obrigatória.";
  } else {
    const dateRegex = /^(\d{2}\/\d{2}\/\d{4})|(\d{4}-\d{2}-\d{2})|(\d{5})$/;
    if (!dateRegex.test(dataNasc)) {
      rowErrors["DATA_NASCIMENTO"] = "Formato inválido.";
    }
  }

  if (isAlunos) {
    if (!rowData["TURMA_CODIGO"]) {
      rowErrors["TURMA_CODIGO"] = "Código da turma é obrigatório.";
    }

    const emailEncarregado = rowData["EMAIL_ENCARREGADO"];
    if (emailEncarregado) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(emailEncarregado)) {
        rowErrors["EMAIL_ENCARREGADO"] = "E-mail inválido.";
      }
    }
  } else {
    const email = rowData["EMAIL"];
    if (!email) {
      rowErrors["EMAIL"] = "E-mail é obrigatório.";
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        rowErrors["EMAIL"] = "E-mail inválido.";
      }
    }
  }
  
  return rowErrors;
};

const convertToCsvFile = (headers: string[], rows: any[], fileName: string): File => {
  const csvLines: string[] = [];
  
  // Header line
  csvLines.push(headers.join(","));
  
  // Data lines
  rows.forEach(row => {
    const line = headers.map(h => {
      const cell = row[h] === null || row[h] === undefined ? "" : String(row[h]).trim();
      if (cell.includes(",") || cell.includes("\"") || cell.includes("\n")) {
        return `"${cell.replace(/"/g, '""')}"`;
      }
      return cell;
    }).join(",");
    csvLines.push(line);
  });
  
  const csvContent = csvLines.join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const baseName = fileName.replace(/\.[^/.]+$/, "");
  return new File([blob], `${baseName}_corrigido.csv`, { type: "text/csv" });
};

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
  const [stagedRows, setStagedRows] = useState<any[]>([]);
  const [invalidRows, setInvalidRows] = useState<any[]>([]);
  const [isEditingErrors, setIsEditingErrors] = useState(false);
  const [isAlunosStaged, setIsAlunosStaged] = useState(true);
  const [stagedHeaders, setStagedHeaders] = useState<string[]>([]);
  const [operationalReadiness, setOperationalReadiness] = useState<any | null>(null);

  const [helpMessages, setHelpMessages] = useState<any[]>([]);
  const [newDoubtText, setNewDoubtText] = useState("");
  const [senderName, setSenderName] = useState("");
  const [submittingDoubt, setSubmittingDoubt] = useState(false);

  const loadHelpMessages = async () => {
    try {
      const response = await fetch(`/api/onboarding/acompanhar/${token}/help`, { cache: "no-store" });
      const data = await response.json();
      if (response.ok && data.ok) {
        setHelpMessages(data.messages || []);
      }
    } catch (err) {
      console.error("Erro ao carregar mensagens de ajuda:", err);
    }
  };

  const handleDoubtSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!senderName.trim() || !newDoubtText.trim()) {
      toast.error("Preencha o seu nome e a sua dúvida/mensagem.");
      return;
    }

    setSubmittingDoubt(true);
    try {
      const response = await fetch(`/api/onboarding/acompanhar/${token}/help`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sender_name: senderName,
          message: newDoubtText,
          step_code: selectedStep || null,
        }),
      });

      const data = await response.json();
      if (response.ok && data.ok) {
        toast.success("Mensagem enviada com sucesso!");
        setNewDoubtText("");
        setHelpMessages((prev) => [...prev, data.doubt]);
      } else {
        toast.error(data.error || "Erro ao enviar mensagem.");
      }
    } catch (err) {
      toast.error("Erro ao conectar com o servidor.");
    } finally {
      setSubmittingDoubt(false);
    }
  };

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
      setOperationalReadiness(data.operational_readiness || null);
      
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
    loadHelpMessages();
  }, [token]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setValidationErrors([]);
    }
  };

  const validateSpreadsheet = async (file: File): Promise<{
    errors: string[];
    isAlunos: boolean;
    headers: string[];
    allRows: any[];
    invalidRows: any[];
  }> => {
    const parseLine = (line: string, delim: string): string[] => {
      const result: string[] = [];
      let current = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === delim && !inQuotes) {
          result.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const validateRows = (rows: string[][]): {
      errors: string[];
      isAlunos: boolean;
      headers: string[];
      allRows: any[];
      invalidRows: any[];
    } => {
      if (rows.length === 0) return { errors: ["O arquivo está vazio."], isAlunos: true, headers: [], allRows: [], invalidRows: [] };

      // Verificar se a primeira linha contem a assinatura do template KLASSE
      let headerRowIndex = 0;
      const firstCell = String(rows[0]?.[0] || "");
      if (firstCell.includes("KLASSE") && (firstCell.includes("Modelo de Importação") || firstCell.includes("Importação") || firstCell.includes("Mapa de Atribuições"))) {
        headerRowIndex = 3; // Linha 4 (0-indexed: 3)
      }

      if (rows.length <= headerRowIndex) {
        return { errors: ["O arquivo não contém cabeçalho ou dados."], isAlunos: true, headers: [], allRows: [], invalidRows: [] };
      }

      const normalizeHeader = (h: string) => {
        return String(h || "")
          .trim()
          .toUpperCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/\*/g, "")
          .replace(/\s+/g, "_");
      };

      const HEADER_ALIASES: Record<string, string> = {
        "NOME": "NOME_COMPLETO",
        "DATA_DE_NASCIMENTO": "DATA_NASCIMENTO",
        "BI": "BI_NUMERO",
        "HABILITACOES": "HABILITACOES",
        "TELEFONE": "TELEFONE",
        "EMAIL": "EMAIL",
        "GENERO": "GENERO",
        "SEXO": "GENERO"
      };

      const rawHeaders = rows[headerRowIndex].map((header) => normalizeHeader(String(header || "")));
      const headers = rawHeaders.map(h => HEADER_ALIASES[h] || h);
      const errors: string[] = [];

      const isAlunos = headers.includes("NUMERO_PROCESSO") || headers.includes("NOME_ENCARREGADO") || headers.includes("TURMA_CODIGO");
      const isProfessores = headers.includes("HABILITACOES") || headers.includes("VINCULO_CONTRATUAL") || headers.includes("TIPO_VINCULO");

      if (!isAlunos && !isProfessores) {
        return { errors: ["O cabeçalho do arquivo não corresponde aos modelos oficiais de Alunos ou Professores. Use o modelo sugerido abaixo ou ajuste os nomes das colunas."], isAlunos: true, headers: [], allRows: [], invalidRows: [] };
      }

      const required = isAlunos
        ? ["NOME_COMPLETO", "NUMERO_PROCESSO", "GENERO", "DATA_NASCIMENTO", "TURMA_CODIGO"]
        : ["NOME_COMPLETO", "GENERO", "DATA_NASCIMENTO", "TELEFONE", "EMAIL", "HABILITACOES"];

      const missing = required.filter((col) => !headers.includes(col));
      if (missing.length > 0) {
        return { errors: [`Cabeçalho de ${isAlunos ? "Alunos" : "Professores"} inválido. Colunas em falta: ${missing.join(", ")}`], isAlunos, headers, allRows: [], invalidRows: [] };
      }

      const allRows: any[] = [];
      const invalidRows: any[] = [];

      for (let idx = headerRowIndex + 1; idx < rows.length; idx++) {
        const cols = rows[idx].map((item) => String(item ?? "").trim());
        if (cols.length === 0 || cols.every((col) => !col)) continue;

        const rowNum = idx + 1;

        const rowData: Record<string, string> = {};
        headers.forEach((header, headerIndex) => {
          rowData[header] = cols[headerIndex] || "";
        });

        const rowErrors = validateSingleRow(rowData, isAlunos, headers);
        const stagedRow: any = {
          ...rowData,
          _rowNum: rowNum
        };

        if (Object.keys(rowErrors).length > 0) {
          stagedRow._errors = rowErrors;
          invalidRows.push(stagedRow);
          Object.values(rowErrors).forEach(err => {
            errors.push(`Linha ${rowNum}: ${err}`);
          });
        }
        allRows.push(stagedRow);
      }

      return {
        errors,
        isAlunos,
        headers,
        allRows,
        invalidRows
      };
    };

    const lowerName = file.name.toLowerCase();
    if (lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls")) {
      try {
        const [{ read, utils }, buffer] = await Promise.all([
          import("xlsx"),
          file.arrayBuffer(),
        ]);
        const workbook = read(buffer, { type: "array" });
        const targetSheetName = workbook.SheetNames.find(n => n === "Importacao_Alunos" || n === "Lista_Professores") || workbook.SheetNames[0];
        const sheet = workbook.Sheets[targetSheetName];
        if (!sheet) {
          return { errors: ["Não foi possível ler as planilhas do arquivo Excel."], isAlunos: true, headers: [], allRows: [], invalidRows: [] };
        }
        const rows = utils.sheet_to_json<(string | number | null)[]>(sheet, {
          header: 1,
          raw: false,
          defval: "",
        }).map((row) => row.map((cell) => String(cell ?? "")));
        return validateRows(rows);
      } catch (error) {
        console.error(error);
        return { errors: ["Erro ao ler o arquivo Excel. Tente novamente ou use o modelo CSV oficial."], isAlunos: true, headers: [], allRows: [], invalidRows: [] };
      }
    }

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
        if (lines.length === 0) {
          resolve({ errors: ["O arquivo está vazio."], isAlunos: true, headers: [], allRows: [], invalidRows: [] });
          return;
        }

        let delimiter = ",";
        if (lines[0].includes(";")) delimiter = ";";
        const rows = lines.map((line) => parseLine(line, delimiter));
        resolve(validateRows(rows));
      };
      reader.onerror = () => resolve({ errors: ["Erro ao ler o arquivo CSV."], isAlunos: true, headers: [], allRows: [], invalidRows: [] });
      reader.readAsText(file);
    });
  };

  const handleCellChange = (index: number, field: string, value: string) => {
    setInvalidRows(prev => prev.map((row, idx) => {
      if (idx === index) {
        const nextRow = { ...row, [field]: value };
        if (nextRow._errors?.[field]) {
          const nextErrors = { ...nextRow._errors };
          delete nextErrors[field];
          nextRow._errors = nextErrors;
        }
        return nextRow;
      }
      return row;
    }));
  };

  const handleRevalidateAndUpload = async () => {
    setUploading(true);
    
    const newInvalidRows: any[] = [];
    const newErrors: string[] = [];
    
    invalidRows.forEach(row => {
      const rowErrors = validateSingleRow(row, isAlunosStaged, stagedHeaders);
      if (Object.keys(rowErrors).length > 0) {
        newInvalidRows.push({
          ...row,
          _errors: rowErrors
        });
        Object.values(rowErrors).forEach(err => {
          newErrors.push(`Linha ${row._rowNum}: ${err}`);
        });
      }
    });
    
    if (newInvalidRows.length > 0) {
      setInvalidRows(newInvalidRows);
      setValidationErrors(newErrors.slice(0, 10));
      setUploading(false);
      toast.error("Ainda restam erros de validação nas linhas corrigidas.");
      return;
    }
    
    const rowMap = new Map<number, any>(invalidRows.map(r => [r._rowNum, r]));
    const finalRows = stagedRows.map(row => {
      const corrected = rowMap.get(row._rowNum);
      if (corrected) {
        const { _errors, _rowNum, ...cleanRow } = corrected;
        return { ...row, ...cleanRow };
      }
      return row;
    });
    
    const cleanedFile = convertToCsvFile(stagedHeaders, finalRows, selectedFile?.name || "planilha_onboarding.csv");
    
    const formData = new FormData();
    formData.append("file", cleanedFile);
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

      toast.success("Documento enviado e validado com sucesso!");
      setSelectedFile(null);
      setStagedRows([]);
      setInvalidRows([]);
      setIsEditingErrors(false);
      setValidationErrors([]);
      
      const fileInput = document.getElementById("fileInput") as HTMLInputElement;
      if (fileInput) fileInput.value = "";
      
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Erro no upload");
    } finally {
      setUploading(false);
    }
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
      const nameLower = selectedFile.name.toLowerCase();
      if (nameLower.endsWith(".csv") || nameLower.endsWith(".xlsx") || nameLower.endsWith(".xls")) {
        const result = await validateSpreadsheet(selectedFile);
        if (result.errors.length > 0) {
          setStagedRows(result.allRows);
          setInvalidRows(result.invalidRows);
          setStagedHeaders(result.headers);
          setIsAlunosStaged(result.isAlunos);
          setIsEditingErrors(true);
          
          setValidationErrors(result.errors.slice(0, 10)); // Exibir apenas os 10 primeiros erros na UI
          setUploading(false);
          toast.error("O arquivo contém erros de formatação. Corrija-os no painel interativo abaixo.");
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
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Carregando painel de onboarding...</p>
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
  const lifecycleMeta = getLifecycleMeta(request.status, steps);
  const nextSchoolStep = schoolUploadableSteps[0] ?? null;
  const renderReadinessDashboard = () => {
    if (!operationalReadiness) return null;

    const { summary, blockers = [] } = operationalReadiness;
    const areas = [
      { name: "Académico", ok: summary?.academico_ok, key: "academico", desc: "Estrutura letiva, períodos, turmas e pautas" },
      { name: "Financeiro", ok: summary?.financeiro_ok, key: "financeiro", desc: "IBAN, preços e vencimento de propinas" },
      { name: "Equipe", ok: summary?.equipe_ok, key: "equipe", desc: "Administradores e perfis docentes" },
      { name: "Horários", ok: summary?.horarios_ok, key: "horarios", desc: "Slots e quadro de aulas publicado" },
      { name: "Portais", ok: summary?.portais_ok, key: "portais", desc: "Acesso a alunos, encarregados e professores" },
    ];

    const actualBlockers = Array.isArray(blockers) ? blockers : [];

    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <h3 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Painel de Prontidão Operacional (Go-Live)</h3>
        
        {/* Area cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
          {areas.map((area) => (
            <div 
              key={area.key}
              className={`p-4 rounded-xl border flex flex-col justify-between shadow-sm bg-white transition-all hover:shadow-md ${area.ok ? 'border-emerald-100 bg-emerald-50/10' : 'border-amber-100 bg-amber-50/5'}`}
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${area.ok ? 'text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded-full' : 'text-amber-700 bg-amber-100/60 px-2 py-0.5 rounded-full'}`}>
                    {area.name}
                  </span>
                  {area.ok ? (
                    <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                      <Check size={11} strokeWidth={3} />
                    </div>
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-[10px]">
                      !
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-zinc-400 font-medium leading-tight">{area.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {summary?.operational_ok ? (
          /* Go-live Realized Success Notice */
          <div className="rounded-xl border border-emerald-200 bg-emerald-500/5 p-6 text-center space-y-4 shadow-sm">
            <div className="w-12 h-12 bg-emerald-500 text-white flex items-center justify-center rounded-full mx-auto shadow-md">
              <CheckCircle2 size={24} />
            </div>
            <div className="space-y-1">
              <h4 className="font-bold text-zinc-900 text-base">Escola 100% Operacional! 🚀</h4>
              <p className="text-xs text-zinc-500 max-w-md mx-auto leading-relaxed">
                Todas as verificações operacionais e acadêmicas foram concluídas com sucesso. O sistema está plenamente operacional e pronto para o início das aulas.
              </p>
            </div>
          </div>
        ) : (
          /* List of Blockers */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-zinc-800 text-sm">Bloqueadores Pendentes ({actualBlockers.length})</h4>
              <span className="text-[9px] font-semibold text-zinc-400 uppercase tracking-wider font-mono">Status: Aguardando Prontidão</span>
            </div>

            <div className="space-y-3">
              {actualBlockers.map((blocker: any, idx: number) => {
                const isCritical = blocker.severity === "critical";
                return (
                  <div 
                    key={idx}
                    className={`p-4 rounded-xl border flex items-start gap-4 bg-white transition-all hover:shadow-[0_4px_12px_rgba(0,0,0,0.015)] ${isCritical ? 'border-rose-100 hover:border-rose-200' : 'border-amber-100 hover:border-amber-200'}`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5
                      ${isCritical ? 'bg-rose-500/10 text-rose-600' : 'bg-amber-500/10 text-amber-600'}`}>
                      {isCritical ? "🔴" : "⚠️"}
                    </div>
                    
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h5 className="font-bold text-zinc-900 text-sm truncate">{blocker.title}</h5>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[8.5px] font-bold uppercase
                          ${isCritical ? 'bg-rose-500/10 text-rose-600' : 'bg-amber-500/10 text-amber-600'}`}>
                          {isCritical ? "Crítico" : "Recomendado"}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 leading-relaxed font-medium">{blocker.detail}</p>
                      <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest pt-1">Módulo: {blocker.area}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

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
              <p className="text-[9px] font-semibold text-zinc-400 uppercase tracking-wider mb-0.5">Portal de Onboarding</p>
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
            <h2 className="text-xl md:text-2xl font-bold tracking-tight">Acompanhe o onboarding da escola até ela ficar pronta para operar.</h2>
            <p className="text-xs text-zinc-400 leading-relaxed">
              O onboarding segue 7 fases oficiais. Aqui a escola acompanha a jornada completa, entende o próximo passo e envia apenas os itens sob sua responsabilidade.
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

        <div className={`rounded-xl border p-5 shadow-sm ${lifecycleMeta.tone}`}>
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-[0.2em]">{lifecycleMeta.badge}</p>
              <h3 className="text-lg font-bold text-slate-900">{lifecycleMeta.title}</h3>
              <p className="text-sm leading-relaxed text-slate-700">{lifecycleMeta.description}</p>
            </div>
            <div className="rounded-lg bg-white/70 px-4 py-3 text-xs shadow-sm">
              <p className="font-black uppercase tracking-widest text-slate-500">Próximo responsável</p>
              <p className="mt-1 font-semibold text-slate-900">{lifecycleMeta.nextOwner}</p>
              <p className="mt-2 text-slate-600">
                {nextSchoolStep
                  ? `Próxima pendência da escola: ${getStepMeta(nextSchoolStep.step_code, nextSchoolStep.owner_type).short}.`
                  : "Sem pendência documental da escola neste momento."}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Timeline / Checklist / Readiness Dashboard */}
          <div className="lg:col-span-2 space-y-4">
            {request?.status === "activo" && operationalReadiness ? (
              renderReadinessDashboard()
            ) : (
              <>
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
              </>
            )}
            {/* Chat de Dúvidas / Interaction Log (Sprint UX-5) */}
            <div className="bg-white border border-zinc-200/50 rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                <div>
                  <h3 className="font-bold text-zinc-900 text-sm">Canal Direto de Ajuda (Dúvidas)</h3>
                  <p className="text-xs text-zinc-500 leading-normal">
                    Fale diretamente com o seu consultor de implantação para esclarecer pendências.
                  </p>
                </div>
                <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-500">
                  <MessageSquare size={16} />
                </div>
              </div>

              {/* Messages List */}
              <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                {helpMessages.length === 0 ? (
                  <div className="text-center py-8 bg-zinc-50/50 rounded-lg border border-dashed border-zinc-200">
                    <MessageSquare className="w-6 h-6 text-zinc-300 mx-auto mb-1.5" />
                    <p className="text-xs text-zinc-400 font-medium italic">Nenhuma dúvida registrada. Envie a sua mensagem abaixo.</p>
                  </div>
                ) : (
                  helpMessages.map((msg) => {
                    const isEscola = msg.sender_type === "escola";
                    return (
                      <div 
                        key={msg.id}
                        className={`p-3 rounded-xl max-w-[85%] space-y-1 transition-all ${isEscola ? 'bg-zinc-50 text-zinc-800 border border-zinc-100 ml-auto' : 'bg-emerald-500/5 text-emerald-800 border border-emerald-500/10'}`}
                      >
                        <div className="flex items-center justify-between gap-4">
                          <span className={`text-[9px] font-bold uppercase tracking-wider ${isEscola ? 'text-zinc-500' : 'text-emerald-700'}`}>
                            {msg.sender_name} {isEscola ? "(Escola)" : "(KLASSE)"}
                          </span>
                          <span className="text-[8px] text-zinc-400 font-medium font-mono">
                            {format(new Date(msg.created_at), "HH:mm")}
                          </span>
                        </div>
                        <p className="text-xs leading-relaxed font-medium whitespace-pre-wrap">{msg.message}</p>
                        {msg.step_code && (
                          <div className="inline-flex items-center px-1 py-0.5 rounded bg-zinc-200/50 text-zinc-500 text-[8px] font-bold uppercase tracking-wider">
                            Ref: {getStepMeta(msg.step_code, "escola").short}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Doubt Input Form */}
              <form onSubmit={handleDoubtSubmit} className="space-y-3 pt-3 border-t border-zinc-100">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-[9px] font-bold uppercase tracking-wider text-zinc-400">O seu Nome / Cargo</label>
                    <input 
                      type="text"
                      placeholder="Ex: Diretor Manuel"
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-zinc-200 rounded-lg text-xs font-semibold outline-none focus:border-zinc-300 focus:ring-4 focus:ring-zinc-100"
                    />
                  </div>
                  {selectedStep && (
                    <div className="space-y-1">
                      <label className="block text-[9px] font-bold uppercase tracking-wider text-zinc-400">Etapa Referente (Opcional)</label>
                      <div className="px-3 py-1.5 bg-zinc-50 border border-zinc-200/40 rounded-lg text-xs font-semibold text-zinc-600">
                        {getStepMeta(selectedStep, "escola").short}
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="block text-[9px] font-bold uppercase tracking-wider text-zinc-400">Dúvida ou Mensagem</label>
                  <textarea
                    placeholder="Descreva a sua dúvida com o preenchimento ou envio de documentos..."
                    rows={3}
                    value={newDoubtText}
                    onChange={(e) => setNewDoubtText(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-xs font-semibold outline-none focus:border-zinc-300 focus:ring-4 focus:ring-zinc-100 resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submittingDoubt || !senderName.trim() || !newDoubtText.trim()}
                  className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-[10px] uppercase tracking-wider py-2.5 rounded-lg flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed border-none shadow-sm transition-all"
                >
                  {submittingDoubt ? (
                    <>
                      <RefreshCw size={12} className="animate-spin" />
                      ENVIANDO...
                    </>
                  ) : (
                    <>
                      <Send size={12} />
                      ENVIAR MENSAGEM
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
          
          {/* Side Panels - Upload Widget & History */}
          <div className="space-y-6">
            {/* Card do Consultor de Implantação e Canais de Suporte */}
            <div className="bg-white border border-zinc-200/50 rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-zinc-900 text-white flex items-center justify-center font-bold text-sm">
                  EG
                </div>
                <div>
                  <h4 className="font-bold text-zinc-900 text-xs">Consultor de Implantação</h4>
                  <p className="text-[10px] text-zinc-500 font-semibold mt-0.5">Dr. Edson Gundja · KLASSE Success</p>
                </div>
              </div>
              
              <div className="space-y-2 pt-1 border-t border-zinc-100">
                <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">Canais Rápidos de Suporte</p>
                <div className="grid grid-cols-2 gap-2">
                  <a
                    href="https://wa.me/244923000000?text=Olá,%20preciso%20de%20ajuda%20com%20o%20onboarding%20da%20minha%20escola."
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-1.5 p-2 rounded-lg bg-emerald-50 hover:bg-emerald-100/70 border border-emerald-100 transition-all text-[11px] font-bold text-emerald-700 no-underline"
                  >
                    <MessageSquare size={13} />
                    WhatsApp
                  </a>
                  <a
                    href="mailto:onboarding@klasse.ao"
                    className="flex items-center justify-center gap-1.5 p-2 rounded-lg bg-zinc-50 hover:bg-zinc-100/80 border border-zinc-200/40 transition-all text-[11px] font-bold text-zinc-700 no-underline"
                  >
                    <Mail size={13} />
                    Email
                  </a>
                </div>
              </div>

              {/* Dynamic POP Contextual Guidance */}
              {selectedStep && (
                <div className="pt-2 border-t border-zinc-100 space-y-2">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">Guia Prático da Etapa</p>
                  {selectedStep === "docs_legais" ? (
                    <div className="p-2.5 rounded bg-zinc-50 border border-zinc-200/40 space-y-1">
                      <p className="text-[10px] font-bold text-zinc-700 flex items-center gap-1">
                        <FileText size={12} className="text-zinc-500" />
                        Documentação Exigida
                      </p>
                      <p className="text-[9px] text-zinc-400 leading-normal font-medium">Prepare e digitalize: Alvará escolar ou autorização provisória, certidão do NIF e cópia do BI do diretor geral.</p>
                    </div>
                  ) : selectedStep === "planilhas" ? (
                    <div className="p-2.5 rounded bg-zinc-50 border border-zinc-200/40 space-y-1">
                      <p className="text-[10px] font-bold text-zinc-700 flex items-center gap-1">
                        <FileText size={12} className="text-zinc-500" />
                        Preenchimento de Planilhas
                      </p>
                      <p className="text-[9px] text-zinc-400 leading-normal font-medium">Use os modelos para alunos e professores. Ignore as 3 linhas superiores de instrução ao importar. Valide dados obrigatórios como Nome e Gênero.</p>
                    </div>
                  ) : (
                    <div className="p-2.5 rounded bg-zinc-50 border border-zinc-200/40 space-y-1">
                      <p className="text-[10px] font-bold text-zinc-700 flex items-center gap-1">
                        <Info size={12} className="text-zinc-500" />
                        Processo em Andamento
                      </p>
                      <p className="text-[9px] text-zinc-400 leading-normal font-medium">Aguarde o processamento ou utilize o chat de dúvidas ao lado para esclarecer pendências operacionais.</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {isEditingErrors ? (
              /* Grid Interativo de Correção */
              <div className="bg-white border border-rose-200 rounded-xl p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-rose-900 text-sm">Corrigir Linhas Inválidas</h3>
                    <p className="text-xs text-rose-500 leading-relaxed">
                      Detectamos dados inválidos. Edite as células abaixo para corrigir.
                    </p>
                  </div>
                  <button 
                    type="button"
                    onClick={() => {
                      setIsEditingErrors(false);
                      setInvalidRows([]);
                      setStagedRows([]);
                      setValidationErrors([]);
                      setSelectedFile(null);
                      const fileInput = document.getElementById("fileInput") as HTMLInputElement;
                      if (fileInput) fileInput.value = "";
                    }}
                    className="text-xs font-semibold text-zinc-500 hover:text-zinc-700 bg-none border-none cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>

                <div className="overflow-x-auto max-h-[300px] border border-rose-100 rounded-lg">
                  <table className="w-full text-[11px] text-left border-collapse">
                    <thead className="bg-rose-50/50 sticky top-0 text-rose-900 text-[9px] font-bold uppercase tracking-wider border-b border-rose-100">
                      <tr>
                        <th className="p-2 w-12 text-center">Linha</th>
                        <th className="p-2 min-w-[150px]">Nome Completo</th>
                        <th className="p-2 w-16">Gênero</th>
                        <th className="p-2 w-28">Nascimento</th>
                        {isAlunosStaged ? (
                          <th className="p-2 w-24">Turma</th>
                        ) : (
                          <>
                            <th className="p-2 w-24">Telefone</th>
                            <th className="p-2 w-28">Email</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-rose-100 bg-white">
                      {invalidRows.map((row, rIdx) => (
                        <tr key={row._rowNum} className="hover:bg-rose-50/10">
                          <td className="p-2 text-center text-rose-700 font-mono font-bold bg-rose-50/20">{row._rowNum}</td>
                          
                          {/* Nome Completo */}
                          <td className="p-1">
                            <input 
                              type="text" 
                              value={row["NOME_COMPLETO"] || ""} 
                              onChange={(e) => handleCellChange(rIdx, "NOME_COMPLETO", e.target.value)}
                              className={`w-full px-1.5 py-1 border rounded text-[11px] outline-none ${row._errors?.["NOME_COMPLETO"] ? 'border-rose-400 bg-rose-50/70 focus:border-rose-600' : 'border-zinc-200 focus:border-emerald-500'}`}
                              title={row._errors?.["NOME_COMPLETO"]}
                            />
                          </td>

                          {/* Gênero */}
                          <td className="p-1">
                            <select 
                              value={row["GENERO"] || ""} 
                              onChange={(e) => handleCellChange(rIdx, "GENERO", e.target.value)}
                              className={`w-full px-1 py-1 border rounded text-[11px] outline-none bg-white ${row._errors?.["GENERO"] ? 'border-rose-400 bg-rose-50/70 focus:border-rose-600' : 'border-zinc-200 focus:border-emerald-500'}`}
                              title={row._errors?.["GENERO"]}
                            >
                              <option value="">Selecione</option>
                              <option value="M">M</option>
                              <option value="F">F</option>
                            </select>
                          </td>

                          {/* Data Nascimento */}
                          <td className="p-1">
                            <input 
                              type="text" 
                              value={row["DATA_NASCIMENTO"] || ""} 
                              onChange={(e) => handleCellChange(rIdx, "DATA_NASCIMENTO", e.target.value)}
                              className={`w-full px-1.5 py-1 border rounded text-[11px] outline-none ${row._errors?.["DATA_NASCIMENTO"] ? 'border-rose-400 bg-rose-50/70 focus:border-rose-600' : 'border-zinc-200 focus:border-emerald-500'}`}
                              placeholder="DD/MM/AAAA"
                              title={row._errors?.["DATA_NASCIMENTO"]}
                            />
                          </td>

                          {isAlunosStaged ? (
                            /* Turma Código */
                            <td className="p-1">
                              <input 
                                type="text" 
                                value={row["TURMA_CODIGO"] || ""} 
                                onChange={(e) => handleCellChange(rIdx, "TURMA_CODIGO", e.target.value)}
                                className={`w-full px-1.5 py-1 border rounded text-[11px] outline-none ${row._errors?.["TURMA_CODIGO"] ? 'border-rose-400 bg-rose-50/70 focus:border-rose-600' : 'border-zinc-200 focus:border-emerald-500'}`}
                                title={row._errors?.["TURMA_CODIGO"]}
                              />
                            </td>
                          ) : (
                            /* Professor: Telefone, Email */
                            <>
                              <td className="p-1">
                                <input 
                                  type="text" 
                                  value={row["TELEFONE"] || ""} 
                                  onChange={(e) => handleCellChange(rIdx, "TELEFONE", e.target.value)}
                                  className="w-full px-1.5 py-1 border border-zinc-200 rounded text-[11px] outline-none focus:border-emerald-500"
                                />
                              </td>
                              <td className="p-1">
                                <input 
                                  type="text" 
                                  value={row["EMAIL"] || ""} 
                                  onChange={(e) => handleCellChange(rIdx, "EMAIL", e.target.value)}
                                  className={`w-full px-1.5 py-1 border rounded text-[11px] outline-none ${row._errors?.["EMAIL"] ? 'border-rose-400 bg-rose-50/70 focus:border-rose-600' : 'border-zinc-200 focus:border-emerald-500'}`}
                                  title={row._errors?.["EMAIL"]}
                                />
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {validationErrors.length > 0 && (
                  <div className="rounded-lg border border-rose-200 bg-rose-500/5 p-3 space-y-1">
                    <div className="flex items-center gap-1.5 text-rose-700 font-bold text-[10px]">
                      <AlertCircle size={12} />
                      <span>Mensagens de erro:</span>
                    </div>
                    <ul className="list-disc pl-3 text-[9px] text-rose-600 font-medium space-y-0.5 max-h-[80px] overflow-y-auto font-mono">
                      {validationErrors.map((err, idx) => (
                        <li key={idx}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleRevalidateAndUpload}
                  disabled={uploading}
                  className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] uppercase tracking-wider py-2.5 rounded-lg flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed border-none shadow-sm transition-all"
                >
                  {uploading ? (
                    <>
                      <RefreshCw size={12} className="animate-spin" />
                      ENVIANDO...
                    </>
                  ) : (
                    <>
                      <Check size={12} />
                      REVALIDAR E ENVIAR
                    </>
                  )}
                </button>
              </div>
            ) : request?.status === "activo" && operationalReadiness ? (
              /* Card de Estatísticas do Setup */
              <div className="bg-white border border-zinc-200/50 rounded-xl p-5 shadow-sm space-y-4">
                <div className="space-y-1">
                  <h3 className="font-bold text-zinc-900 text-sm">Resumo da Escola</h3>
                  <p className="text-xs text-zinc-500 leading-relaxed">
                    Estatísticas de carregamento de dados do ano letivo de {operationalReadiness.ano_letivo || "ativos"}.
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-100 text-center">
                    <span className="block text-lg font-black text-zinc-800">{operationalReadiness.metrics?.cursos_count ?? 0}</span>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">Cursos</span>
                  </div>
                  <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-100 text-center">
                    <span className="block text-lg font-black text-zinc-800">{operationalReadiness.metrics?.turmas_count ?? 0}</span>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">Turmas</span>
                  </div>
                  <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-100 text-center">
                    <span className="block text-lg font-black text-zinc-800">{operationalReadiness.metrics?.professores_count ?? 0}</span>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">Professores</span>
                  </div>
                  <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-100 text-center">
                    <span className="block text-lg font-black text-zinc-800">{operationalReadiness.metrics?.periodos_count ?? 0}</span>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">Períodos</span>
                  </div>
                </div>

                <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-3.5 text-center">
                  <p className="text-[11px] font-semibold text-blue-800 leading-relaxed">
                    O setup inicial foi concluído no portal. Acesse o painel escolar para gerenciar alunos e notas.
                  </p>
                </div>
              </div>
            ) : (
              /* Upload Widget Normal */
              <div className="bg-white border border-zinc-200/50 rounded-xl p-5 shadow-sm space-y-4">
                <div className="space-y-1">
                  <h3 className="font-bold text-zinc-900 text-sm">Enviar Pendências</h3>
                  <p className="text-xs text-zinc-500 leading-relaxed">Envie apenas documentos das fases da escola: documentos legais e planilhas operacionais.</p>
                </div>
                {nextSchoolStep ? (
                  <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-[11px] leading-relaxed text-blue-800">
                    <span className="font-semibold">O que falta agora:</span> {nextSchoolStep.title}. Esta etapa está com a escola.
                  </div>
                ) : (
                  <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-[11px] leading-relaxed text-zinc-600">
                    Neste momento não há uma ação documental pendente para a escola. Acompanhe a timeline acima para ver em que fase o onboarding está.
                  </div>
                )}
                
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
                    <p className="text-[9px] text-zinc-400 mt-1">PDF, imagem, Excel (.xlsx/.xls) ou CSV até 10MB</p>
                  </div>

                  <div className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-[10px] leading-relaxed text-amber-800">
                    Para planilhas, damos preferência a Excel (.xlsx) ou aos modelos oficiais CSV. Antes do envio, o portal valida colunas e erros básicos para evitar retrabalho.
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
                        ENVIAR DOCUMENTO
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
                      <p className="text-[9px] text-rose-500 font-semibold">Corrija os pontos acima e tente novamente. Pode usar Excel (.xlsx) se preferir evitar problemas de CSV.</p>
                    </div>
                  )}
                </form>
              </div>
            )}
            
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
