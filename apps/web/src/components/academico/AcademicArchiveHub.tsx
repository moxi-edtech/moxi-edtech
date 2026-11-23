"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Archive, BookOpen, ClipboardCheck, FileText, GraduationCap, History, Users } from "lucide-react";
import HistoricalTurmasPanel from "@/components/academico/HistoricalTurmasPanel";
import ArchiveAnalyticsPanel from "@/components/academico/ArchiveAnalyticsPanel";

type AcademicSession = {
  id: string;
  nome: string;
  status: string;
  data_inicio?: string | null;
  ano_letivo: number;
};
type SessionsResponse = { ok?: boolean; data?: AcademicSession[]; error?: string };

function isArchivedSession(session: AcademicSession): boolean {
  if (!session?.id || session.status === "ativa") return false;
  // O catálogo legado marca até anos planeados como "arquivada".
  // Uma sessão que ainda não começou não pertence ao Arquivo Académico.
  return !session.data_inicio || session.data_inicio <= new Date().toISOString().slice(0, 10);
}

export default function AcademicArchiveHub() {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const schoolParam = pathname.match(/^\/escola\/([^/]+)/)?.[1] ?? null;
  const isOperations = pathname.includes("/operacoes/academico/");
  const section = isOperations ? "operacoes" : "secretaria";
  const base = schoolParam ? `/escola/${encodeURIComponent(decodeURIComponent(schoolParam))}/${section}` : `/${section}`;

  const [years, setYears] = useState<AcademicSession[]>([]);
  const [allYears, setAllYears] = useState<AcademicSession[]>([]);
  const [selectedYearId, setSelectedYearId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const requestedId = searchParams?.get("ano_letivo_id");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const query = schoolParam ? `?escolaId=${encodeURIComponent(decodeURIComponent(schoolParam))}` : "";
    void fetch(`/api/secretaria/school-sessions${query}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const json = await response.json().catch(() => ({})) as SessionsResponse;
        if (!response.ok || !json.ok) throw new Error(json.error || "Não foi possível consultar os anos letivos.");
        return (json.data ?? []).filter((year) => year.data_inicio == null || year.data_inicio <= new Date().toISOString().slice(0, 10))
          .sort((a, b) => b.ano_letivo - a.ano_letivo);
      })
      .then((items) => {
        if (controller.signal.aborted) return;
        setAllYears(items);
        const archivedItems = items.filter(isArchivedSession);
        setYears(archivedItems);
        if (requestedId && !archivedItems.some((year) => year.id === requestedId)) {
          setSelectedYearId("");
          setError("O ano letivo solicitado não pertence ao arquivo desta escola. Selecione um ano válido.");
          return;
        }
        setSelectedYearId((previous) =>
          archivedItems.some((year) => year.id === requestedId) ? (requestedId ?? "") :
          archivedItems.some((year) => year.id === previous) ? previous : (archivedItems[0]?.id ?? "")
        );
      })
      .catch((cause) => {
        if (!controller.signal.aborted) {
          setYears([]);
          setAllYears([]);
          setError(cause instanceof Error ? cause.message : "Falha ao consultar o arquivo.");
        }
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [schoolParam, requestedId, retry]);

  const selectedYear = years.find((year) => year.id === selectedYearId) ?? null;
  const destinations = useMemo(() => {
    if (!selectedYear) return [];
    const yearQuery = `?ano_letivo_id=${encodeURIComponent(selectedYear.id)}`;
    const academicBase = isOperations ? `${base}/academico` : `${base}/operacoes-academicas`;
    return [
      { title: "Alunos e percurso", description: "Consultar matrículas e o dossier de alunos de anos anteriores.", href: `${base}/alunos${yearQuery}`, icon: Users },
      { title: "Turmas e classes", description: "Ver e pesquisar as turmas deste ano diretamente no arquivo.", href: "#turmas-historicas", icon: GraduationCap },
      { title: "Pautas e documentos", description: "Consultar ou emitir documentos com o ano de origem explícito.", href: `${base}/documentos-oficiais${yearQuery}`, icon: FileText },
      { title: "Regularização histórica", description: "Resolver pendências com evidência e permissões próprias, sem reabrir o ano.", href: `${academicBase}/reconciliacao-historica`, icon: ClipboardCheck },
    ];
  }, [base, isOperations, selectedYear]);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground"><Archive className="h-4 w-4" /> Operações académicas</div>
          <h1 className="font-sora text-2xl font-semibold text-klasse-green">Arquivo Académico</h1>
          <p className="mt-1 text-sm text-muted-foreground">Consulte anos anteriores sem mudar o contexto de trabalho da escola.</p>
        </div>
        <Link href={base + "/turmas"} className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
          <BookOpen className="h-4 w-4 text-muted-foreground" /> Voltar às turmas atuais
        </Link>
      </div>

      <section className="rounded-xl border border-border bg-card p-4 shadow-sm" aria-label="Ano letivo do arquivo">
        <label htmlFor="archive-year" className="block text-sm font-semibold text-foreground">Ano letivo a consultar</label>
        <p className="mt-1 text-xs text-muted-foreground">Esta seleção vale apenas para os resultados e ligações deste arquivo.</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <select id="archive-year" className="min-w-56 rounded-xl border border-border bg-card px-3 py-2.5 text-sm focus:border-klasse-gold focus:outline-none focus:ring-4 focus:ring-klasse-gold/20"
            value={selectedYearId} onChange={(event) => { setSelectedYearId(event.target.value); setError(""); }} disabled={loading || years.length === 0}>
            {(!selectedYearId || years.length === 0) && <option value="">Selecione um ano anterior</option>}
            {years.map((year) => <option key={year.id} value={year.id}>{year.nome || `${year.ano_letivo}/${year.ano_letivo + 1}`}</option>)}
          </select>
          {selectedYear && <span className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground"><History className="h-3.5 w-3.5" /> Consulta histórica</span>}
        </div>
      </section>

      {loading && <p role="status" className="text-sm text-muted-foreground">A carregar anos anteriores…</p>}
      {!loading && error && <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        <span>{error}</span>
        <button type="button" onClick={() => setRetry((value) => value + 1)} className="rounded-xl border border-red-300 px-3 py-2 font-semibold">Tentar novamente</button>
      </div>}
      {!loading && !error && !selectedYear && <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">Ainda não existem anos anteriores disponíveis para esta escola.</div>}
      {!loading && !error && selectedYear && (
        <section aria-label="Registos do ano selecionado" className="grid gap-4 md:grid-cols-2">
          {destinations.map(({ title, description, href, icon: Icon }) => (
            <Link key={title} href={href} className="group flex gap-3 rounded-xl border border-border bg-card p-5 shadow-sm transition hover:border-klasse-gold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-klasse-gold/20">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted"><Icon className="h-5 w-5 text-klasse-green" /></span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-foreground group-hover:text-klasse-green">{title}</span>
                <span className="mt-1 block text-sm text-muted-foreground">{description}</span>
              </span>
            </Link>
          ))}
        </section>
      )}
      {!loading && !error && selectedYear && (
        <HistoricalTurmasPanel
          key={selectedYear.id}
          academicYearId={selectedYear.id}
          yearLabel={selectedYear.nome || `${selectedYear.ano_letivo}/${selectedYear.ano_letivo + 1}`}
          escolaParam={schoolParam ? decodeURIComponent(schoolParam) : null}
          portalBase={base}
        />
      )}
      {!loading && !error && selectedYear && (
        <ArchiveAnalyticsPanel
          key={selectedYear.id}
          academicYearId={selectedYear.id}
          years={allYears}
          escolaParam={schoolParam ? decodeURIComponent(schoolParam) : null}
        />
      )}
    </div>
  );
}
