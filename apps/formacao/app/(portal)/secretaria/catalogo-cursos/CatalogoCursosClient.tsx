"use client";

import { useEffect, useState } from "react";
import { Share2, Copy, Check, MessageCircle, ExternalLink } from "lucide-react";

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

  useEffect(() => {
    const run = async () => {
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

    run();
  }, []);

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex-1">
          <p className="m-0 text-xs font-black uppercase tracking-widest text-klasse-gold">Secretaria Centro</p>
          <h1 className="mt-1.5 text-3xl font-black tracking-tight text-slate-900">Catálogo de Cursos</h1>
          <p className="mt-2 text-sm text-slate-500 max-w-lg leading-relaxed">
            Consulte o catálogo de formação. Partilhe o link da sua <strong className="text-slate-900">Landing Page pública</strong> para receber inscrições diretas de novos alunos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
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
          <article key={item.id} className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
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

      <section className="hidden overflow-x-auto rounded-xl border border-zinc-200 bg-white md:block">
        <table className="min-w-[760px] w-full border-collapse text-sm">
          <thead className="bg-zinc-50/90">
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
              <tr key={item.id}>
                <Td>{item.codigo}</Td>
                <Td>{item.nome}</Td>
                <Td>{item.area || "-"}</Td>
                <Td>{item.modalidade}</Td>
                <Td>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusPill(item.status)}`}>{item.status}</span>
                </Td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <Td colSpan={5}>Sem cursos cadastrados.</Td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="border-b border-zinc-200 px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">{children}</th>;
}

function Td({ children, colSpan }: { children: React.ReactNode; colSpan?: number }) {
  return (
    <td colSpan={colSpan} className="border-b border-zinc-100 px-3 py-2.5 text-zinc-800">
      {children}
    </td>
  );
}

function statusPill(status: string) {
  return status === "ativo" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700";
}
