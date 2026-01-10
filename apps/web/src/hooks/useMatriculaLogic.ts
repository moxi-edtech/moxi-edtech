// hooks/useMatriculaLogic.ts
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Aluno, Candidatura, Curso, Orcamento, Session, Turma } from "@/types/matricula";

const extrairAnoLetivo = (valor?: string | number | null) => {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === "number" && Number.isFinite(valor)) return valor;
  const texto = String(valor);
  const match = texto.match(/(19|20)\d{2}/);
  return match ? Number(match[0]) : null;
};

export function useMatriculaLogic() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const candidaturaIdFromQuery = searchParams?.get("candidaturaId") || "";
  const alunoIdFromQuery = searchParams?.get("alunoId") || "";
  const sessionIdFromQuery = searchParams?.get("sessionId") || "";
  const escolaIdFromQuery = searchParams?.get("escolaId") || searchParams?.get("escola_id") || "";

  // --- ESTADOS GLOBAIS ---
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // --- DADOS ---
  const [dados, setDados] = useState({
    candidaturas: [] as Candidatura[],
    sessions: [] as Session[],
    cursos: [] as Curso[],
    turmas: [] as Turma[],
    escolaId: "",
  });

  // --- SELEÇÕES ---
  const [selecao, setSelecao] = useState({
    candidaturaId: searchParams?.get("candidaturaId") || "",
    sessionId: "",
    turmaId: "",
    destinoTipo: "classe" as "classe" | "curso",
    cursoFiltro: "",
    classeFiltro: "",
    historicoFiltro: "" as "" | "10" | "12",
  });

  // --- FINANCEIRO ---
  const [orcamento, setOrcamento] = useState<Orcamento | null>(null);
  const [loadingOrcamento, setLoadingOrcamento] = useState(false);

  // --- COMPUTADOS (MEMOS) ---
  const candidaturaAtiva = useMemo(
    () => dados.candidaturas.find((c) => c.id === selecao.candidaturaId),
    [dados.candidaturas, selecao.candidaturaId]
  );

  const lastQueryAppliedRef = useRef({ candidaturaId: "", sessionId: "" });

  const alunoAtivo = useMemo(() => {
    if (!candidaturaAtiva) return null;
    return (
      candidaturaAtiva.alunos ||
      ({
        id: candidaturaAtiva.aluno_id,
        nome: (candidaturaAtiva as any).nome_candidato || "Candidato",
        numero_processo: (candidaturaAtiva as any).dados_candidato?.numero_processo,
      } as Aluno)
    );
  }, [candidaturaAtiva]);

  const turmaSelecionada = useMemo(
    () => dados.turmas.find((t) => t.id === selecao.turmaId),
    [dados.turmas, selecao.turmaId]
  );

  const sessionSelecionada = useMemo(
    () => dados.sessions.find((s) => s.id === selecao.sessionId),
    [dados.sessions, selecao.sessionId]
  );

  const anoLetivoAtivo = useMemo(() => {
    const candidatos = [
      candidaturaAtiva?.ano_letivo,
      (turmaSelecionada as any)?.ano_letivo,
      (turmaSelecionada as any)?.ano,
      (sessionSelecionada as any)?.ano_letivo,
      (sessionSelecionada as any)?.nome,
    ];

    for (const candidato of candidatos) {
      const ano = extrairAnoLetivo(candidato);
      if (ano) return ano;
    }
    return new Date().getFullYear();
  }, [candidaturaAtiva, turmaSelecionada, sessionSelecionada]);

  // --- EFEITOS (DATA FETCHING) ---

  // 1. Carga Inicial
  useEffect(() => {
    async function init() {
      try {
        const parseSettledJson = async (res: PromiseSettledResult<Response>) => {
          if (res.status !== "fulfilled") return {} as any;
          try {
            return await res.value.json();
          } catch (e) {
            console.error("Erro ao parsear resposta", e);
            return {} as any;
          }
        };

        const parseDirectJson = async (res: Response | undefined | null) => {
          if (!res) return {} as any;
          try {
            return await res.json();
          } catch (e) {
            console.error("Erro ao parsear resposta", e);
            return {} as any;
          }
        };

        const candRes = await fetch(`/api/secretaria/candidaturas`, { cache: "force-cache" }).catch(
          () => undefined
        );
        const candJson = await parseDirectJson(candRes);
        let candidaturas = Array.isArray(candJson?.items)
          ? candJson.items
          : Array.isArray(candJson?.data)
            ? candJson.data
            : [];

        candidaturas = candidaturas.filter((c: any) => {
          const status = (c?.status || "").toString().toLowerCase();
          return status !== "matriculado" && status !== "rejeitada" && status !== "cancelada";
        });

        const escolaPreferida =
          escolaIdFromQuery ||
          (candidaturaIdFromQuery
            ? candidaturas.find((c: any) => c.id === candidaturaIdFromQuery)?.escola_id
            : null) ||
          (alunoIdFromQuery
            ? candidaturas.find((c: any) => c.aluno_id === alunoIdFromQuery)?.escola_id
            : null) ||
          candidaturas[0]?.escola_id ||
          "";

        const sessionsUrls = escolaPreferida
          ? [
              `/api/secretaria/school-sessions?escolaId=${escolaPreferida}`,
              `/api/escolas/${escolaPreferida}/school-sessions`,
            ]
          : [`/api/secretaria/school-sessions`];

        const sessJsonCandidates: any[] = [];
        for (const url of sessionsUrls) {
          const candidate = await parseDirectJson(await fetch(url).catch(() => undefined));
          sessJsonCandidates.push(candidate || {});
          const hasList = Array.isArray(candidate?.data) || Array.isArray(candidate?.items);
          if (hasList) break;
        }

        const sessJson = sessJsonCandidates.find(
          (c) => Array.isArray(c?.data) || Array.isArray(c?.items)
        ) || sessJsonCandidates[0] || {};

        const [resCur] = await Promise.allSettled([fetch("/api/secretaria/cursos-com-classes")]);

        const [curJson] = await Promise.all([parseSettledJson(resCur)]);

        const sessions = Array.isArray(sessJson?.data)
          ? sessJson.data
          : Array.isArray(sessJson?.items)
            ? sessJson.items
            : [];

        const cursos = Array.isArray(curJson?.items)
          ? curJson.items
          : Array.isArray(curJson?.data)
            ? curJson.data
            : [];

        setDados((prev) => ({ ...prev, sessions, cursos, candidaturas, escolaId: escolaPreferida }));

        const sessionFromQueryValida =
          sessionIdFromQuery && sessions.some((s: any) => s.id === sessionIdFromQuery)
            ? sessionIdFromQuery
            : "";

        const activeSession = sessions.find((s: Session) => s.status === "ativa") || sessions[0];
        const novoSessionId = sessionFromQueryValida || activeSession?.id || "";

        if (novoSessionId) {
          setSelecao((prev) => ({ ...prev, sessionId: novoSessionId }));
          if (sessionFromQueryValida) {
            lastQueryAppliedRef.current.sessionId = sessionFromQueryValida;
          }
        }
      } catch (err) {
        console.error("Fatal Load Error", err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [sessionIdFromQuery, candidaturaIdFromQuery, alunoIdFromQuery, escolaIdFromQuery]);

  // 1.b. Sincronizar seleção com querystring (candidatura/session)
  useEffect(() => {
    const candidaturaDestino =
      candidaturaIdFromQuery ||
      (!selecao.candidaturaId && alunoIdFromQuery
        ? dados.candidaturas.find((c) => c.aluno_id === alunoIdFromQuery)?.id
        : "");

    if (
      candidaturaDestino &&
      candidaturaDestino !== selecao.candidaturaId &&
      candidaturaDestino !== lastQueryAppliedRef.current.candidaturaId
    ) {
      setSelecao((prev) => ({ ...prev, candidaturaId: candidaturaDestino, turmaId: "" }));
      lastQueryAppliedRef.current.candidaturaId = candidaturaDestino;
    }

    const sessionDestino =
      sessionIdFromQuery && dados.sessions.find((s) => s.id === sessionIdFromQuery)
        ? sessionIdFromQuery
        : "";

    if (
      sessionDestino &&
      sessionDestino !== selecao.sessionId &&
      sessionDestino !== lastQueryAppliedRef.current.sessionId
    ) {
      setSelecao((prev) => ({ ...prev, sessionId: sessionDestino }));
      lastQueryAppliedRef.current.sessionId = sessionDestino;
    }
  }, [
    candidaturaIdFromQuery,
    alunoIdFromQuery,
    sessionIdFromQuery,
    selecao.candidaturaId,
    selecao.sessionId,
    dados.candidaturas,
    dados.sessions,
  ]);

  // 1.c. Garantir um ano letivo selecionado quando carregado
  useEffect(() => {
    if (selecao.sessionId || dados.sessions.length === 0) return;
    const activeSession = dados.sessions.find((s) => s.status === "ativa") || dados.sessions[0];
    if (activeSession) setSelecao((prev) => ({ ...prev, sessionId: activeSession.id }));
  }, [dados.sessions, selecao.sessionId]);

  // 2. Carregar Turmas quando Sessão muda
  useEffect(() => {
    if (!selecao.sessionId) return;
    const escolaParam = candidaturaAtiva?.escola_id || dados.escolaId;

    const params = new URLSearchParams();
    params.set("session_id", selecao.sessionId);
    if (escolaParam) params.set("escolaId", escolaParam);

    const anoSelecionado = extrairAnoLetivo(
      (sessionSelecionada as any)?.ano_letivo ?? (sessionSelecionada as any)?.nome
    );
    if (anoSelecionado) params.set("ano", String(anoSelecionado));

    fetch(`/api/secretaria/turmas-simples?${params.toString()}`)
      .then((r) => r.json())
      .then((json) => setDados((prev) => ({ ...prev, turmas: json.data || [] })));
  }, [
    selecao.sessionId,
    candidaturaAtiva?.escola_id,
    dados.escolaId,
    sessionSelecionada,
  ]);

  // 3. Orçamento
  useEffect(() => {
    if (!turmaSelecionada) {
      setOrcamento(null);
      return;
    }
    setLoadingOrcamento(true);

    const resolveCursoId = (t?: Turma) =>
      t?.curso?.id || t?.curso_id || selecao.cursoFiltro || undefined;
    const resolveClasseId = (t?: Turma) =>
      t?.classe?.id || t?.classe_id || selecao.classeFiltro || undefined;
    const cursoId = candidaturaAtiva?.curso_id || resolveCursoId(turmaSelecionada);
    const classeId = resolveClasseId(turmaSelecionada);

    const params = new URLSearchParams();
    params.append("ano", String(anoLetivoAtivo));
    if (cursoId) params.append("curso_id", cursoId);
    if (classeId) params.append("classe_id", classeId);
    if (selecao.sessionId) params.append("session_id", selecao.sessionId);

    fetch(`/api/financeiro/orcamento/matricula?${params.toString()}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.ok) setOrcamento(json.data);
        else setOrcamento(null);
      })
      .catch(() => setOrcamento(null))
      .finally(() => setLoadingOrcamento(false));
  }, [turmaSelecionada, anoLetivoAtivo, selecao.sessionId, candidaturaAtiva, selecao.cursoFiltro, selecao.classeFiltro]);

  // --- ACTIONS ---
  const submitMatricula = async () => {
    if (!selecao.candidaturaId || !selecao.turmaId) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/secretaria/candidaturas/${selecao.candidaturaId}/confirmar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ turma_id: selecao.turmaId }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao processar");

      const numeroMatricula = json.numero_matricula ?? json.data?.numero_matricula;

      alert(`Sucesso! Nº Matrícula: ${numeroMatricula ?? "—"}`);
      router.back();
    } catch (e: any) {
      alert("Erro: " + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return {
    state: { loading, submitting, loadingOrcamento, orcamento },
    data: dados,
    selection: selecao,
    setSelection: setSelecao,
    derived: { candidaturaAtiva, alunoAtivo, turmaSelecionada },
    actions: { submitMatricula },
  };
}
