"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, AlertCircle, Wand2, Check, Save } from "lucide-react";
import { toast } from "sonner";
import { parseTurmaCode, findCursoIdByFuzzy as findCursoBySigla, findClasseByNum, normalizeTurmaCode } from "@/lib/turma";
import { saveAndValidateTurma } from "@/features/turmas/actions";

// Tipos
interface TurmaItem {
  id?: string;
  nome?: string;
  turma_codigo?: string;
  turno?: string;
  sala?: string;
  capacidade_maxima?: number;
  ano_letivo?: number;
  status_validacao?: string;
  session_id?: string;
  curso_id?: string;
  classe_id?: string;
  metadata?: {
    importacao_config?: {
      skip_matricula: boolean;
      mes_inicio: number;
    };
  };
}

interface ItemSelect {
  id: string;
  nome: string;
  course_code?: string;
  codigo?: string;
  status?: string;
  curriculum_key?: string;
}

interface TurmaFormProps {
  escolaId: string;
  onSuccess: () => void;
  initialData?: TurmaItem | null;
}

function normalizeCodigo(input: string) {
  return normalizeTurmaCode(input || "");
}

function normalizeTurno(input: string) {
  return (input || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z]/g, "")
    .toUpperCase();
}

function extractCodigoFromNome(nome?: string) {
  if (!nome) return "";
  const match = nome.toUpperCase().match(/([A-Z]{2,}[-_\/]?\d{1,2}[-_\/]?[MTN]?[-_\/]?[A-Z]?)/);
  return match?.[1] || "";
}

function extractAnoLetivoFromSessionName(nome?: string) {
  const digits = (nome || "").replace(/\D/g, "");
  // se vier "2025/2026" pega o primeiro bloco
  const first = digits.slice(0, 4);
  return first && first.length === 4 ? first : new Date().getFullYear().toString();
}

function useDebouncedEffect(effect: () => void, deps: any[], delayMs: number) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const t = setTimeout(() => effect(), delayMs);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export default function TurmaForm({ escolaId, onSuccess, initialData }: TurmaFormProps) {
  // Estados do Formulário
  const [nome, setNome] = useState(initialData?.nome || "");
  const [turmaCodigo, setTurmaCodigo] = useState(initialData?.turma_codigo || "");
  const [turno, setTurno] = useState(initialData?.turno || "");
  const [sessionId, setSessionId] = useState(initialData?.session_id || "");
  const [sala, setSala] = useState(initialData?.sala || "");
  const [capacidade, setCapacidade] = useState(initialData?.capacidade_maxima || 35);
  const [cursoId, setCursoId] = useState(initialData?.curso_id || "");
  const [classeId, setClasseId] = useState(initialData?.classe_id || "");
  const [skipMatricula, setSkipMatricula] = useState(false);
  const [startMonth, setStartMonth] = useState<number>(new Date().getMonth() + 1);

  // Estados de UI
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [autoFilled, setAutoFilled] = useState(false);
  const [initialAutoFillAttempted, setInitialAutoFillAttempted] = useState(false);

  // Listas
  const [sessions, setSessions] = useState<ItemSelect[]>([]);
  const [cursos, setCursos] = useState<ItemSelect[]>([]);
  const [classes, setClasses] = useState<ItemSelect[]>([]);

  // evita spam de auto-fill repetido no mesmo código
  const lastAutofillCodigoRef = useRef<string>("");

  const codigoReferencia = useMemo(
    () =>
      normalizeCodigo(
        turmaCodigo || initialData?.turma_codigo || extractCodigoFromNome(initialData?.nome) || ""
      ),
    [turmaCodigo, initialData?.turma_codigo, initialData?.nome]
  );

  const isDraft = useMemo(
    () => !initialData || initialData.status_validacao === "rascunho" || !initialData.status_validacao,
    [initialData?.id, initialData?.status_validacao]
  );

  const parserInfo = useMemo(() => parseTurmaCode(codigoReferencia), [codigoReferencia]);

  // Se vier com o código só no nome (ex: "TI-10-M-A (Imp. Auto)"), preenche o campo de código
  useEffect(() => {
    if (turmaCodigo) return;
    if (!codigoReferencia) return;
    setTurmaCodigo(codigoReferencia);
  }, [codigoReferencia, turmaCodigo]);

  // Reseta o formulário sempre que uma nova turma é aberta para edição
  useEffect(() => {
    setNome(initialData?.nome || "");
    setTurmaCodigo(initialData?.turma_codigo || "");
    setTurno(initialData?.turno || "");
    setSessionId(initialData?.session_id || "");
    setSala(initialData?.sala || "");
    setCapacidade(initialData?.capacidade_maxima || 35);
    setCursoId(initialData?.curso_id || "");
    setClasseId(initialData?.classe_id || "");
    if (initialData?.metadata?.importacao_config) {
      setSkipMatricula(Boolean(initialData.metadata.importacao_config.skip_matricula));
      const mes = Number(initialData.metadata.importacao_config.mes_inicio);
      setStartMonth(Number.isFinite(mes) ? mes : new Date().getMonth() + 1);
    } else {
      setSkipMatricula(false);
      setStartMonth(new Date().getMonth() + 1);
    }
    setAutoFilled(false);
    setInitialAutoFillAttempted(false);
    lastAutofillCodigoRef.current = "";
  }, [initialData?.id]);

  // --- 1) Carregar dados iniciais (fetch correto) ---
  useEffect(() => {
    let mounted = true;

    async function fetchJson(url: string) {
      const res = await fetch(url);
      let json: any = null;
      try {
        json = await res.json();
      } catch {
        // se não for json, lança erro com status
        throw new Error(`Resposta inválida (não-JSON) em ${url} (HTTP ${res.status})`);
      }
      if (!res.ok) {
        const msg = json?.error || json?.message || `HTTP ${res.status}`;
        throw new Error(`Falha ao carregar ${url}: ${msg}`);
      }
      // aceita formatos comuns: {data}, {items}, array direto
      return Array.isArray(json) ? json : (json.data || json.items || []);
    }

    const loadAll = async () => {
      try {
        setLoadingData(true);

        const [sessionsData, cursosData, classesData] = await Promise.all([
          fetchJson("/api/secretaria/school-sessions"),
          fetchJson("/api/secretaria/cursos"),
          fetchJson("/api/secretaria/classes"),
        ]);

        if (!mounted) return;
        setSessions(sessionsData);
        setCursos(cursosData);
        setClasses(classesData);
      } catch (e: any) {
        console.error("Erro loading lists:", e);
        if (mounted) setError(e?.message || "Erro de conexão ao carregar listas.");
      } finally {
        if (mounted) setLoadingData(false);
      }
    };

    loadAll();
    return () => {
      mounted = false;
    };
  }, []);

  // Mapa de turno robusto
  const turnoMap = useMemo(() => {
    return {
      M: "Manhã",
      T: "Tarde",
      N: "Noite",
      MANHA: "Manhã",
      MANHÃ: "Manhã",
      TARDE: "Tarde",
      NOITE: "Noite",
    } as Record<string, string>;
  }, []);

  const parserSugestao = useMemo(() => {
    if (!parserInfo) return "";
    const partes: string[] = [];

    if (parserInfo.classeNum) {
      const letraParte = parserInfo.letraTurma ? ` ${parserInfo.letraTurma}` : "";
      partes.push(`${parserInfo.classeNum}ª Classe${letraParte}`);
    }

    if (parserInfo.cursoSugeridoNome || parserInfo.siglaCurso) {
      partes.push(parserInfo.cursoSugeridoNome || parserInfo.siglaCurso || "");
    }

    const turnoLabel = parserInfo.turnoSigla ? turnoMap[parserInfo.turnoSigla] || parserInfo.turnoSigla : "";
    const base = partes.filter(Boolean).join(" - ");

    if (!base && !turnoLabel) return "";
    return turnoLabel ? `${base || ""}${base ? " • " : ""}${turnoLabel}` : base;
  }, [parserInfo, turnoMap]);

  // --- 2) Inteligência: AutoFill determinístico (sem race) ---
  const executeAutoFill = (force: boolean) => {
    if ((cursos.length === 0 || classes.length === 0) && force) {
      toast.warning("Listas não carregadas — usando apenas o código para sugerir.");
    }

    const codigoAlvo = codigoReferencia;
    if (!codigoAlvo) return;

    const info = parseTurmaCode(codigoAlvo);
    if (!info) {
      if (force) toast.error("Código inválido. Use o formato CURSO-CLASSE-TURNO-LETRA (ex: TI-10-M-A).");
      return;
    }

    // evita ficar rodando à toa quando não mudou
    if (!force && lastAutofillCodigoRef.current === codigoAlvo) return;

    let corrections = 0;

    // calcula “próximo estado” em variáveis locais (evita race com setState)
    let nextCursoId = cursoId;
    let nextClasseId = classeId;
    let nextTurno = turno;
    let nextNome = nome;
    let nextSessionId = sessionId;

    // 1) Curso
    if (!nextCursoId || force) {
      const foundId = findCursoBySigla(info, cursos);
      if (foundId && foundId !== nextCursoId) {
        nextCursoId = foundId;
        corrections++;
      }
    }

    // 2) Classe
    if (!nextClasseId || force) {
      const foundId = findClasseByNum(info.classeNum, classes);
      if (foundId && foundId !== nextClasseId) {
        nextClasseId = foundId;
        corrections++;
      }
    }

    // 3) Turno
    const turnoAtualNormalized = normalizeTurno(nextTurno);
    const turnoPlaceholder = ["ND", "NDA", "NA", "N", "SEM", "SEMTURNO", "SN"].includes(turnoAtualNormalized);
    const turnoAtualInvalido =
      !nextTurno ||
      turnoPlaceholder ||
      ["M", "T", "N", "MANHA", "TARDE", "NOITE"].includes(turnoAtualNormalized);

    const sigla = normalizeTurno(info.turnoSigla || "");
    const mapped = turnoMap[sigla] || turnoMap[normalizeCodigo(info.turnoSigla || "")];
    if ((turnoAtualInvalido || force) && mapped && mapped !== nextTurno) {
      nextTurno = mapped;
      corrections++;
    }

    // 4) Nome (só monta se realmente fizer sentido)
    const shouldRebuildName =
      force || !nextNome || nextNome.includes("(Imp. Auto)");

    if (shouldRebuildName) {
      const clsName =
        classes.find((c) => c.id === nextClasseId)?.nome ||
        (info.classeNum ? `${info.classeNum}ª Classe` : "");

      const crsName =
        cursos.find((c) => c.id === nextCursoId)?.nome ||
        info.cursoSugeridoNome ||
        "";

      let novoNome = `${clsName} ${info.letraTurma || "A"}`.trim();
      if (crsName) novoNome += ` - ${crsName}`;

      if (novoNome.trim().length > 3 && novoNome !== nextNome) {
        nextNome = novoNome;
        corrections++;
      }
    }

    // 5) Sessão ativa
    if ((!nextSessionId || force) && sessions.length > 0) {
      const active = sessions.find((s) => ["ativa", "active"].includes((s.status || "").toLowerCase()));
      if (active?.id && active.id !== nextSessionId) {
        nextSessionId = active.id;
        corrections++;
      }
    }

    // aplica de uma vez
    setCursoId(nextCursoId);
    setClasseId(nextClasseId);
    setTurno(nextTurno);
    setNome(nextNome);
    setSessionId(nextSessionId);

    const hadParserHints = Boolean(info && (info.cursoSugeridoNome || info.classeNum || info.curriculumKey));
    if (corrections > 0) {
      setAutoFilled(true);
      lastAutofillCodigoRef.current = codigoAlvo;
      if (force) toast.success(`${corrections} campos sugeridos automaticamente.`);
    } else if (hadParserHints) {
      setAutoFilled(true);
      lastAutofillCodigoRef.current = codigoAlvo;
    } else {
      if (force) toast.info("Nada para corrigir — já está consistente.");
    }
  };

  // --- 3) Trigger automático: quando listas carregam + quando código muda (debounced) ---
  useEffect(() => {
    if (loadingData) return;
    if (initialAutoFillAttempted) return;

    if (!codigoReferencia) return;

    // Em rascunho ou nova turma, tentamos preencher automaticamente
    if (isDraft) {
      executeAutoFill(false);
      setInitialAutoFillAttempted(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingData, isDraft, initialData?.id, codigoReferencia, initialAutoFillAttempted]);

  useDebouncedEffect(
    () => {
      if (loadingData) return;
      if (!turmaCodigo) return;
      // Para novas turmas ou rascunhos, deixa a IA atuar ao digitar o código
      if (isDraft) {
        executeAutoFill(false);
      }
    },
    [turmaCodigo, loadingData, isDraft],
    350
  );

  // --- 4) Submit ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const codigoNorm = normalizeCodigo(turmaCodigo);
      if (!codigoNorm) throw new Error("Informe o código da turma.");
      if (!turno) throw new Error("Selecione um turno.");

      const info = parserInfo || parseTurmaCode(codigoNorm);
      const cursoSelecionado = cursos.find((c) => c.id === cursoId);
      const cursoCodigoSugerido = info?.siglaCurso || codigoNorm.split("-")[0] || "";
      const cursoNomeSugerido = cursoSelecionado?.nome || info?.cursoSugeridoNome || "";
      const curriculumKey = cursoSelecionado?.curriculum_key || info?.curriculumKey || null;
      const classeNumeroSugerido = info?.classeNum ? Number(info.classeNum) : undefined;

      let resolvedCursoId = cursoId;
      if (!resolvedCursoId) {
        const foundId = findCursoBySigla(info, cursos);
        if (foundId) {
          resolvedCursoId = foundId;
          setCursoId(foundId);
        }
      }

      if (!resolvedCursoId) {
        throw new Error("Informe ou selecione um curso (curso_id é obrigatório). Use o código ou escolha na lista.");
      }

      const sessionObj = sessions.find((s) => s.id === sessionId);
      const anoLetivoStr = extractAnoLetivoFromSessionName(sessionObj?.nome);

      // Scaffolding: se não tem classeId, cria pelo código ou nome
      let nomeClasseParaCriar: string | undefined = undefined;
      let classeNumeroParaCriar: number | undefined = undefined;
      if (!classeId) {
        if (info?.classeNum) {
          nomeClasseParaCriar = `${info.classeNum}ª Classe`;
          classeNumeroParaCriar = Number(info.classeNum) || undefined;
        } else {
          const matchNum = (nome || "").match(/(\d+)(ª|a)?/i);
          if (matchNum) {
            nomeClasseParaCriar = `${matchNum[1]}ª Classe`;
            classeNumeroParaCriar = Number(matchNum[1]) || undefined;
          } else throw new Error("Selecione a Classe (não foi possível detectar automaticamente).");
        }
      }

      const letra = info?.letraTurma || "A";

      const turnoAbrev = turno.charAt(0).toUpperCase();

      const payload = {
        id: initialData?.id,
        escola_id: escolaId,

        curso_id: resolvedCursoId,
        curso_codigo: cursoCodigoSugerido || undefined,
        curso_nome: cursoNomeSugerido || undefined,
        curriculum_key: curriculumKey || undefined,
        classe_id: classeId || undefined,
        classe_nome: nomeClasseParaCriar,
        classe_num: classeNumeroParaCriar ?? classeNumeroSugerido,

        nome_turma: nome,
        letra,
        turno: turnoAbrev,
        sala,
        capacidade: Number(capacidade),
        ano_letivo: anoLetivoStr,

        turma_codigo: codigoNorm,

        migracao_financeira: isDraft
          ? {
              skip_matricula: skipMatricula,
              mes_inicio: startMonth,
            }
          : undefined,
      };

      await saveAndValidateTurma(payload);

      toast.success("Turma validada e ativada com sucesso!");
      onSuccess();
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Erro ao salvar.");
      toast.error(e?.message || "Erro ao salvar.");
    } finally {
      setLoading(false);
    }
  };

  if (loadingData) {
    return (
      <div className="p-12 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-klasse-gold" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Banner */}
      {isDraft && (
        <div
          className={[
            "p-4 rounded-xl border flex gap-3 transition-colors",
            autoFilled ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200",
          ].join(" ")}
        >
          {autoFilled ? (
            <Wand2 className="w-5 h-5 text-emerald-700 mt-1" />
          ) : (
            <AlertCircle className="w-5 h-5 text-amber-700 mt-1" />
          )}
          <div className="flex-1">
            <h4 className={["text-sm font-bold", autoFilled ? "text-emerald-900" : "text-amber-900"].join(" ")}>
              {autoFilled ? "Dados sugeridos" : "Validação necessária"}
            </h4>
            <p className="text-xs mt-1 opacity-80 leading-relaxed">
              {autoFilled
                ? "Curso/Classe/Turno foram inferidos do código. Confere e salva para ativar."
                : "Sem correspondência automática ainda. Usa a varinha, escolhe manualmente ou salva que criamos o curso/classe se precisar."}
            </p>
            {parserSugestao && (
              <p className="text-[11px] text-slate-700 mt-2 flex items-center gap-1">
                <Wand2 className="w-3 h-3" /> Sugestão do código: {parserSugestao}. Confirma?
              </p>
            )}
          </div>
        </div>
      )}

      {/* Identificação */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="nome" className="block text-xs font-bold text-slate-700 mb-1">
            Nome da Turma *
          </label>
          <input
            id="nome"
            name="nome"
            required
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-4 focus:ring-klasse-gold/20 focus:border-klasse-gold outline-none transition-shadow"
          />
        </div>

        <div>
          <label htmlFor="turmaCodigo" className="block text-xs font-bold text-slate-700 mb-1">
            Código (Sistema) *
          </label>
          <div className="flex gap-2">
            <input
              id="turmaCodigo"
              name="turmaCodigo"
              required
              value={turmaCodigo}
              onChange={(e) => setTurmaCodigo(normalizeCodigo(e.target.value))}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm bg-slate-50 font-mono uppercase text-slate-700 focus:ring-4 focus:ring-klasse-gold/20 focus:border-klasse-gold outline-none"
            />
            <button
              type="button"
              onClick={() => executeAutoFill(true)}
              title="Forçar identificação automática"
              className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
            >
              <Wand2 className="w-5 h-5 text-klasse-gold" />
            </button>
          </div>
        </div>
      </div>

      {/* Logística */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label htmlFor="turno" className="block text-xs font-bold text-slate-700 mb-1">
            Turno *
          </label>
          <select
            id="turno"
            name="turno"
            required
            value={turno}
            onChange={(e) => setTurno(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white focus:ring-4 focus:ring-klasse-gold/20 focus:border-klasse-gold outline-none"
          >
            <option value="">Selecione...</option>
            <option value="Manhã">Manhã</option>
            <option value="Tarde">Tarde</option>
            <option value="Noite">Noite</option>
          </select>
        </div>
        <div>
          <label htmlFor="capacidade" className="block text-xs font-bold text-slate-700 mb-1">
            Capacidade
          </label>
          <input
            id="capacidade"
            name="capacidade"
            type="number"
            value={capacidade}
            onChange={(e) => setCapacidade(Number(e.target.value || 0))}
            className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-4 focus:ring-klasse-gold/20 focus:border-klasse-gold outline-none"
          />
        </div>
        <div>
          <label htmlFor="sala" className="block text-xs font-bold text-slate-700 mb-1">
            Sala
          </label>
          <input
            id="sala"
            name="sala"
            value={sala}
            onChange={(e) => setSala(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-4 focus:ring-klasse-gold/20 focus:border-klasse-gold outline-none"
          />
        </div>
      </div>

      <hr className="border-slate-100" />

      {/* Académico */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="classeId" className="block text-xs font-bold text-slate-700 mb-1">
            Classe (Ano)
          </label>
          <select
            id="classeId"
            name="classeId"
            value={classeId}
            onChange={(e) => setClasseId(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white focus:ring-4 focus:ring-klasse-gold/20 focus:border-klasse-gold outline-none"
          >
            <option value="">Selecione...</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
          {!classeId && isDraft && (
            <p className="text-[10px] text-amber-700 mt-1">
              ⚠️ Se deixar vazio, o sistema criará a classe automaticamente baseada no código (ex: "10").
            </p>
          )}
        </div>

        <div>
          <label htmlFor="sessionId" className="block text-xs font-bold text-slate-700 mb-1">
            Ano Letivo (Sessão) *
          </label>
          <select
            id="sessionId"
            name="sessionId"
            required
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white focus:ring-4 focus:ring-klasse-gold/20 focus:border-klasse-gold outline-none"
          >
            <option value="">Selecione...</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <label htmlFor="cursoId" className="block text-xs font-bold text-slate-700 mb-1">
            Curso Associado *
          </label>
          <select
            id="cursoId"
            name="cursoId"
            required
            value={cursoId}
            onChange={(e) => setCursoId(e.target.value)}
            className={[
              "w-full px-3 py-2 border rounded-xl text-sm transition-colors bg-white focus:ring-4 focus:ring-klasse-gold/20 focus:border-klasse-gold outline-none",
              autoFilled && cursoId ? "border-klasse-gold/60 bg-amber-50 text-slate-900 font-medium" : "border-slate-300",
            ].join(" ")}
          >
            <option value="">Selecione o curso...</option>
            {cursos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome} {c.course_code ? `(${c.course_code})` : c.codigo ? `(${c.codigo})` : ""}
              </option>
            ))}
          </select>
          {autoFilled && cursoId && (
            <p className="text-[10px] text-emerald-700 mt-1 flex items-center gap-1">
              <Check className="w-3 h-3" /> Curso detectado via código: {normalizeCodigo(turmaCodigo).split("-")[0] || ""}.
            </p>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 text-red-700 border border-red-200 text-sm rounded-xl flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {isDraft && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-amber-900">Definição Financeira</h3>
            <p className="text-xs text-amber-800">Proteja alunos migrados de cobranças indevidas.</p>
          </div>

          <label className="flex items-start gap-2 text-sm text-amber-900">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
              checked={skipMatricula}
              onChange={(e) => setSkipMatricula(e.target.checked)}
            />
            <span className="leading-tight">
              Considerar matrícula já paga (migração)
              <span className="block text-xs text-amber-700">Abona/zera a taxa de matrícula para alunos existentes.</span>
            </span>
          </label>

          <div className="space-y-1">
            <label className="text-sm font-semibold text-amber-900 block">Mês de início da mensalidade</label>
            <select
              className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
              value={startMonth}
              onChange={(e) => setStartMonth(Number(e.target.value) || new Date().getMonth() + 1)}
            >
              {[1,2,3,4,5,6,7,8,9,10,11,12].map((mes) => (
                <option key={mes} value={mes}>{new Date(0, mes - 1).toLocaleString('pt-PT', { month: 'long' })}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
        <button
          type="button"
          onClick={onSuccess}
          className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-xl text-sm font-bold transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2 bg-klasse-gold text-white rounded-xl text-sm font-bold hover:brightness-95 disabled:opacity-70 flex items-center gap-2 shadow-sm transition-all active:scale-95"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Salvando...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" /> {isDraft ? "Aprovar e Ativar" : "Salvar Turma"}
            </>
          )}
        </button>
      </div>
    </form>
  );
}
