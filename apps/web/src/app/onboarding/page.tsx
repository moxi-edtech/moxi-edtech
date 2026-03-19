// apps/web/src/app/onboarding/page.tsx
// Build trigger: synchronizing with remote environment
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
  RefreshCw,
  ChevronRight,
  Clock,
  Mail,
  Phone,
  Calendar,
  Save,
  Building2,
  TrendingUp,
  Layout
} from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface ClasseConfig {
  id: string;
  nome: string;
  nivel: "EP" | "ESG";
  activa: boolean;
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
  // Passo 3 — Estrutura & Dimensão
  turnos: string[];
  total_alunos: string;
  faixa_propina: string;
  // Passo 4 — Utilizadores
  utilizadores: {
    principal: { nome: string; tel: string; nivel_exp: string };
  };
  // Passo 5 — Financeiro
  financeiro: {
    data_inicio: string;
    dia_vencimento: string;
    mes_inicio: string;
    mes_fim: string;
    dados_bancarios: string;
  };
}

// ─── Constantes ───────────────────────────────────────────────────────────────
const CLASSES_INICIAL: ClasseConfig[] = [
  { id: "ini", nome: "Iniciação", nivel: "EP", activa: true },
  { id: "1",   nome: "1ª Classe", nivel: "EP", activa: true },
  { id: "2",   nome: "2ª Classe", nivel: "EP", activa: true },
  { id: "3",   nome: "3ª Classe", nivel: "EP", activa: true },
  { id: "4",   nome: "4ª Classe", nivel: "EP", activa: true },
  { id: "5",   nome: "5ª Classe", nivel: "EP", activa: true },
  { id: "6",   nome: "6ª Classe", nivel: "EP", activa: true },
  { id: "7",   nome: "7ª Classe", nivel: "ESG", activa: true },
  { id: "8",   nome: "8ª Classe", nivel: "ESG", activa: true },
  { id: "9",   nome: "9ª Classe", nivel: "ESG", activa: true },
];

const MUNICIPIOS_POR_PROVINCIA: Record<string, string[]> = {
  "Bengo": ["Ambriz", "Bula Atumba", "Dande", "Dembos", "Nambuangongo", "Pango Aluquém"],
  "Benguela": ["Balombo", "Baía Farta", "Benguela", "Bocoio", "Catumbela", "Chongorói", "Cubal", "Ganda", "Lobito"],
  "Bié": ["Andulo", "Camacupa", "Catabola", "Chinguar", "Chitembo", "Cuemba", "Cunhinga", "Kuito", "Nharea"],
  "Cabinda": ["Belize", "Buco-Zau", "Cabinda", "Cacongo"],
  "Cuando Cubango": ["Calai", "Cuangar", "Cuchi", "Cuito Cuanavale", "Dirico", "Mavinga", "Menongue", "Nancova", "Rivungo"],
  "Cuanza Norte": ["Ambaca", "Banga", "Bolongongo", "Cambambe", "Cazengo", "Golungo Alto", "Lucala", "Ngonguembo", "Quiculungo", "Samba Caju"],
  "Cuanza Sul": ["Amboim", "Cassongue", "Cela", "Conda", "Ebo", "Libolo", "Mussende", "Porto Amboim", "Quibala", "Quilenda", "Seles", "Sumbe"],
  "Cunene": ["Cahama", "Cuanhama", "Curoca", "Cuvelai", "Namacunde", "Ombadja"],
  "Huambo": ["Bailundo", "Caála", "Catchiungo", "Ecunha", "Huambo", "Londuimbali", "Longonjo", "Mungo", "Tchicala Tcholoanga", "Tchindjenje", "Ukuma"],
  "Huíla": ["Caconda", "Cacula", "Caluquembe", "Chiange", "Chibia", "Chicomba", "Chipindo", "Cuvango", "Humpata", "Jamba", "Lubango", "Matala", "Quilengues", "Quipungo"],
  "Luanda": ["Belas", "Cacuaco", "Cazenga", "Icolo e Bengo", "Kilamba Kiaxi", "Luanda", "Maianga", "Quissama", "Rangel", "Talatona", "Viana"],
  "Lunda Norte": ["Cambulo", "Capenda Camulemba", "Caungula", "Chitato", "Cuango", "Cuilo", "Lubalo", "Lucapa", "Lóvua", "Xá-Muteba"],
  "Lunda Sul": ["Cacolo", "Dala", "Muconda", "Saurimo"],
  "Malanje": ["Cacuso", "Calandula", "Cambundi-Catembo", "Cangandala", "Caombo", "Cuaba Nzogo", "Cunda-dia-Baze", "Kiwaba Nzoji", "Luquembo", "Malanje", "Marimba", "Massango", "Mucari", "Quela", "Quirima"],
  "Moxico": ["Camanongue", "Cameia", "Cazombo", "Luau", "Luena", "Luchazes", "Lumbala N'guimbo", "Léua"],
  "Namibe": ["Bibala", "Camucuio", "Moçâmedes", "Tombwa", "Virei"],
  "Uíge": ["Alto Cauale", "Ambuila", "Bembe", "Buengas", "Bungo", "Damba", "Maquela do Zombo", "Mucaba", "Negage", "Puri", "Quimbele", "Quitexe", "Songo", "Uíge"],
  "Zaire": ["Cuimba", "M'Banza Kongo", "Noqui", "Nzeto", "Soyo", "Tomboco"],
};

const PROVINCIAS = Object.keys(MUNICIPIOS_POR_PROVINCIA);

const FAIXAS_PROPINA = [
  { value: "ate_5k", label: "Até 5.000 Kz / mês" },
  { value: "5k_15k", label: "5.000 a 15.000 Kz / mês" },
  { value: "15k_40k", label: "15.000 a 40.000 Kz / mês" },
  { value: "acima_40k", label: "Acima de 40.000 Kz / mês" },
];

const FORM_INICIAL: FormData = {
  escola_nome: "", escola_nif: "", escola_abrev: "", escola_codigo: "",
  escola_morada: "", escola_municipio: "", escola_provincia: "Luanda",
  escola_tel: "", escola_email: "",
  director_nome: "", director_tel: "",
  ano_letivo: "2026",
  classes: CLASSES_INICIAL,
  turnos: ["M"],
  total_alunos: "",
  faixa_propina: "",
  utilizadores: {
    principal: { nome: "", tel: "", nivel_exp: "" },
  },
  financeiro: {
    data_inicio: "", dia_vencimento: "", mes_inicio: "2",
    mes_fim: "12",
    dados_bancarios: "",
  },
};

const TOTAL_PASSOS = 6;

// ─── Componentes auxiliares ───────────────────────────────────────────────────
function Label({ children, required, optional }: {
  children: React.ReactNode; required?: boolean; optional?: boolean;
}) {
  return (
    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
      {children}
      {required && <span className="text-red-500 ml-1">*</span>}
      {optional && <span className="text-slate-400 font-normal normal-case tracking-normal ml-1">(opcional)</span>}
    </label>
  );
}

function Input({ className = "", ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 
        bg-white outline-none transition-all
        focus:border-[#1F6B3B] focus:ring-4 focus:ring-[#1F6B3B]/10
        placeholder:text-slate-300 ${className}`}
      {...props}
    />
  );
}

function Select({ className = "", children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 
        bg-white outline-none transition-all cursor-pointer appearance-none
        focus:border-[#1F6B3B] focus:ring-4 focus:ring-[#1F6B3B]/10 ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}

function Textarea({ className = "", ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 
        bg-white outline-none transition-all resize-y min-h-[80px] leading-relaxed
        focus:border-[#1F6B3B] focus:ring-4 focus:ring-[#1F6B3B]/10
        placeholder:text-slate-300 ${className}`}
      {...props}
    />
  );
}

function Hint({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <p className={`text-[10px] text-slate-400 mt-1.5 leading-relaxed ${className}`}>{children}</p>;
}

function InfoBox({ children, variant = "gold" }: { children: React.ReactNode; variant?: "gold" | "green" }) {
  const styles = {
    gold:  "bg-klasse-gold-50 border-klasse-gold-200 text-klasse-gold-800",
    green: "bg-klasse-green-50 border-klasse-green-200 text-klasse-green-800",
  };
  return (
    <div className={`flex gap-3 p-4 rounded-2xl border text-sm leading-relaxed mb-6 ${styles[variant]}`}>
      <span className="text-base flex-shrink-0 mt-0.5">{variant === "gold" ? "💡" : "✓"}</span>
      <span>{children}</span>
    </div>
  );
}

function SectionSep({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 my-8">
      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap">{children}</span>
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

  // ── Turnos ───────────────────────────────────────────────────────────────
  function toggleTurno(code: string) {
    setForm(f => {
      const jaActivo = f.turnos.includes(code);
      const novos    = jaActivo ? f.turnos.filter(t => t !== code) : [...f.turnos, code];
      return { ...f, turnos: novos };
    });
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
      faixa_propina:    form.faixa_propina,
      financeiro: {
        ...form.financeiro,
        total_alunos: form.total_alunos,
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
        <div className="max-w-md w-full text-center animate-klasse-fade-up">
          <div className="w-20 h-20 rounded-full bg-[#E8F5EE] flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl text-[#1F6B3B]">✓</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-3 font-sora">
            Pedido recebido!
          </h1>
          <p className="text-slate-500 leading-relaxed mb-8">
            Recebemos os dados de <strong className="text-slate-700">{form.escola_nome}</strong>.
            A equipa KLASSE vai entrar em contacto em breve para confirmar a configuração.
          </p>
          <div className="bg-white border border-slate-100 rounded-3xl p-6 text-left text-sm text-slate-600 leading-relaxed shadow-sm">
            <p className="font-bold text-slate-700 mb-3 flex items-center gap-2">
              <Clock size={16} className="text-klasse-gold" /> Próximos passos
            </p>
            <ol className="list-decimal list-inside space-y-2">
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
    <div className="min-h-screen bg-[#F8FAF9] flex flex-col font-sans">

      {/* Header */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <span className="font-black text-[#1F6B3B] text-xl tracking-tighter">KLASSE.</span>
            <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest ml-3 border-l pl-3 border-slate-100">Candidatura</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#1F6B3B] rounded-full transition-all duration-500"
                style={{ width: `${progresso}%` }}
              />
            </div>
            <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap">
              {passo} / {TOTAL_PASSOS}
            </span>
          </div>
        </div>
      </header>

      {/* Stepper */}
      <div className="bg-white border-b border-slate-100 overflow-x-auto scrollbar-hide">
        <div className="max-w-2xl mx-auto px-6 py-3 min-w-[500px]">
          <div className="flex gap-1">
            {[
              "Escola", "Classes", "Estrutura", "Contacto", "Financeiro", "Resumo"
            ].map((label, i) => {
              const n = i + 1;
              const estado = n < passo ? "done" : n === passo ? "active" : "idle";
              return (
                <button
                  key={n}
                  onClick={() => n < passo && setPasso(n)}
                  className={`flex-1 text-center py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all
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
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#1F6B3B] mb-2">Passo 1</p>
              <h1 className="text-3xl font-black text-slate-800 tracking-tight mb-2 font-sora">Dados da Escola</h1>
              <p className="text-slate-500 text-sm leading-relaxed">
                Informações institucionais básicas para o registo da sua unidade.
              </p>
            </div>

            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <Label required>Nome Oficial da Escola</Label>
                  <Input
                    value={form.escola_nome}
                    onChange={e => update("escola_nome", e.target.value)}
                    placeholder="Ex: Colégio Nossa Senhora da Paz"
                  />
                </div>
                <div>
                  <Label required>NIF</Label>
                  <Input
                    value={form.escola_nif}
                    onChange={e => update("escola_nif", e.target.value.replace(/\D/g, '').slice(0, 9))}
                    placeholder="9 dígitos"
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
                  <Label optional>Código da Escola</Label>
                  <Input
                    value={form.escola_codigo}
                    onChange={e => update("escola_codigo", e.target.value)}
                    placeholder="Ex: 456/2024"
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
                  <Label required>Província</Label>
                  <Select
                    value={form.escola_provincia}
                    onChange={e => {
                      update("escola_provincia", e.target.value);
                      update("escola_municipio", "");
                    }}
                  >
                    <option value="">Seleccionar...</option>
                    {PROVINCIAS.map((provincia) => (
                      <option key={provincia} value={provincia}>
                        {provincia}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label required>Município</Label>
                  <Select
                    value={form.escola_municipio}
                    onChange={e => update("escola_municipio", e.target.value)}
                  >
                    <option value="">Seleccionar...</option>
                    {(MUNICIPIOS_POR_PROVINCIA[form.escola_provincia] ?? []).map((municipio) => (
                      <option key={municipio} value={municipio}>
                        {municipio}
                      </option>
                    ))}
                  </Select>
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
                  <Label optional>Contacto Directo</Label>
                  <Input
                    value={form.director_tel}
                    onChange={e => update("director_tel", e.target.value)}
                    placeholder="9XXXXXXXX"
                    type="tel"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══ PASSO 2 — CLASSES ═══════════════════════════════════════════ */}
        {passo === 2 && (
          <div className="animate-klasse-fade-up">
            <div className="mb-8">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#1F6B3B] mb-2">Passo 2</p>
              <h1 className="text-3xl font-black text-slate-800 tracking-tight mb-2 font-sora">Classes Disponíveis</h1>
              <p className="text-slate-500 text-sm leading-relaxed">
                Seleccione as classes que a sua escola lecciona actualmente.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {form.classes.map((cls) => (
                <button
                  key={cls.id}
                  onClick={() => toggleClasse(cls.id)}
                  className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all text-left
                    ${cls.activa 
                      ? "border-[#1F6B3B] bg-white shadow-sm" 
                      : "border-slate-100 bg-slate-50/50 opacity-60"}`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all
                      ${cls.activa ? "border-[#1F6B3B] bg-[#1F6B3B]" : "border-slate-300 bg-white"}`}>
                      {cls.activa && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                    <div>
                      <span className="text-sm font-bold text-slate-700">{cls.nome}</span>
                      <span className="text-[9px] font-black uppercase text-slate-400 ml-3 tracking-widest">{cls.nivel === "EP" ? "Primário" : "Secundário"}</span>
                    </div>
                  </div>
                  {cls.activa && <span className="text-[10px] font-bold text-klasse-green-600 uppercase tracking-tighter">Activada</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ═══ PASSO 3 — ESTRUTURA & DIMENSÃO ══════════════════════════════ */}
        {passo === 3 && (
          <div className="animate-klasse-fade-up">
            <div className="mb-8">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#1F6B3B] mb-2">Passo 3</p>
              <h1 className="text-3xl font-black text-slate-800 tracking-tight mb-2 font-sora">Estrutura & Dimensão</h1>
              <p className="text-slate-500 text-sm leading-relaxed">
                Estimativa de volume operacional para dimensionamento do sistema.
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
                    className={`p-4 rounded-2xl border-2 text-center transition-all
                      ${activo
                        ? "border-[#1F6B3B] bg-[#E8F5EE]"
                        : "border-slate-200 bg-white hover:border-slate-300"}`}
                  >
                    <div className="text-2xl mb-1">{t.icon}</div>
                    <div className={`text-xl font-black ${activo ? "text-[#1F6B3B]" : "text-slate-700"}`}>
                      {t.code}
                    </div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{t.label}</div>
                  </button>
                );
              })}
            </div>

            <SectionSep>Dados de Faturação (Lead Scoring)</SectionSep>

            <div className="space-y-6">
              <div>
                <Label required>Faixa média de propina por aluno</Label>
                <Select
                  value={form.faixa_propina}
                  onChange={e => update("faixa_propina", e.target.value)}
                >
                  <option value="">Seleccionar faixa...</option>
                  {FAIXAS_PROPINA.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </Select>
                <Hint>O valor médio mensal pago pelos alunos nesta instituição.</Hint>
              </div>

              <div>
                <Label required>Total estimado de alunos</Label>
                <Input
                  type="number"
                  value={form.total_alunos}
                  onChange={e => update("total_alunos", e.target.value)}
                  placeholder="Ex: 500"
                />
                <Hint>Número total de alunos em todos os turnos.</Hint>
              </div>
            </div>
          </div>
        )}

        {/* ═══ PASSO 4 — CONTACTO OPERACIONAL ══════════════════════════════ */}
        {passo === 4 && (
          <div className="animate-klasse-fade-up">
            <div className="mb-8">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#1F6B3B] mb-2">Passo 4</p>
              <h1 className="text-3xl font-black text-slate-800 tracking-tight mb-2 font-sora">Contacto Operacional</h1>
              <p className="text-slate-500 text-sm leading-relaxed">
                Dados da pessoa que será o ponto de contacto para a formação técnica.
              </p>
            </div>

            <InfoBox variant="green">
              Geralmente é o responsável pela Secretaria ou o Administrador de TI.
            </InfoBox>

            <div className="space-y-5">
              <div>
                <Label required>Nome do Responsável Operacional</Label>
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
                  placeholder="9XXXXXXXX"
                  type="tel"
                />
              </div>

              <div>
                <Label required>Experiência com Informática</Label>
                <Select
                  value={form.utilizadores.principal.nivel_exp}
                  onChange={e => updateUtil("nivel_exp", e.target.value)}
                >
                  <option value="">Seleccionar nível...</option>
                  <option value="basico">Básica — Usa o telefone, pouco computador</option>
                  <option value="medio">Média — Word, Excel, Redes Sociais</option>
                  <option value="avancado">Avançada — Confortável com softwares de gestão</option>
                </Select>
              </div>
            </div>
          </div>
        )}

        {/* ═══ PASSO 5 — FINANCEIRO ════════════════════════════════════════ */}
        {passo === 5 && (
          <div className="animate-klasse-fade-up">
            <div className="mb-8">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#1F6B3B] mb-2">Passo 5</p>
              <h1 className="text-3xl font-black text-slate-800 tracking-tight mb-2 font-sora">Configuração Financeira</h1>
              <p className="text-slate-500 text-sm leading-relaxed">
                Dados necessários para a configuração do calendário de cobranças.
              </p>
            </div>

            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label required>Ano Lectivo</Label>
                  <Select value={form.ano_letivo} onChange={e => update("ano_letivo", e.target.value)}>
                    <option value="2026">2026 (Próximo)</option>
                    <option value="2025">2025 (Corrente)</option>
                  </Select>
                </div>
                <div>
                  <Label required>Dia de Vencimento</Label>
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
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Início das Aulas</Label>
                  <Select
                    value={form.financeiro.mes_inicio}
                    onChange={e => updateFin("mes_inicio", e.target.value)}
                  >
                    <option value="1">Janeiro</option>
                    <option value="2">Fevereiro</option>
                    <option value="3">Março</option>
                    <option value="9">Setembro</option>
                  </Select>
                </div>
                <div>
                  <Label>Fim das Aulas</Label>
                  <Select
                    value={form.financeiro.mes_fim}
                    onChange={e => updateFin("mes_fim", e.target.value)}
                  >
                    <option value="10">Outubro</option>
                    <option value="11">Novembro</option>
                    <option value="12">Dezembro</option>
                  </Select>
                </div>
              </div>

              <div>
                <Label optional>IBAN para Transferências</Label>
                <Textarea
                  value={form.financeiro.dados_bancarios}
                  onChange={e => updateFin("dados_bancarios", e.target.value)}
                  placeholder={`IBAN: AO06 0000 ...\nTitular: ...`}
                />
                <Hint>Estes dados aparecerão nas notas de cobrança para os pais.</Hint>
              </div>
            </div>
          </div>
        )}

        {/* ═══ PASSO 6 — RESUMO ════════════════════════════════════════════ */}
        {passo === 6 && (
          <div className="animate-klasse-fade-up">
            <div className="mb-8">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#1F6B3B] mb-2">Passo 6</p>
              <h1 className="text-3xl font-black text-slate-800 tracking-tight mb-2 font-sora">Resumo Final</h1>
              <p className="text-slate-500 text-sm leading-relaxed">
                Revise os seus dados antes de submeter a candidatura.
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm space-y-px">
              {/* Escola */}
              <div className="p-6 bg-white border-b border-slate-50">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-klasse-green-50 rounded-xl text-[#1F6B3B]"><Building2 size={16} /></div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-800">Instituição</h3>
                </div>
                <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
                  <div><p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Nome</p><p className="font-bold text-slate-700">{form.escola_nome}</p></div>
                  <div><p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">NIF</p><p className="font-mono text-slate-700">{form.escola_nif}</p></div>
                  <div><p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Município</p><p className="font-bold text-slate-700">{form.escola_municipio}</p></div>
                  <div><p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Director</p><p className="font-bold text-slate-700">{form.director_nome}</p></div>
                </div>
              </div>

              {/* Topologia */}
              <div className="p-6 bg-white border-b border-slate-50">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-slate-50 rounded-xl text-slate-600"><Layout size={16} /></div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-800">Dimensão</h3>
                </div>
                <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
                  <div><p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Estimativa Alunos</p><p className="font-bold text-slate-700">{form.total_alunos} Alunos</p></div>
                  <div><p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Faixa de Propina</p><p className="font-bold text-[#1F6B3B]">{FAIXAS_PROPINA.find(f => f.value === form.faixa_propina)?.label}</p></div>
                  <div className="col-span-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1.5">Classes Activas</p>
                    <div className="flex flex-wrap gap-1.5">
                      {classesActivas.map(c => (
                        <span key={c.id} className="bg-slate-100 px-2.5 py-1 rounded-lg text-[10px] font-bold text-slate-600">{c.nome}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Contacto */}
              <div className="p-6 bg-white border-b border-slate-50">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-slate-50 rounded-xl text-slate-600"><Users size={16} /></div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-800">Operacional</h3>
                </div>
                <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl">
                  <div>
                    <p className="text-sm font-bold text-slate-700">{form.utilizadores.principal.nome}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">{form.utilizadores.principal.tel}</p>
                  </div>
                  <div className="text-[10px] font-black uppercase bg-white px-3 py-1 rounded-lg border border-slate-100 shadow-sm">Ponto Focal</div>
                </div>
              </div>
            </div>

            {erro && (
              <div className="bg-rose-50 border border-rose-100 text-rose-700 rounded-2xl p-4 text-xs font-bold mt-6 flex items-center gap-3">
                <XCircle size={16} /> {erro}
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
              text-xs font-bold text-slate-500 hover:border-slate-300 hover:text-slate-700
              disabled:opacity-30 disabled:cursor-not-allowed transition-all uppercase tracking-widest"
          >
            ← Anterior
          </button>

          {passo < TOTAL_PASSOS ? (
            <button
              type="button"
              onClick={avancar}
              disabled={passo === 1 && (!form.escola_nome || !form.escola_nif)}
              className="flex items-center gap-2 px-8 py-2.5 bg-klasse-green text-white
                rounded-xl text-xs font-bold hover:brightness-110 transition-all
                disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-klasse-green/10 uppercase tracking-widest"
            >
              Continuar →
            </button>
          ) : (
            <button
              type="button"
              onClick={submeter}
              disabled={submitting || !form.faixa_propina || !form.total_alunos}
              className="flex items-center gap-2 px-8 py-2.5 bg-klasse-green text-white
                rounded-xl text-xs font-bold hover:brightness-110 transition-all
                disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-klasse-green/10 uppercase tracking-widest"
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

function Badge({ className = "", children }: { className?: string; children: React.ReactNode }) {
  const base = "inline-flex items-center rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider transition-colors";
  return <div className={`${base} ${className}`}>{children}</div>;
}
