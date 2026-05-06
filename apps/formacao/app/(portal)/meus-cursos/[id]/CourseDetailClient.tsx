"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { 
  BookOpen, 
  Calendar, 
  ChevronLeft, 
  Clock, 
  FileText, 
  Loader2,
  Download,
  ExternalLink
} from "lucide-react";
import { toast } from "@/lib/toast";

type Cohort = {
  id: string;
  codigo: string;
  nome: string;
  curso_nome: string;
  data_inicio: string;
  data_fim: string;
  status: string;
};

type Modulo = {
  id: string;
  titulo: string;
  ordem: number;
};

type Material = {
  id: string;
  titulo: string;
  descricao: string | null;
  file_url: string;
  file_type: string | null;
  modulo_id: string | null;
  created_at: string;
};

type Agenda = {
  id: string;
  titulo: string;
  descricao: string | null;
  data: string;
  hora_inicio: string | null;
  hora_fim: string | null;
  local: string | null;
  modulo_id: string | null;
};

export default function CourseDetailClient({ id }: { id: string }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    cohort: Cohort;
    modulos: Modulo[];
    materiais: Material[];
    agenda: Agenda[];
  } | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/formacao/meus-cursos/${id}`);
        const json = await res.json();
        if (json.ok) {
          setData(json);
        } else {
          toast({ title: "Erro", description: json.error, variant: "destructive" });
        }
      } catch (err) {
        toast({ title: "Erro", description: "Falha ao carregar detalhes do curso", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <Loader2 className="h-8 w-8 animate-spin mb-4" />
        <p className="font-bold">A carregar curso...</p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <header className="rounded-[2rem] border border-slate-200 bg-white p-6 md:p-8 shadow-sm">
        <Link href="/meus-cursos" className="inline-flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-[#1F6B3B] mb-6 transition-colors">
          <ChevronLeft size={16} /> Voltar para Meus Cursos
        </Link>
        
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1F6B3B]/10 text-[#1F6B3B]">
              <BookOpen size={24} />
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">portal do formando</p>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 leading-tight">
            {data.cohort.curso_nome}
          </h1>
          <p className="mt-2 text-sm text-slate-500 font-medium">
            {data.cohort.nome} ({data.cohort.codigo}) · {data.cohort.data_inicio} → {data.cohort.data_fim}
          </p>
        </div>
      </header>

      <div className="grid md:grid-cols-3 gap-6">
        <section className="md:col-span-2 space-y-6">
          <div className="space-y-4">
            <h2 className="flex items-center gap-2 text-lg font-black text-slate-900 px-2">
              <FileText size={20} className="text-[#1F6B3B]" /> Materiais de Apoio
            </h2>
            <div className="grid gap-3">
              {data.materiais.map((mat) => {
                const modulo = data.modulos.find(m => m.id === mat.modulo_id);
                return (
                  <article key={mat.id} className="flex items-center justify-between gap-4 rounded-[2.2rem] border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-400">
                        <FileText size={24} />
                      </div>
                      <div>
                        {modulo && (
                          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5 block">
                            M{modulo.ordem}: {modulo.titulo}
                          </span>
                        )}
                        <h4 className="font-black text-slate-900 leading-tight">{mat.titulo}</h4>
                        <p className="text-xs text-slate-500 font-medium mt-1">{mat.descricao || "Ficheiro de suporte"}</p>
                      </div>
                    </div>
                    <a 
                      href={mat.file_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="p-3 rounded-xl bg-slate-50 text-[#1F6B3B] hover:bg-[#1F6B3B] hover:text-white transition-all shadow-sm"
                    >
                      <Download size={20} />
                    </a>
                  </article>
                );
              })}
              {data.materiais.length === 0 && (
                <div className="py-12 text-center rounded-[2.2rem] bg-white border border-dashed border-slate-200">
                  <FileText size={40} className="mx-auto text-slate-200 mb-3" />
                  <p className="text-slate-400 text-sm font-bold">Nenhum material disponível ainda.</p>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <div className="space-y-4">
            <h2 className="flex items-center gap-2 text-lg font-black text-slate-900 px-2">
              <Calendar size={20} className="text-[#1F6B3B]" /> Avaliações
            </h2>
            <div className="grid gap-3">
              {data.agenda.map((item) => (
                <article key={item.id} className="flex flex-col gap-3 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col items-center justify-center h-12 w-12 rounded-xl bg-slate-900 text-white">
                      <span className="text-[10px] font-black uppercase leading-none">{new Date(item.data).toLocaleDateString("pt-AO", { month: "short" })}</span>
                      <span className="text-xl font-black">{new Date(item.data).getDate()}</span>
                    </div>
                    <div>
                      <h4 className="font-black text-slate-900 text-sm leading-tight">{item.titulo}</h4>
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider">
                        <Clock size={12} /> {item.hora_inicio?.slice(0, 5)} {item.local && `· ${item.local}`}
                      </div>
                    </div>
                  </div>
                </article>
              ))}
              {data.agenda.length === 0 && (
                <div className="py-10 text-center rounded-[2rem] bg-slate-50 border border-slate-100">
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Sem avaliações agendadas</p>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
