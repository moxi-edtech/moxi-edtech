import { useEffect, useMemo, useRef, useState } from "react";
import type { SchedulerAula, SchedulerSlot } from "@/components/escola/horarios/SchedulerBoard";
import {
  calculateTotalSlots,
  hasMissingLoad,
  shouldAppearInScheduler,
  type SchedulerDisciplineRulesInput,
} from "@/lib/rules/scheduler-rules";

type SlotApi = {
  id: string;
  turno_id: string;
  dia_semana: number;
  ordem: number;
  inicio: string;
  fim: string;
  is_intervalo?: boolean | null;
};

type BaseDataState = {
  slots: SchedulerSlot[];
  slotLookup: Record<string, string>;
  salas: Array<{ id: string; nome: string }>;
  turmas: Array<{
    id: string;
    nome?: string | null;
    turma_nome?: string | null;
    turma_codigo?: string | null;
    turma_code?: string | null;
    sala?: string | null;
    curso_id?: string | null;
    classe_id?: string | null;
    ano_letivo?: number | null;
    turno?: string | null;
    curso?: { nome?: string | null } | null;
    classe?: { nome?: string | null } | null;
  }>;
  loading: boolean;
  error: string | null;
};

type TurmaDataState = {
  aulas: SchedulerAula[];
  grid: Record<string, string | null>;
  existingAssignments: Array<{ slot_id: string; professor_id: string | null; sala_id?: string | null }>;
  loading: boolean;
  error: string | null;
};

const DIAS_SEMANA = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"];

const mapSlots = (slots: SlotApi[]): { slots: SchedulerSlot[]; slotLookup: Record<string, string> } => {
  const grouped = new Map<number, SlotApi>();
  const lookup: Record<string, string> = {};

  for (const slot of slots) {
    if (slot.dia_semana < 1 || slot.dia_semana > 5) continue;
    if (!grouped.has(slot.ordem)) {
      grouped.set(slot.ordem, slot);
    }
    const dia = DIAS_SEMANA[slot.dia_semana - 1];
    lookup[`${dia}-${slot.ordem}`] = slot.id;
  }

  const formatted: SchedulerSlot[] = Array.from(grouped.values())
    .sort((a, b) => a.ordem - b.ordem)
    .map((slot) => ({
      id: String(slot.ordem),
      label: `${slot.inicio} - ${slot.fim}`,
      tipo: slot.is_intervalo ? "intervalo" : "aula",
    }));

  return { slots: formatted, slotLookup: lookup };
};

const mapAulas = (items: any[]): SchedulerAula[] =>
  items.map((item) => {
    const rulesInput = (item?.meta ?? item) as SchedulerDisciplineRulesInput;
    const missingLoad = hasMissingLoad(rulesInput);
    const cursoMatrizId = item.curso_matriz_id ?? item.cursoMatrizId ?? null;
    return {
      id: item.disciplina?.id ?? item.id,
      cursoMatrizId,
      disciplina: item.disciplina?.nome ?? "Disciplina",
      sigla: (item.disciplina?.nome ?? "").slice(0, 3).toUpperCase() || "DISC",
      professor: item.professor?.nome ?? "—",
      professorId: item.professor?.id ?? null,
      salaId: null,
      cor: "bg-white border-slate-200 text-slate-700 hover:border-klasse-gold",
      temposTotal: calculateTotalSlots(rulesInput),
      temposAlocados: 0,
      missingLoad,
    };
  });

const fetchJson = async (url: string, signal: AbortSignal) => {
  try {
    const res = await fetch(url, { cache: "force-cache", signal });
    const json = await res.json().catch(() => ({}));
    return { res, json };
  } catch (err: any) {
    if (err?.name === "AbortError") {
      return { res: new Response(null, { status: 499 }), json: {} };
    }
    throw err;
  }
};

export function useHorarioBaseData(escolaId?: string, refreshToken?: number) {
  const [state, setState] = useState<BaseDataState>({
    slots: [],
    slotLookup: {},
    salas: [],
    turmas: [],
    loading: false,
    error: null,
  });
  const requestRef = useRef(0);

  useEffect(() => {
    if (!escolaId) return;
    const controller = new AbortController();
    const requestId = ++requestRef.current;
    const anoAtual = new Date().getFullYear();

    setState((prev) => ({ ...prev, loading: true, error: null }));

    Promise.all([
      fetchJson(`/api/escolas/${escolaId}/horarios/slots`, controller.signal),
      fetchJson(`/api/escolas/${escolaId}/salas`, controller.signal),
      fetchJson(`/api/secretaria/turmas-simples?ano=${anoAtual}`, controller.signal),
    ])
      .then(([slotsRes, salasRes, turmasRes]) => {
        if (controller.signal.aborted || requestId !== requestRef.current) return;

        const slotsPayload = slotsRes.res.ok && slotsRes.json.ok ? (slotsRes.json.items || []) : [];
        const salasPayload = salasRes.res.ok && salasRes.json.ok ? (salasRes.json.items || []) : [];
        const turmasPayload = turmasRes.res.ok && turmasRes.json.ok ? (turmasRes.json.items || []) : [];

        const { slots, slotLookup } = mapSlots(slotsPayload as SlotApi[]);

        setState((prev) => {
          const mergedTurmas = turmasPayload.map((turma: any) => {
            const previous = prev.turmas.find((item) => item.id === turma.id);
            return {
              ...turma,
              sala: turma.sala ?? previous?.sala ?? null,
            };
          });
          return {
            slots,
            slotLookup,
            salas: salasPayload,
            turmas: mergedTurmas,
            loading: false,
            error: null,
          };
        });
      })
      .catch((error) => {
        if (controller.signal.aborted || requestId !== requestRef.current) return;
        setState((prev) => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : "Falha ao carregar dados",
        }));
      });

    return () => controller.abort();
  }, [escolaId, refreshToken]);

  const setSalas = (updater: (prev: Array<{ id: string; nome: string }>) => Array<{ id: string; nome: string }>) => {
    setState((prev) => ({ ...prev, salas: updater(prev.salas) }));
  };

  const setTurmas = (updater: (prev: BaseDataState["turmas"]) => BaseDataState["turmas"]) => {
    setState((prev) => ({ ...prev, turmas: updater(prev.turmas) }));
  };

  return { ...state, setSalas, setTurmas };
}

export function useHorarioTurmaData({
  escolaId,
  turmaId,
  versaoId,
  slotLookup,
  refreshToken,
}: {
  escolaId?: string;
  turmaId?: string | null;
  versaoId?: string | null;
  slotLookup: Record<string, string>;
  refreshToken?: number;
}) {
  const [state, setState] = useState<TurmaDataState>({
    aulas: [],
    grid: {},
    existingAssignments: [],
    loading: false,
    error: null,
  });
  const requestRef = useRef(0);

  const slotLookupReady = useMemo(() => Object.keys(slotLookup).length > 0, [slotLookup]);

  useEffect(() => {
    if (!escolaId || !turmaId || !versaoId || !slotLookupReady) {
      setState((prev) => ({
        ...prev,
        aulas: [],
        grid: {},
        existingAssignments: [],
        loading: false,
        error: null,
      }));
      return;
    }

    const controller = new AbortController();
    const requestId = ++requestRef.current;
    const params = new URLSearchParams({
      versao_id: versaoId,
      turma_id: turmaId,
    });

    setState((prev) => ({ ...prev, loading: true, error: null }));

    Promise.all([
      fetchJson(`/api/secretaria/turmas/${turmaId}/disciplinas?escola_id=${encodeURIComponent(escolaId)}`, controller.signal),
      fetchJson(`/api/escolas/${escolaId}/horarios/quadro?${params.toString()}`, controller.signal),
    ])
      .then(([disciplinasRes, quadroRes]) => {
        if (controller.signal.aborted || requestId !== requestRef.current) return;

        const aulasPayload =
          disciplinasRes.res.ok && disciplinasRes.json.ok && Array.isArray(disciplinasRes.json.items)
            ? disciplinasRes.json.items
            : [];
        const quadroPayload =
          quadroRes.res.ok && quadroRes.json.ok && Array.isArray(quadroRes.json.items)
            ? quadroRes.json.items
            : [];

        const nextGrid: Record<string, string | null> = {};
        for (const item of quadroPayload) {
          const slotKey = Object.entries(slotLookup).find(([, id]) => id === item.slot_id)?.[0];
          if (slotKey) nextGrid[slotKey] = item.disciplina_id;
        }

        const aulasFiltradas = aulasPayload.filter((item: any) => {
          const rulesInput = (item?.meta ?? item) as SchedulerDisciplineRulesInput;
          return shouldAppearInScheduler(rulesInput);
        });

        setState({
          aulas: mapAulas(aulasFiltradas),
          grid: nextGrid,
          existingAssignments: quadroPayload.map((item: any) => ({
            slot_id: item.slot_id,
            professor_id: item.professor_id ?? null,
            sala_id: item.sala_id ?? null,
          })),
          loading: false,
          error: null,
        });
      })
      .catch((error) => {
        if (controller.signal.aborted || requestId !== requestRef.current) return;
        setState((prev) => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : "Falha ao carregar turma",
        }));
      });

    return () => controller.abort();
  }, [escolaId, turmaId, versaoId, slotLookupReady, slotLookup, refreshToken]);

  const setAulas = (updater: (prev: SchedulerAula[]) => SchedulerAula[]) => {
    setState((prev) => ({ ...prev, aulas: updater(prev.aulas) }));
  };

  const setGrid = (
    updater:
      | Record<string, string | null>
      | ((prev: Record<string, string | null>) => Record<string, string | null>)
  ) => {
    setState((prev) => ({
      ...prev,
      grid: typeof updater === "function" ? updater(prev.grid) : updater,
    }));
  };

  const setExistingAssignments = (
    updater: (prev: TurmaDataState["existingAssignments"]) => TurmaDataState["existingAssignments"]
  ) => {
    setState((prev) => ({ ...prev, existingAssignments: updater(prev.existingAssignments) }));
  };

  return { ...state, setAulas, setGrid, setExistingAssignments };
}
