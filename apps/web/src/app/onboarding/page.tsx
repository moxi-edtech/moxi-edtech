"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { 
  School, 
  GraduationCap, 
  CreditCard, 
  Users, 
  XCircle, 
  RefreshCw 
} from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface ClasseConfig {
  id: string;
  nome: string;
  nivel: "EP" | "ESG";
  activa: boolean;
  propina: number;
}

interface UtilizadorExtra {
  id: number;
  nome: string;
  email: string;
  papel: string;
}

interface FormData {
  // Passo 1 — Escola
  escola_nome: string;
  escola_nif: string;
  escola_abrev: string;
  escola_codigo: string;
  escola_morada: string;
  escola_municipio: string;
  escola_provincia: string;
  escola_tel: string;
  escola_email: string;
  director_nome: string;
  director_tel: string;
  ano_letivo: string;
  // Passo 2 — Classes
  classes: ClasseConfig[];
  // Passo 3 — Turnos & Turmas
  turnos: string[];
  turmas: Record<string, Record<string, number>>;
  total_alunos: string;
  media_turma: string;
  // Passo 4 — Utilizadores
  utilizadores: {
    principal: { nome: string; tel: string; nivel_exp: string };
    outros: UtilizadorExtra[];
  };
  // Passo 5 — Financeiro
  financeiro: {
    data_inicio: string;
    dia_vencimento: string;
    mes_inicio: string;
    mes_fim: string;
    metodos: string[];
    dados_bancarios: string;
    observacoes: string;
  };
}

// ─── Constantes ───────────────────────────────────────────────────────────────
const CLASSES_INICIAL: ClasseConfig[] = [
  { id: "ini", nome: "Iniciação", nivel: "EP", activa: true, propina: 0 },
  { id: "1",   nome: "1ª Classe", nivel: "EP", activa: true, propina: 0 },
  { id: "2",   nome: "2ª Classe", nivel: "EP", activa: true, propina: 0 },
  { id: "3",   nome: "3ª Classe", nivel: "EP", activa: true, propina: 0 },
  { id: "4",   nome: "4ª Classe", nivel: "EP", activa: true, propina: 0 },
  { id: "5",   nome: "5ª Classe", nivel: "EP", activa: true, propina: 0 },
  { id: "6",   nome: "6ª Classe", nivel: "EP", activa: true, propina: 0 },
  { id: "7",   nome: "7ª Classe", nivel: "ESG", activa: true, propina: 0 },
  { id: "8",   nome: "8ª Classe", nivel: "ESG", activa: true, propina: 0 },
  { id: "9",   nome: "9ª Classe", nivel: "ESG", activa: true, propina: 0 },
];

const MUNICIPIOS = [
  "Belas","Cazenga","Icolo e Bengo","Kilamba Kiaxi","Luanda",
  "Maianga","Mumbwa","Quissama","Rangel","Talatona","Viana","Outro",
];

const METODOS = [
  { id: "cash",     label: "Dinheiro / Cash",      icon: "💵" },
  { id: "tpa",      label: "TPA / Cartão",          icon: "💳" },
  { id: "transfer", label: "Transferência Bancária", icon: "🏦" },
  { id: "mcx",      label: "Multicaixa Express",    icon: "📱" },
];

const PAPEIS = [
  { value: "secretaria", label: "Secretária(o)" },
  { value: "financeiro", label: "Financeiro" },
  { value: "professor",  label: "Professor(a)" },
  { value: "admin",      label: "Administrador(a)" },
];

const FORM_INICIAL: FormData = {
  escola_nome: "", escola_nif: "", escola_abrev: "", escola_codigo: "",
  escola_morada: "", escola_municipio: "", escola_provincia: "Luanda",
  escola_tel: "", escola_email: "",
  director_nome: "", director_tel: "",
  ano_letivo: "2026",
  classes: CLASSES_INICIAL,
  turnos: ["M"],
  turmas: { M: {} },
  total_alunos: "", media_turma: "",
  utilizadores: {
    principal: { nome: "", tel: "", nivel_exp: "" },
    outros: [],
  },
  financeiro: {
    data_inicio: "", dia_vencimento: "", mes_inicio: "",
    mes_fim: "", metodos: ["cash", "transfer"],
    dados_bancarios: "", observacoes: "",
  },
};

const TOTAL_PASSOS = 6;

// ─── Componentes auxiliares ───────────────────────────────────────────────────
function Label({ children, required, optional }: {
  children: React.ReactNode; required?: boolean; optional?: boolean;
}) {
  return (
    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
      {children}
      {required && <span className="text-red-500 ml-1">*</span>}
      {optional && <span className="text-slate-400 font-normal normal-case tracking-normal ml-1">(opcional)</span>}
    </label>
  );
}

function Input({ className = "", ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-800 
        bg-white outline-none transition-all
        focus:border-[#1F6B3B] focus:ring-2 focus:ring-[#1F6B3B]/10
        placeholder:text-slate-300 ${className}`}
      {...props}
    />
  );
}

function Select({ className = "", children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-800 
        bg-white outline-none transition-all cursor-pointer appearance-none
        focus:border-[#1F6B3B] focus:ring-2 focus:ring-[#1F6B3B]/10 ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}

function Textarea({ className = "", ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-800 
        bg-white outline-none transition-all resize-y min-h-[80px] leading-relaxed
        focus:border-[#1F6B3B] focus:ring-2 focus:ring-[#1F6B3B]/10
        placeholder:text-slate-300 ${className}`}
      {...props}
    />
  );
}

function Hint({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <p className={`text-xs text-slate-400 mt-1.5 leading-relaxed ${className}`}>{children}</p>;
}

function InfoBox({ children, variant = "gold" }: { children: React.ReactNode; variant?: "gold" | "green" }) {
  const styles = {
    gold:  "bg-amber-50 border-amber-200 text-amber-800",
    green: "bg-emerald-50 border-emerald-200 text-emerald-800",
  };
  return (
    <div className={`flex gap-3 p-4 rounded-xl border text-sm leading-relaxed mb-6 ${styles[variant]}`}>
      <span className="text-base flex-shrink-0 mt-0.5">{variant === "gold" ? "💡" : "✓"}</span>
      <span>{children}</span>
    </div>
  );
}

function SectionSep({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 my-8">
      <span className="text-xs font-bold uppercase tracking-widest text-slate-400">{children}</span>
      <div className="flex-1 h-px bg-slate-100" />
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();

  const [passo, setPasso]       = useState(1);
  const [form, setForm]         = useState<FormData>(FORM_INICIAL);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone]         = useState(false);
  const [erro, setErro]         = useState<string | null>(null);

  // ── Helpers ──────────────────────────────────────────────────────────────
  const update = (field: keyof FormData, value: unknown) =>
    setForm(f => ({ ...f, [field]: value }));

  const updateFin = (field: keyof FormData["financeiro"], value: unknown) =>
    setForm(f => ({ ...f, financeiro: { ...f.financeiro, [field]: value } }));

  const updateUtil = (field: keyof FormData["utilizadores"]["principal"], value: string) =>
    setForm(f => ({
      ...f,
      utilizadores: {
        ...f.utilizadores,
        principal: { ...f.utilizadores.principal, [field]: value },
      },
    }));

  const classesActivas = form.classes.filter(c => c.activa);

  // ── Classes ──────────────────────────────────────────────────────────────
  function toggleClasse(id: string) {
    setForm(f => ({
      ...f,
      classes: f.classes.map(c => c.id === id ? { ...c, activa: !c.activa } : c),
    }));
  }

  function updatePropina(id: string, valor: number) {
    setForm(f => ({
      ...f,
      classes: f.classes.map(c => c.id === id ? { ...c, propina: valor } : c),
    }));
  }

  // ── Turnos ───────────────────────────────────────────────────────────────
  function toggleTurno(code: string) {
    setForm(f => {
      const jaActivo = f.turnos.includes(code);
      const novos    = jaActivo ? f.turnos.filter(t => t !== code) : [...f.turnos, code];
      const novasTurmas = { ...f.turmas };
      if (jaActivo) delete novasTurmas[code];
      else novasTurmas[code] = {};
      return { ...f, turnos: novos, turmas: novasTurmas };
    });
  }

  function updateTurmasCount(turno: string, classeId: string, count: number) {
    setForm(f => ({
      ...f,
      turmas: {
        ...f.turmas,
        [turno]: { ...f.turmas[turno], [classeId]: count },
      },
    }));
  }

  // ── Utilizadores extras ──────────────────────────────────────────────────
  function addUser() {
    const novoId = Date.now();
    setForm(f => ({
      ...f,
      utilizadores: {
        ...f.utilizadores,
        outros: [...f.utilizadores.outros, { id: novoId, nome: "", email: "", papel: "" }],
      },
    }));
  }

  function removeUser(id: number) {
    setForm(f => ({
      ...f,
      utilizadores: {
        ...f.utilizadores,
        outros: f.utilizadores.outros.filter(u => u.id !== id),
      },
    }));
  }

  function updateUser(id: number, field: keyof UtilizadorExtra, value: string) {
    setForm(f => ({
      ...f,
      utilizadores: {
        ...f.utilizadores,
        outros: f.utilizadores.outros.map(u => u.id === id ? { ...u, [field]: value } : u),
      },
    }));
  }

  // ── Métodos de pagamento ─────────────────────────────────────────────────
  function toggleMetodo(id: string) {
    const actuais = form.financeiro.metodos;
    const novos   = actuais.includes(id) ? actuais.filter(m => m !== id) : [...actuais, id];
    updateFin("metodos", novos);
  }

  // ── Navegação ────────────────────────────────────────────────────────────
  function avancar() { if (passo < TOTAL_PASSOS) setPasso(p => p + 1); }
  function recuar()  { if (passo > 1) setPasso(p => p - 1); }
  const progresso = Math.round((passo / TOTAL_PASSOS) * 100);

  // ── Submit ───────────────────────────────────────────────────────────────
  async function submeter() {
    setSubmitting(true);
    setErro(null);

    const { error } = await supabase.from("onboarding_requests").insert({
      escola_nome:      form.escola_nome,
      escola_nif:       form.escola_nif,
      escola_abrev:     form.escola_abrev,
      escola_codigo:    form.escola_codigo,
      escola_morada:    form.escola_morada,
      escola_municipio: form.escola_municipio,
      escola_provincia: form.escola_provincia,
      escola_tel:       form.escola_tel,
      escola_email:     form.escola_email,
      director_nome:    form.director_nome,
      director_tel:     form.director_tel,
      ano_letivo:       form.ano_letivo,
      classes:          form.classes as any,
      turnos:           form.turnos as any,
      turmas:           form.turmas as any,
      financeiro: {
        ...form.financeiro,
        total_alunos: form.total_alunos,
        media_turma:  form.media_turma,
      } as any,
      utilizadores: form.utilizadores as any,
      status: "pendente",
    } as any);

    setSubmitting(false);

    if (error) {
      setErro("Ocorreu um erro ao enviar. Tente novamente ou contacte o suporte.");
      console.error(error);
      return;
    }

    setDone(true);
  }

  // ── Página de confirmação ─────────────────────────────────────────────────
  if (done) {
    return (
      <div className="min-h-screen bg-[#F8FAF9] flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 rounded-full bg-[#E8F5EE] flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl text-[#1F6B3B]">✓</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-3">
            Pedido recebido!
          </h1>
          <p className="text-slate-500 leading-relaxed mb-8">
            Recebemos os dados de <strong className="text-slate-700">{form.escola_nome}</strong>.
            A equipa KLASSE vai entrar em contacto em breve para confirmar a configuração.
          </p>
          <div className="bg-white border border-slate-100 rounded-xl p-5 text-left text-sm text-slate-600 leading-relaxed">
            <p className="font-semibold text-slate-700 mb-2">Próximos passos</p>
            <ol className="list-decimal list-inside space-y-1.5">
              <li>A equipa KLASSE revê os dados submetidos</li>
              <li>Contactamos o director(a) para confirmar</li>
              <li>Configuramos a escola no sistema</li>
              <li>Agendamos a sessão de formação</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  // ── Render principal ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F8FAF9] flex flex-col">

      {/* Header */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <span className="font-bold text-[#1F6B3B] text-lg">KLASSE.</span>
            <span className="text-slate-400 text-sm ml-2">Configuração de Escola</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-32 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#1F6B3B] rounded-full transition-all duration-500"
                style={{ width: `${progresso}%` }}
              />
            </div>
            <span className="text-xs text-slate-400 whitespace-nowrap">
              {passo} / {TOTAL_PASSOS}
            </span>
          </div>
        </div>
      </header>

      {/* Stepper */}
      <div className="bg-white border-b border-slate-100">
        <div className="max-w-2xl mx-auto px-6 py-3">
          <div className="flex gap-1">
            {[
              "Escola", "Classes", "Turnos", "Utilizadores", "Financeiro", "Resumo"
            ].map((label, i) => {
              const n = i + 1;
              const estado = n < passo ? "done" : n === passo ? "active" : "idle";
              return (
                <button
                  key={n}
                  onClick={() => n < passo && setPasso(n)}
                  className={`flex-1 text-center py-1.5 text-xs font-semibold rounded-md transition-all
                    ${estado === "active" ? "bg-[#E8F5EE] text-[#1F6B3B]" : ""}
                    ${estado === "done"   ? "text-[#1F6B3B] cursor-pointer hover:bg-[#E8F5EE]" : ""}
                    ${estado === "idle"   ? "text-slate-300 cursor-default" : ""}
                  `}
                >
                  {estado === "done" ? "✓ " : `${n}. `}{label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Conteúdo */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-10">

        {/* ═══ PASSO 1 — ESCOLA ════════════════════════════════════════════ */}
        {passo === 1 && (
          <div className="animate-klasse-fade-up">
            <div className="mb-8">
              <p className="text-xs font-bold uppercase tracking-widest text-[#1F6B3B] mb-2">Passo 1</p>
              <h1 className="text-3xl font-bold text-slate-800 tracking-tight mb-2">Dados da Escola</h1>
              <p className="text-slate-500 text-sm leading-relaxed">
                Informações institucionais básicas. Estes dados aparecem nos documentos oficiais emitidos.
              </p>
            </div>

            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label required>Nome Oficial da Escola</Label>
                  <Input
                    value={form.escola_nome}
                    onChange={e => update("escola_nome", e.target.value)}
                    placeholder="Ex: Colégio Nossa Senhora da Paz"
                  />
                </div>
                <div>
                  <Label required>NIF da Instituição</Label>
                  <Input
                    value={form.escola_nif}
                    onChange={e => update("escola_nif", e.target.value.replace(/\D/g, '').slice(0, 9))}
                    placeholder="9 dígitos obrigatórios"
                    maxLength={9}
                  />
                </div>
              </div>
              <Hint className="-mt-3">Nomes e NIF devem corresponder ao alvará oficial.</Hint>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label optional>Abreviatura</Label>
                  <Input
                    value={form.escola_abrev}
                    onChange={e => update("escola_abrev", e.target.value)}
                    placeholder="Ex: CNSP"
                  />
                </div>
                <div>
                  <Label optional>Código Interno</Label>
                  <Input
                    value={form.escola_codigo}
                    onChange={e => update("escola_codigo", e.target.value)}
                    placeholder="Ex: CNSP-LDA"
                  />
                </div>
              </div>

              <div>
                <Label required>Morada Completa</Label>
                <Input
                  value={form.escola_morada}
                  onChange={e => update("escola_morada", e.target.value)}
                  placeholder="Ex: Rua da Liberdade, nº 45, Rangel, Luanda"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label required>Município</Label>
                  <Select
                    value={form.escola_municipio}
                    onChange={e => update("escola_municipio", e.target.value)}
                  >
                    <option value="">Seleccionar...</option>
                    {MUNICIPIOS.map(m => <option key={m}>{m}</option>)}
                  </Select>
                </div>
                <div>
                  <Label>Província</Label>
                  <Input
                    value={form.escola_provincia}
                    onChange={e => update("escola_provincia", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label required>Telefone Principal</Label>
                  <Input
                    value={form.escola_tel}
                    onChange={e => update("escola_tel", e.target.value)}
                    placeholder="923 456 789"
                    type="tel"
                  />
                </div>
                <div>
                  <Label optional>Email Institucional</Label>
                  <Input
                    value={form.escola_email}
                    onChange={e => update("escola_email", e.target.value)}
                    placeholder="escola@email.com"
                    type="email"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label required>Nome do Director(a)</Label>
                  <Input
                    value={form.director_nome}
                    onChange={e => update("director_nome", e.target.value)}
                    placeholder="Nome completo"
                  />
                </div>
                <div>
                  <Label optional>Contacto do Director(a)</Label>
                  <Input
                    value={form.director_tel}
                    onChange={e => update("director_tel", e.target.value)}
                    placeholder="923 000 000"
                    type="tel"
                  />
                </div>
              </div>

              <div>
                <Label required>Ano Lectivo</Label>
                <Select value={form.ano_letivo} onChange={e => update("ano_letivo", e.target.value)}>
                  <option value="2026">2026</option>
                  <option value="2025">2025</option>
                </Select>
              </div>
            </div>
          </div>
        )}

        {/* ═══ PASSO 2 — CLASSES & PROPINAS ════════════════════════════════ */}
        {passo === 2 && (
          <div className="animate-klasse-fade-up">
            <div className="mb-8">
              <p className="text-xs font-bold uppercase tracking-widest text-[#1F6B3B] mb-2">Passo 2</p>
              <h1 className="text-3xl font-bold text-slate-800 tracking-tight mb-2">Classes & Propinas</h1>
              <p className="text-slate-500 text-sm leading-relaxed">
                Active as classes que a escola tem e defina o valor mensal de propina para cada uma.
              </p>
            </div>

            <InfoBox>
              Active só as classes que esta escola tem. O valor de propina é o que cada aluno paga{" "}
              <strong>por mês</strong>. Isenções e casos especiais gerem-se individualmente no sistema depois.
            </InfoBox>

            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
              {/* Header */}
              <div className="grid grid-cols-[1fr_auto_130px_56px] bg-slate-50 px-4 py-2.5 border-b border-slate-200">
                {["Classe", "Nível", "Propina/mês (Kz)", "Activa"].map(h => (
                  <span key={h} className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{h}</span>
                ))}
              </div>

              {form.classes.map((cls, i) => (
                <div
                  key={cls.id}
                  className={`grid grid-cols-[1fr_auto_130px_56px] items-center px-4 py-3 gap-3
                    ${i < form.classes.length - 1 ? "border-b border-slate-100" : ""}
                    ${!cls.activa ? "opacity-40" : ""}
                    transition-opacity`}
                >
                  <span className="text-sm font-semibold text-slate-700">{cls.nome}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full
                    ${cls.nivel === "EP"
                      ? "bg-blue-50 text-blue-600"
                      : "bg-green-50 text-green-700"}`}>
                    {cls.nivel}
                  </span>
                  <input
                    type="number"
                    min={0}
                    step={500}
                    disabled={!cls.activa}
                    value={cls.propina || ""}
                    onChange={e => updatePropina(cls.id, Number(e.target.value))}
                    placeholder="0"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm text-right font-mono
                      outline-none focus:border-[#1F6B3B] focus:ring-2 focus:ring-[#1F6B3B]/10
                      disabled:bg-slate-50 disabled:cursor-not-allowed"
                  />
                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={() => toggleClasse(cls.id)}
                      className={`w-10 h-6 rounded-full transition-all relative
                        ${cls.activa ? "bg-[#1F6B3B]" : "bg-slate-200"}`}
                    >
                      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all
                        ${cls.activa ? "left-[18px]" : "left-0.5"}`} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ PASSO 3 — TURNOS & TURMAS ═══════════════════════════════════ */}
        {passo === 3 && (
          <div className="animate-klasse-fade-up">
            <div className="mb-8">
              <p className="text-xs font-bold uppercase tracking-widest text-[#1F6B3B] mb-2">Passo 3</p>
              <h1 className="text-3xl font-bold text-slate-800 tracking-tight mb-2">Turnos & Turmas</h1>
              <p className="text-slate-500 text-sm leading-relaxed">
                Em que turnos funciona a escola e quantas turmas existem por classe?
              </p>
            </div>

            <SectionSep>Turnos em funcionamento</SectionSep>

            <div className="grid grid-cols-3 gap-3 mb-8">
              {[
                { code: "M", label: "Manhã",  icon: "🌅" },
                { code: "T", label: "Tarde",  icon: "☀️" },
                { code: "N", label: "Noite",  icon: "🌙" },
              ].map(t => {
                const activo = form.turnos.includes(t.code);
                return (
                  <button
                    key={t.code}
                    type="button"
                    onClick={() => toggleTurno(t.code)}
                    className={`p-4 rounded-xl border-2 text-center transition-all
                      ${activo
                        ? "border-[#1F6B3B] bg-[#E8F5EE]"
                        : "border-slate-200 bg-white hover:border-slate-300"}`}
                  >
                    <div className="text-2xl mb-1">{t.icon}</div>
                    <div className={`text-xl font-bold ${activo ? "text-[#1F6B3B]" : "text-slate-700"}`}>
                      {t.code}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">{t.label}</div>
                  </button>
                );
              })}
            </div>

            <SectionSep>Turmas por classe</SectionSep>

            <InfoBox>
              Indique quantas turmas existem por classe em cada turno activo. O sistema gera os
              códigos automaticamente — ex: <code className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded text-xs font-mono">EP-1-M-A</code>,{" "}
              <code className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded text-xs font-mono">EP-1-M-B</code>, etc.
            </InfoBox>

            {form.turnos.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-8">
                Seleccione pelo menos um turno acima.
              </p>
            )}

            {form.turnos.map(turno => {
              const nomes: Record<string, string> = { M: "Manhã", T: "Tarde", N: "Noite" };
              return (
                <div key={turno} className="mb-6">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                    Turno {nomes[turno]} ({turno})
                  </p>
                  <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
                    {classesActivas.map((cls, i) => (
                      <div
                        key={cls.id}
                        className={`flex items-center justify-between px-4 py-3
                          ${i < classesActivas.length - 1 ? "border-b border-slate-100" : ""}`}
                      >
                        <span className="text-sm font-medium text-slate-700">{cls.nome}</span>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            max={10}
                            value={form.turmas[turno]?.[cls.id] ?? 1}
                            onChange={e =>
                              updateTurmasCount(turno, cls.id, Number(e.target.value))
                            }
                            className="w-16 px-2 py-1.5 border border-slate-200 rounded-lg text-sm
                              text-center outline-none focus:border-[#1F6B3B] focus:ring-2 focus:ring-[#1F6B3B]/10"
                          />
                          <span className="text-xs text-slate-400">turma(s)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            <div className="grid grid-cols-2 gap-4 mt-6">
              <div>
                <Label optional>Total estimado de alunos</Label>
                <Input
                  type="number"
                  value={form.total_alunos}
                  onChange={e => update("total_alunos", e.target.value)}
                  placeholder="Ex: 580"
                />
              </div>
              <div>
                <Label optional>Média de alunos por turma</Label>
                <Input
                  type="number"
                  value={form.media_turma}
                  onChange={e => update("media_turma", e.target.value)}
                  placeholder="Ex: 35"
                />
              </div>
            </div>
          </div>
        )}

        {/* ═══ PASSO 4 — UTILIZADORES ══════════════════════════════════════ */}
        {passo === 4 && (
          <div className="animate-klasse-fade-up">
            <div className="mb-8">
              <p className="text-xs font-bold uppercase tracking-widest text-[#1F6B3B] mb-2">Passo 4</p>
              <h1 className="text-3xl font-bold text-slate-800 tracking-tight mb-2">Utilizadores</h1>
              <p className="text-slate-500 text-sm leading-relaxed">
                Quem vai ter acesso ao KLASSE? Cada pessoa tem o seu próprio login e portal.
              </p>
            </div>

            <InfoBox variant="green">
              O director já tem acesso garantido. Adicione aqui a secretaria e outros funcionários
              que vão usar o sistema no dia-a-dia.
            </InfoBox>

            {/* Outros utilizadores */}
            <div className="space-y-3 mb-4">
              {form.utilizadores.outros.map(u => (
                <div key={u.id} className="grid grid-cols-[1fr_1fr_160px_36px] gap-3 items-center
                  p-4 border border-slate-200 rounded-xl bg-white shadow-sm">
                  <Input
                    value={u.nome}
                    onChange={e => updateUser(u.id, "nome", e.target.value)}
                    placeholder="Nome completo"
                  />
                  <Input
                    value={u.email}
                    onChange={e => updateUser(u.id, "email", e.target.value)}
                    placeholder="email@escola.com"
                    type="email"
                  />
                  <Select
                    value={u.papel}
                    onChange={e => updateUser(u.id, "papel", e.target.value)}
                  >
                    <option value="">Papel...</option>
                    {PAPEIS.map(p => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </Select>
                  <button
                    type="button"
                    onClick={() => removeUser(u.id)}
                    className="w-9 h-9 flex items-center justify-center border border-slate-200
                      rounded-lg text-slate-400 hover:border-red-300 hover:text-red-500
                      hover:bg-red-50 transition-all text-lg"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addUser}
              className="flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-slate-200
                rounded-xl text-sm font-medium text-slate-500 hover:border-[#1F6B3B]
                hover:text-[#1F6B3B] hover:bg-[#E8F5EE] transition-all"
            >
              <span className="text-lg leading-none">+</span> Adicionar utilizador
            </button>

            <SectionSep>Utilizador principal (secretaria)</SectionSep>

            <InfoBox>
              Quem vai usar o sistema <strong>todos os dias</strong>? Esta é a pessoa que vamos
              treinar primeiro e será o nosso contacto principal.
            </InfoBox>

            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label required>Nome do utilizador principal</Label>
                  <Input
                    value={form.utilizadores.principal.nome}
                    onChange={e => updateUtil("nome", e.target.value)}
                    placeholder="Nome completo"
                  />
                </div>
                <div>
                  <Label required>Telefone / WhatsApp</Label>
                  <Input
                    value={form.utilizadores.principal.tel}
                    onChange={e => updateUtil("tel", e.target.value)}
                    placeholder="923 000 000"
                    type="tel"
                  />
                </div>
              </div>

              <div>
                <Label>Experiência com computador</Label>
                <Select
                  value={form.utilizadores.principal.nivel_exp}
                  onChange={e => updateUtil("nivel_exp", e.target.value)}
                >
                  <option value="">Seleccionar...</option>
                  <option value="basico">Básica — usa o telefone, pouco computador</option>
                  <option value="medio">Médio — usa Word, Excel, WhatsApp Web</option>
                  <option value="avancado">Avançado — confortável com sistemas digitais</option>
                </Select>
                <Hint>Ajuda-nos a preparar o treino adequado.</Hint>
              </div>
            </div>
          </div>
        )}

        {/* ═══ PASSO 5 — FINANCEIRO ════════════════════════════════════════ */}
        {passo === 5 && (
          <div className="animate-klasse-fade-up">
            <div className="mb-8">
              <p className="text-xs font-bold uppercase tracking-widest text-[#1F6B3B] mb-2">Passo 5</p>
              <h1 className="text-3xl font-bold text-slate-800 tracking-tight mb-2">Configuração Financeira</h1>
              <p className="text-slate-500 text-sm leading-relaxed">
                Define quando o sistema começa a gerar cobranças e como está estruturado o ano lectivo.
              </p>
            </div>

            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label required>Data de início financeiro</Label>
                  <Input
                    value={form.financeiro.data_inicio}
                    onChange={e => updateFin("data_inicio", e.target.value)}
                    placeholder="Ex: 01/04/2026"
                  />
                  <Hint>A partir desta data o sistema começa a gerar mensalidades.</Hint>
                </div>
                <div>
                  <Label required>Dia de vencimento das propinas</Label>
                  <Select
                    value={form.financeiro.dia_vencimento}
                    onChange={e => updateFin("dia_vencimento", e.target.value)}
                  >
                    <option value="">Seleccionar...</option>
                    {[5, 10, 15, 20, 25].map(d => (
                      <option key={d} value={d}>Dia {d}</option>
                    ))}
                    <option value="ultimo">Último dia do mês</option>
                  </Select>
                  <Hint>Dia a partir do qual a propina é considerada em atraso.</Hint>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Mês de início do ano lectivo</Label>
                  <Select
                    value={form.financeiro.mes_inicio}
                    onChange={e => updateFin("mes_inicio", e.target.value)}
                  >
                    <option value="">Seleccionar...</option>
                    <option value="1">Janeiro</option>
                    <option value="2">Fevereiro</option>
                    <option value="3">Março</option>
                    <option value="4">Abril</option>
                    <option value="9">Setembro</option>
                  </Select>
                </div>
                <div>
                  <Label>Mês de fim do ano lectivo</Label>
                  <Select
                    value={form.financeiro.mes_fim}
                    onChange={e => updateFin("mes_fim", e.target.value)}
                  >
                    <option value="">Seleccionar...</option>
                    <option value="10">Outubro</option>
                    <option value="11">Novembro</option>
                    <option value="12">Dezembro</option>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Métodos de pagamento aceites</Label>
                <div className="grid grid-cols-2 gap-3">
                  {METODOS.map(m => {
                    const activo = form.financeiro.metodos.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => toggleMetodo(m.id)}
                        className={`flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all
                          ${activo
                            ? "border-[#1F6B3B] bg-[#E8F5EE]"
                            : "border-slate-200 bg-white hover:border-slate-300"}`}
                      >
                        <span className="text-xl">{m.icon}</span>
                        <span className={`text-sm font-medium ${activo ? "text-[#1F6B3B]" : "text-slate-600"}`}>
                          {m.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <Label optional>Dados bancários para transferência</Label>
                <Textarea
                  value={form.financeiro.dados_bancarios}
                  onChange={e => updateFin("dados_bancarios", e.target.value)}
                  placeholder={`Banco BFA
IBAN: AO06 0040 0000 1234 5678 1016 2
Titular: Nome da Escola`}
                />
                <Hint>Aparece nas guias de pagamento enviadas aos encarregados.</Hint>
              </div>

              <div>
                <Label optional>Casos especiais ou observações</Label>
                <Textarea
                  value={form.financeiro.observacoes}
                  onChange={e => updateFin("observacoes", e.target.value)}
                  placeholder="Ex: Alunos bolseiros têm desconto de 50%. Irmãos têm desconto de 10% a partir do 2º filho..."
                />
              </div>
            </div>
          </div>
        )}

        {/* ═══ PASSO 6 — RESUMO ════════════════════════════════════════════ */}
        {passo === 6 && (
          <div className="animate-klasse-fade-up">
            <div className="mb-8">
              <p className="text-xs font-bold uppercase tracking-widest text-[#1F6B3B] mb-2">Passo 6</p>
              <h1 className="text-3xl font-bold text-slate-800 tracking-tight mb-2">Resumo</h1>
              <p className="text-slate-500 text-sm leading-relaxed">
                Verifique os dados antes de submeter. Pode voltar a qualquer passo para corrigir.
              </p>
            </div>

            <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden mb-6">
              <CardContent className="p-0">
                {/* Escola */}
                <div className="p-6 border-b border-slate-100">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                    <School size={14} className="text-klasse-green" /> Escola
                  </p>
                  <div className="grid grid-cols-2 gap-6">
                    {[
                      ["Nome", form.escola_nome],
                      ["NIF", form.escola_nif],
                      ["Morada", form.escola_morada],
                      ["Município", form.escola_municipio],
                      ["Telefone", form.escola_tel],
                      ["Director(a)", form.director_nome],
                      ["Ano Lectivo", form.ano_letivo],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">{label}</p>
                        <p className={`text-sm font-bold ${value ? "text-slate-700" : "text-slate-300 italic font-normal"}`}>
                          {value || "Não preenchido"}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Académico */}
                <div className="p-6 border-b border-slate-100">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                    <GraduationCap size={14} className="text-klasse-gold" /> Estrutura Académica
                  </p>
                  <div className="grid grid-cols-2 gap-6 mb-4">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Classes activas</p>
                      <p className="text-sm font-bold text-slate-700">
                        {classesActivas.length > 0 ? classesActivas.map(c => c.nome).join(", ") : "Nenhuma"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Turnos</p>
                      <p className="text-sm font-bold text-slate-700">
                        {form.turnos.length > 0 ? form.turnos.join(", ") : "Nenhum"}
                      </p>
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-2xl p-4 flex flex-wrap gap-4 border border-slate-100">
                    {classesActivas.map(c => (
                      <div key={c.id} className="text-xs font-medium">
                        <span className="text-slate-400">{c.nome}:</span> <strong className="text-slate-700">
                          {c.propina ? `Kz ${c.propina.toLocaleString()}` : "—"}
                        </strong>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Financeiro */}
                <div className="p-6 border-b border-slate-100">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                    <CreditCard size={14} className="text-blue-500" /> Financeiro
                  </p>
                  <div className="grid grid-cols-2 gap-6">
                    {[
                      ["Início financeiro", form.financeiro.data_inicio],
                      ["Dia de vencimento", form.financeiro.dia_vencimento],
                      ["Métodos aceites", form.financeiro.metodos.join(", ")],
                      ["Observações", form.financeiro.observacoes || "—"],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">{label}</p>
                        <p className="text-sm font-bold text-slate-700">{value || "—"}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Utilizadores */}
                <div className="p-6">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                    <Users size={14} className="text-purple-500" /> Utilizadores
                  </p>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center py-3 px-4 bg-slate-50 rounded-xl">
                      <div>
                        <p className="text-sm font-bold text-slate-700">{form.utilizadores.principal.nome || "—"}</p>
                        <p className="text-[10px] text-slate-400 uppercase font-bold">Utilizador principal</p>
                      </div>
                      <Badge className="bg-klasse-green text-white border-0 text-[9px] font-bold uppercase px-2 py-0.5">Secretaria</Badge>
                    </div>
                    {form.utilizadores.outros.map(u => (
                      <div key={u.id} className="flex justify-between items-center py-3 px-4 bg-white border border-slate-100 rounded-xl">
                        <div>
                          <p className="text-sm font-bold text-slate-700">{u.nome || "—"}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{u.email}</p>
                        </div>
                        <Badge variant="outline" className="text-slate-500 border-slate-200 text-[9px] font-bold uppercase px-2 py-0.5">{u.papel || "—"}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {erro && (
              <div className="bg-red-50 border-2 border-red-100 text-red-700 rounded-2xl p-4 text-sm mb-6 flex items-center gap-3">
                <XCircle size={18} />
                <span className="font-bold">{erro}</span>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer nav */}
      <footer className="bg-white border-t border-slate-100 sticky bottom-0">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            type="button"
            onClick={recuar}
            disabled={passo === 1}
            className="flex items-center gap-2 px-5 py-2.5 border border-slate-200 rounded-xl
              text-sm font-bold text-slate-500 hover:border-slate-300 hover:text-slate-700
              disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            ← Anterior
          </button>

          {passo < TOTAL_PASSOS ? (
            <button
              type="button"
              onClick={avancar}
              disabled={passo === 1 && !form.escola_nome}
              className="flex items-center gap-2 px-8 py-2.5 bg-klasse-green text-white
                rounded-xl text-sm font-bold hover:brightness-110 transition-all
                disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-klasse-green/10"
            >
              Continuar →
            </button>
          ) : (
            <button
              type="button"
              onClick={submeter}
              disabled={submitting}
              className="flex items-center gap-2 px-8 py-2.5 bg-klasse-green text-white
                rounded-xl text-sm font-bold hover:brightness-110 transition-all
                disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-klasse-green/10"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  A enviar...
                </>
              ) : (
                "✓ Submeter pedido"
              )}
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}

// ─── Componentes de UI Auxiliares ───────────────────────────────────────────
function Card({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <div className={`bg-white border border-slate-200 rounded-lg ${className}`}>{children}</div>;
}

function CardContent({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <div className={className}>{children}</div>;
}

function Badge({ className = "", variant = "default", children }: { className?: string; variant?: "default" | "outline"; children: React.ReactNode }) {
  const base = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2";
  const variants = {
    default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
    outline: "text-foreground",
  };
  return <div className={`${base} ${variants[variant]} ${className}`}>{children}</div>;
}
