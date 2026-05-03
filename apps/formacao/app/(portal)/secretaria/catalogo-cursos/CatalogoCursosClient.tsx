"use client";

import { useEffect, useState } from "react";
import { Share2, Copy, Check, MessageCircle, ExternalLink, ChevronRight, Plus } from "lucide-react";

type Curso = {
  id: string;
  codigo: string;
  nome: string;
  area: string | null;
  modalidade: "presencial" | "online" | "hibrido";
  carga_horaria: number | null;
  status: "ativo" | "inativo";
};

type Props = {
  centroSlug: string;
};

export default function CatalogoCursosClient({ centroSlug }: Props) {
  const [items, setItems] = useState<Curso[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    nome: "",
    codigo: "",
    modalidade: "presencial" as "presencial" | "online" | "hibrido",
  });
  const [creating, setCreating] = useState(false);

  const normalizedSlug = centroSlug.trim();
  const publicPath = normalizedSlug ? `/${normalizedSlug}` : null;
  const publicLink = publicPath ?? "";
  const hasPublicLink = Boolean(publicPath);

  const whatsappMessage = `Olá! Confira os nossos cursos abertos e faça a sua inscrição online aqui: ${publicLink}`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`;

  const handleCopy = async () => {
    if (!publicPath) {
      setError("Landing page indisponível: este centro ainda não possui slug público.");
      return;
    }

    const absoluteLink =
      typeof window !== "undefined" ? `${window.location.origin}${publicPath}` : publicPath;

    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(absoluteLink);
      } else if (typeof document !== "undefined") {
        const textarea = document.createElement("textarea");
        textarea.value = absoluteLink;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "absolute";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Não foi possível copiar o link automaticamente.");
    }
  };

  const loadCursos = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/formacao/backoffice/cursos", { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as { ok: boolean; error?: string; items?: Curso[] } | null;
      if (!res.ok || !json?.ok || !Array.isArray(json.items)) throw new Error(json?.error || "Falha ao carregar catálogo");
      setItems(json.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch("/api/formacao/backoffice/cursos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm)
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Erro ao criar curso");
      
      window.location.href = `/secretaria/catalogo-cursos/${data.item.id}`;
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setCreating(false);
    }
  };

  useEffect(() => {
    loadCursos();
  }, []);

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex-1">
          <p className="m-0 text-xs font-black uppercase tracking-widest text-klasse-gold">Secretaria Centro</p>
          <h1 className="mt-1.5 text-3xl font-black tracking-tight text-slate-900">Cursos</h1>
          <p className="mt-2 text-sm text-slate-500 max-w-lg leading-relaxed">
            Consulte o catálogo de formação. Partilhe o link da sua <strong className="text-slate-900">Landing Page pública</strong> para receber inscrições diretas de novos alunos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button 
            onClick={() => setShowCreateModal(true)}
            className="mr-4 flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-black text-white shadow-lg shadow-slate-900/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            <Plus size={18} /> Novo Curso
          </button>

          <div className="flex items-center gap-2 rounded-xl bg-slate-50 border border-slate-200 p-1.5 pr-3">
            <button
              onClick={handleCopy}
              disabled={!hasPublicLink}
              className={`flex h-9 w-9 items-center justify-center rounded-lg transition-all ${
                copied ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
              }`}
              title="Copiar Link"
            >
              {copied ? <Check size={18} /> : <Copy size={18} />}
            </button>
            <div className="min-w-0">
              <p className="m-0 text-[10px] font-black uppercase tracking-widest text-slate-400">Link de Vendas</p>
              <p className="m-0 text-xs font-bold text-slate-900 truncate max-w-[180px]">{publicPath ?? "Slug público não configurado"}</p>
            </div>
          </div>

          <a
            href={hasPublicLink ? whatsappUrl : "#"}
            target="_blank"
            rel="noreferrer"
            onClick={(event) => {
              if (!hasPublicLink) {
                event.preventDefault();
                setError("Landing page indisponível: este centro ainda não possui slug público.");
              }
            }}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black text-white shadow-lg transition-all ${
              hasPublicLink
                ? "bg-[#25D366] shadow-[#25D366]/20 hover:scale-[1.03] hover:brightness-110 active:scale-[0.97]"
                : "bg-slate-300 shadow-slate-200 cursor-not-allowed"
            }`}
          >
            <MessageCircle size={18} /> Partilhar no WhatsApp
          </a>

          <a
            href={publicPath ?? "#"}
            target="_blank"
            rel="noreferrer"
            onClick={(event) => {
              if (!hasPublicLink) {
                event.preventDefault();
                setError("Landing page indisponível: este centro ainda não possui slug público.");
              }
            }}
            className={`flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-lg transition-all ${
              hasPublicLink
                ? "bg-slate-900 shadow-slate-900/20 hover:scale-105 active:scale-95"
                : "bg-slate-300 shadow-slate-200 cursor-not-allowed"
            }`}
            title="Visualizar Página Pública"
          >
            <ExternalLink size={18} />
          </a>
        </div>
      </header>

      {error ? <p className="m-0 text-sm text-red-700">{error}</p> : null}
      {loading ? <p className="m-0 text-sm text-zinc-700">Carregando...</p> : null}

      <section className="space-y-2 md:hidden">
        {items.map((item) => (
          <article 
            key={item.id} 
            className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm cursor-pointer hover:border-slate-400 transition-all"
            onClick={() => window.location.href = `/secretaria/catalogo-cursos/${item.id}`}
          >
            <p className="text-sm font-semibold text-zinc-900">{item.nome}</p>
            <p className="mt-0.5 text-xs text-zinc-500">Código: {item.codigo}</p>
            <p className="mt-0.5 text-xs text-zinc-500">Área: {item.area || "-"}</p>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-xs text-zinc-600">{item.modalidade}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusPill(item.status)}`}>{item.status}</span>
            </div>
          </article>
        ))}
        {!loading && items.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 bg-white px-3 py-4 text-sm text-zinc-500">Sem cursos cadastrados.</div>
        ) : null}
      </section>

      <section className="hidden overflow-x-auto rounded-xl border border-zinc-200 bg-white md:block shadow-sm">
        <table className="min-w-[760px] w-full border-collapse text-sm">
          <thead className="bg-slate-50">
            <tr>
              <Th>Código</Th>
              <Th>Curso</Th>
              <Th>Área</Th>
              <Th>Modalidade</Th>
              <Th>Estado</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr 
                key={item.id} 
                className="group cursor-pointer hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-none"
                onClick={() => window.location.href = `/secretaria/catalogo-cursos/${item.id}`}
              >
                <Td>
                  <span className="font-mono text-[11px] font-bold text-slate-400 group-hover:text-slate-600">
                    {item.codigo}
                  </span>
                </Td>
                <Td>
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded bg-slate-100 flex items-center justify-center text-slate-400">
                       <Plus size={14} />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 group-hover:text-klasse-gold transition-colors">{item.nome}</p>
                      <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">{item.carga_horaria} Horas</p>
                    </div>
                  </div>
                </Td>
                <Td>{item.area || "-"}</Td>
                <Td>
                  <span className="capitalize text-slate-600">{item.modalidade}</span>
                </Td>
                <Td>
                  <div className="flex items-center justify-between gap-4">
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${statusPill(item.status)}`}>
                      {item.status}
                    </span>
                    <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-900 group-hover:translate-x-1 transition-all" />
                  </div>
                </Td>
              </tr>
            ))}
            {items.length === 0 && !loading && (
              <tr>
                <Td colSpan={5} className="py-12 text-center text-slate-400">Sem cursos cadastrados no catálogo.</Td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {/* Create Course Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-black text-slate-900">Novo Curso</h2>
            <p className="mt-1 text-sm text-slate-500">Defina as informações básicas para iniciar.</p>
            
            <form onSubmit={handleCreateCourse} className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nome do Curso</label>
                <input 
                  required
                  type="text" 
                  placeholder="Ex: Excel Avançado"
                  value={createForm.nome}
                  onChange={e => setCreateForm(p => ({ ...p, nome: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-slate-900"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Código</label>
                <input 
                  required
                  type="text" 
                  placeholder="Ex: CUR-EXC-01"
                  value={createForm.codigo}
                  onChange={e => setCreateForm(p => ({ ...p, codigo: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-slate-900"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Modalidade</label>
                <select 
                  value={createForm.modalidade}
                  onChange={e => setCreateForm(p => ({ ...p, modalidade: e.target.value as any }))}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-slate-900"
                >
                  <option value="presencial">Presencial</option>
                  <option value="online">Online</option>
                  <option value="hibrido">Híbrido</option>
                </select>
              </div>
              
              <div className="mt-8 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 text-xs font-black text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button 
                  disabled={creating}
                  type="submit"
                  className="flex-1 rounded-xl bg-slate-900 py-2.5 text-xs font-black text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {creating ? "Criando..." : "Criar e Ir ao Cockpit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="border-b border-zinc-200 px-6 py-4 text-left text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">{children}</th>;
}

function Td({ children, colSpan, className = "" }: { children: React.ReactNode; colSpan?: number; className?: string }) {
  return (
    <td colSpan={colSpan} className={`px-6 py-4 text-slate-800 ${className}`}>
      {children}
    </td>
  );
}

function statusPill(status: string) {
  return status === "ativo" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700";
}
