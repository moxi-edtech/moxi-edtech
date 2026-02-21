import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { authorizeTurmasManage } from "@/lib/escola/disciplinas";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const BodySchema = z.object({
  turma_id: z.string().uuid(),
  turno: z.string().optional(),
  strategy: z.enum(["v1"]).default("v1"),
  overwrite_unlocked: z.boolean().default(true),
  dry_run: z.boolean().default(true),
});

type Slot = {
  id: string;
  day: number;
  ordem: number;
  start: string;
  end: string;
  turno: string;
  is_intervalo: boolean;
  locked?: boolean;
};

type DisciplinaNeed = {
  disciplina_id: string;
  nome: string;
  entra_no_horario: boolean;
  carga_semanal: number;
  professor_id?: string | null;
  sala_id?: string | null;
  requires_double?: boolean;
  is_practical?: boolean;
  is_science?: boolean;
  constraints?: {
    max_por_dia?: number;
    evitar_ultimo_tempo?: boolean;
    evitar_primeiro_tempo?: boolean;
    dias_bloqueados?: number[];
  };
  priority?: number;
};

type ExistingAssignment = {
  slot_id: string;
  disciplina_id: string;
  professor_id?: string | null;
  sala_id?: string | null;
  locked?: boolean;
};

type AutoScheduleResult = {
  ok: boolean;
  assignments: ExistingAssignment[];
  stats: {
    total_slots: number;
    filled: number;
    unfilled: number;
    disciplinas_completas: number;
    disciplinas_incompletas: number;
  };
  unmet: Array<{
    disciplina_id: string;
    missing: number;
    reason: "SEM_SLOTS" | "CONFLITO_PROF" | "CONFLITO_SALA" | "REGRAS" | "SEM_PROF" | "PROF_TURNO";
  }>;
  trace: Array<{
    action: "PLACE" | "SKIP" | "FAIL";
    disciplina_id: string;
    slot_id?: string;
    reason?: string;
  }>;
};

const buildSlotKey = (day: number, ordem: number) => `${day}-${ordem}`;
const MAX_UNIQUE_DISCIPLINES_PER_DAY = 5;

function buildSlotIndex(slots: Slot[]) {
  const slotById = new Map<string, Slot>();
  const slotsByDay = new Map<number, Slot[]>();
  for (const slot of slots) {
    slotById.set(slot.id, slot);
    const list = slotsByDay.get(slot.day) || [];
    list.push(slot);
    slotsByDay.set(slot.day, list);
  }
  for (const list of slotsByDay.values()) {
    list.sort((a, b) => a.ordem - b.ordem);
  }
  return { slotById, slotsByDay };
}

const mapTurnoLabel = (turno: string | null) => {
  const normalized = (turno || "").toUpperCase();
  switch (normalized) {
    case "M":
      return "Manhã";
    case "T":
      return "Tarde";
    case "N":
      return "Noite";
    default:
      return null;
  }
};

function prepareConstraints(disciplina: DisciplinaNeed) {
  return {
    max_por_dia: disciplina.constraints?.max_por_dia ?? 1,
    evitar_ultimo_tempo: disciplina.constraints?.evitar_ultimo_tempo ?? false,
    evitar_primeiro_tempo: disciplina.constraints?.evitar_primeiro_tempo ?? false,
    dias_bloqueados: disciplina.constraints?.dias_bloqueados ?? [],
  };
}

function sortDisciplines(disciplinas: DisciplinaNeed[], missingByDisc: Map<string, number>) {
  return [...disciplinas].sort((a, b) => {
    const missingA = missingByDisc.get(a.disciplina_id) || 0;
    const missingB = missingByDisc.get(b.disciplina_id) || 0;
    if (missingA !== missingB) return missingB - missingA;
    const restrA = prepareConstraints(a).dias_bloqueados.length;
    const restrB = prepareConstraints(b).dias_bloqueados.length;
    if (restrA !== restrB) return restrB - restrA;
    const hasProfA = a.professor_id ? 1 : 0;
    const hasProfB = b.professor_id ? 1 : 0;
    if (hasProfA !== hasProfB) return hasProfB - hasProfA;
    return (b.priority ?? 0) - (a.priority ?? 0);
  });
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function isPracticalDiscipline(name: string) {
  const value = normalizeText(name);
  return (
    value.includes("laborat") ||
    value.includes("oficina") ||
    value.includes("pratica") ||
    value.includes("atelier") ||
    value.includes("ateli")
  );
}

function isScienceDiscipline(name: string) {
  const value = normalizeText(name);
  return value.includes("matem") || value.includes("fisic") || value.includes("quim");
}

function canUseDayForDiscipline({
  dayDisciplines,
  day,
  disciplinaId,
}: {
  dayDisciplines: Map<number, Set<string>>;
  day: number;
  disciplinaId: string;
}) {
  const set = dayDisciplines.get(day) || new Set();
  if (set.has(disciplinaId)) return true;
  return set.size < MAX_UNIQUE_DISCIPLINES_PER_DAY;
}

function getAdjacentSlot(
  slotsByDay: Map<number, Slot[]>,
  slot: Slot,
  direction: -1 | 1
) {
  const daySlots = slotsByDay.get(slot.day) || [];
  const index = daySlots.findIndex((item) => item.id === slot.id);
  if (index === -1) return null;
  const neighbor = daySlots[index + direction] || null;
  if (!neighbor || neighbor.is_intervalo) return null;
  return neighbor;
}

function hasAdjacentSameDiscipline({
  slotsByDay,
  dayAssignments,
  slot,
  disciplinaId,
}: {
  slotsByDay: Map<number, Slot[]>;
  dayAssignments: Map<number, Map<number, string>>;
  slot: Slot;
  disciplinaId: string;
}) {
  const daySlots = slotsByDay.get(slot.day) || [];
  const index = daySlots.findIndex((item) => item.id === slot.id);
  if (index === -1) return false;
  const dayMap = dayAssignments.get(slot.day) || new Map();
  const prev = daySlots[index - 1];
  const next = daySlots[index + 1];
  const prevMatch = prev && !prev.is_intervalo && dayMap.get(prev.ordem) === disciplinaId;
  const nextMatch = next && !next.is_intervalo && dayMap.get(next.ordem) === disciplinaId;
  return Boolean(prevMatch || nextMatch);
}

function wouldExceedScienceRun({
  dayAssignments,
  slotsByDay,
  slot,
  disciplinaId,
}: {
  dayAssignments: Map<number, Map<number, string>>;
  slotsByDay: Map<number, Slot[]>;
  slot: Slot;
  disciplinaId: string;
}) {
  const daySlots = slotsByDay.get(slot.day) || [];
  const index = daySlots.findIndex((item) => item.id === slot.id);
  if (index === -1) return false;

  const dayMap = dayAssignments.get(slot.day) || new Map();
  const matches = (idx: number) => {
    const neighbor = daySlots[idx];
    if (!neighbor || neighbor.is_intervalo) return false;
    return dayMap.get(neighbor.ordem) === disciplinaId;
  };

  let run = 1;
  let cursor = index - 1;
  while (matches(cursor)) {
    run += 1;
    cursor -= 1;
  }
  cursor = index + 1;
  while (matches(cursor)) {
    run += 1;
    cursor += 1;
  }

  return run > 2;
}

function wouldExceedScienceRunWithExtra({
  dayAssignments,
  slotsByDay,
  day,
  disciplinaId,
  extraOrdens,
}: {
  dayAssignments: Map<number, Map<number, string>>;
  slotsByDay: Map<number, Slot[]>;
  day: number;
  disciplinaId: string;
  extraOrdens: number[];
}) {
  const daySlots = slotsByDay.get(day) || [];
  const extraSet = new Set(extraOrdens);
  const dayMap = dayAssignments.get(day) || new Map();
  let run = 0;
  let maxRun = 0;

  for (const slot of daySlots) {
    if (slot.is_intervalo) {
      run = 0;
      continue;
    }
    const matches = dayMap.get(slot.ordem) === disciplinaId || extraSet.has(slot.ordem);
    if (matches) {
      run += 1;
      maxRun = Math.max(maxRun, run);
    } else {
      run = 0;
    }
  }

  return maxRun > 2;
}

function mapTurnoId(turno?: string | null) {
  const normalized = turno?.toString().toUpperCase();
  if (normalized === "M") return "matinal";
  if (normalized === "T") return "tarde";
  if (normalized === "N") return "noite";
  return null;
}

function pickSlot({
  disciplina,
  slots,
  slotById,
  slotsByDay,
  occupiedByTurma,
  occupiedByProfessor,
  occupiedBySala,
  perDayCount,
  dayTotals,
  dayDisciplines,
  dayAssignments,
  phase,
}: {
  disciplina: DisciplinaNeed;
  slots: Slot[];
  slotById: Map<string, Slot>;
  slotsByDay: Map<number, Slot[]>;
  occupiedByTurma: Set<string>;
  occupiedByProfessor: Map<string, Set<string>>;
  occupiedBySala: Map<string, Set<string>>;
  perDayCount: Map<number, number>;
  dayTotals: Map<number, number>;
  dayDisciplines: Map<number, Set<string>>;
  dayAssignments: Map<number, Map<number, string>>;
  phase: "strict" | "relax";
}) {
  const constraints = prepareConstraints(disciplina);
  const candidates: Array<{ slot: Slot; score: number }> = [];

  for (const slot of slots) {
    if (slot.is_intervalo) continue;
    if (occupiedByTurma.has(slot.id)) continue;
    if (constraints.dias_bloqueados.includes(slot.day)) continue;
    if (!canUseDayForDiscipline({
      dayDisciplines,
      day: slot.day,
      disciplinaId: disciplina.disciplina_id,
    })) {
      continue;
    }

    const dayCount = perDayCount.get(slot.day) || 0;
    if (dayCount >= 1) {
      const contiguous = hasAdjacentSameDiscipline({
        slotsByDay,
        dayAssignments,
        slot,
        disciplinaId: disciplina.disciplina_id,
      });
      if (!contiguous) continue;
    }

    const prof = disciplina.professor_id;
    if (prof && occupiedByProfessor.get(slot.id)?.has(prof)) continue;

    const sala = disciplina.sala_id;
    if (sala && occupiedBySala.get(slot.id)?.has(sala)) continue;

    const daySlots = dayTotals.get(slot.day) || 0;
    const slotsForDay = slotsByDay.get(slot.day) || [];
    const dayCapacity = slotsForDay.filter((s) => !s.is_intervalo).length || 1;
    const isFirst = slotsForDay.length > 0 && slot.ordem === slotsForDay[0].ordem;
    const isLast = slotsForDay.length > 0 && slot.ordem === slotsForDay[slotsForDay.length - 1].ordem;

    if (disciplina.is_science && wouldExceedScienceRun({
      dayAssignments,
      slotsByDay,
      slot,
      disciplinaId: disciplina.disciplina_id,
    })) {
      continue;
    }

    if (phase === "strict") {
      if (dayCount >= constraints.max_por_dia) continue;
      if (constraints.evitar_primeiro_tempo && isFirst) continue;
      if (constraints.evitar_ultimo_tempo && isLast) continue;
    }

    let score = 0;
    const adjacentSlot = getAdjacentSlot(slotsByDay, slot, 1) ?? getAdjacentSlot(slotsByDay, slot, -1);
    const dayMap = dayAssignments.get(slot.day) || new Map();
    const adjacentMatch =
      adjacentSlot && dayMap.get(adjacentSlot.ordem) === disciplina.disciplina_id;
    if (adjacentMatch) score += 12;
    if (disciplina.requires_double || disciplina.is_practical) {
      if (adjacentSlot && !occupiedByTurma.has(adjacentSlot.id)) score += 8;
    }
    if (dayCount < constraints.max_por_dia) score += 10;
    if (dayCount === 0) score += 5;
    if (daySlots === 0) score += 8;
    if (constraints.evitar_primeiro_tempo && isFirst) score -= 5;
    if (constraints.evitar_ultimo_tempo && isLast) score -= 5;
    score -= daySlots;
    score += Math.round((1 - daySlots / dayCapacity) * 10);

    candidates.push({ slot, score });
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0]?.slot ?? null;
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await supabaseServerTyped<any>();
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const { id: escolaId } = await ctx.params;
    const escolaIdResolved = await resolveEscolaIdForUser(supabase as any, user.id, escolaId, escolaId);
    if (!escolaIdResolved) {
      return NextResponse.json({ ok: false, error: "Escola não encontrada" }, { status: 403 });
    }

    const authz = await authorizeTurmasManage(supabase as any, escolaIdResolved, user.id);
    if (!authz.allowed) {
      return NextResponse.json({ ok: false, error: authz.reason || "Sem permissão" }, { status: 403 });
    }

    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues?.[0]?.message || "Dados inválidos" },
        { status: 400 }
      );
    }

    const body = parsed.data;

    let turnoId = body.turno ?? null;
    if (!turnoId) {
      const { data: turmaRow } = await supabase
        .from("turmas")
        .select("turno")
        .eq("escola_id", escolaIdResolved)
        .eq("id", body.turma_id)
        .maybeSingle();
      turnoId = mapTurnoId(turmaRow?.turno ?? null);
    }

    const slotsQuery = supabase
      .from("horario_slots")
      .select("id, turno_id, ordem, inicio, fim, dia_semana, is_intervalo")
      .eq("escola_id", escolaIdResolved)
      .order("dia_semana", { ascending: true })
      .order("ordem", { ascending: true });

    if (turnoId) slotsQuery.eq("turno_id", turnoId);

    const { data: slotsRows, error: slotsError } = await slotsQuery;
    if (slotsError) return NextResponse.json({ ok: false, error: slotsError.message }, { status: 400 });

    const slots: Slot[] = (slotsRows || []).map((slot: any) => ({
      id: slot.id,
      day: slot.dia_semana,
      ordem: slot.ordem,
      start: slot.inicio,
      end: slot.fim,
      turno: slot.turno_id,
      is_intervalo: Boolean(slot.is_intervalo),
    }));

    if (slots.length === 0) {
      return NextResponse.json({ ok: true, assignments: [], stats: { total_slots: 0, filled: 0, unfilled: 0, disciplinas_completas: 0, disciplinas_incompletas: 0 }, unmet: [], trace: [] });
    }

    const slotIds = slots.map((slot) => slot.id);

    const { data: quadroRows, error: quadroError } = await supabase
      .from("quadro_horarios")
      .select("slot_id, turma_id, disciplina_id, professor_id, sala_id")
      .eq("escola_id", escolaIdResolved)
      .in("slot_id", slotIds);

    if (quadroError) return NextResponse.json({ ok: false, error: quadroError.message }, { status: 400 });

    const { data: disciplinasRows, error: discError } = await supabase
      .from("turma_disciplinas")
      .select(
        "id, turma_id, curso_matriz_id, professor_id, carga_horaria_semanal, entra_no_horario, curso_matriz:curso_matriz_id(disciplina_id, carga_horaria_semanal, entra_no_horario, disciplina:disciplinas_catalogo!curso_matriz_disciplina_id_fkey(id, nome))"
      )
      .eq("escola_id", escolaIdResolved)
      .eq("turma_id", body.turma_id);

    if (discError) return NextResponse.json({ ok: false, error: discError.message }, { status: 400 });

    const turnoLabel = mapTurnoLabel(turnoId);
    const professorIds = Array.from(
      new Set((disciplinasRows || []).map((row: any) => row.professor_id).filter(Boolean))
    ) as string[];
    const professorProfileMap = new Map<string, string>();
    const professorTurnosMap = new Map<string, string[]>();

    if (professorIds.length > 0) {
      const { data: professoresRows } = await supabase
        .from("professores")
        .select("id, profile_id")
        .eq("escola_id", escolaIdResolved)
        .in("id", professorIds);

      for (const row of professoresRows || []) {
        if (row?.id && row?.profile_id) professorProfileMap.set(row.id, row.profile_id);
      }

      const profileIds = Array.from(new Set(Array.from(professorProfileMap.values())));
      if (profileIds.length > 0) {
        const { data: teacherRows } = await supabase
          .from("teachers")
          .select("profile_id, turnos_disponiveis")
          .eq("escola_id", escolaIdResolved)
          .in("profile_id", profileIds);

        for (const row of teacherRows || []) {
          if (!row?.profile_id) continue;
          const turnos = Array.isArray(row.turnos_disponiveis) ? row.turnos_disponiveis : [];
          professorTurnosMap.set(row.profile_id, turnos as string[]);
        }
      }
    }

    const disciplinaSemTurno = new Set<string>();

    const disciplinaNeeds: DisciplinaNeed[] = (disciplinasRows || [])
      .map((row: any) => {
        const disciplinaId = row.curso_matriz?.disciplina_id ?? row.curso_matriz_id;
        const nome = row.curso_matriz?.disciplina?.nome ?? "Disciplina";
        const carga = row.carga_horaria_semanal ?? row.curso_matriz?.carga_horaria_semanal ?? 0;
        const entra = row.entra_no_horario ?? row.curso_matriz?.entra_no_horario ?? true;
        const requiresDouble = carga >= 3;
        const practical = isPracticalDiscipline(nome);
        let professorId = row.professor_id ?? null;
        if (professorId && turnoLabel) {
          const profileId = professorProfileMap.get(professorId) || null;
          const availableTurnos = profileId ? professorTurnosMap.get(profileId) || [] : [];
          if (!availableTurnos.includes(turnoLabel)) {
            disciplinaSemTurno.add(disciplinaId);
            professorId = null;
          }
        }
        return {
          disciplina_id: disciplinaId,
          nome,
          entra_no_horario: entra,
          carga_semanal: carga,
          professor_id: professorId,
          sala_id: null,
          requires_double: requiresDouble,
          is_practical: practical,
          is_science: isScienceDiscipline(nome),
          constraints: {
            max_por_dia: requiresDouble || practical ? 2 : 1,
            evitar_ultimo_tempo: false,
            evitar_primeiro_tempo: false,
            dias_bloqueados: [],
          },
        };
      })
      .filter((disc) => disc.entra_no_horario !== false);

    const { slotById, slotsByDay } = buildSlotIndex(slots);
    const occupiedByProfessor = new Map<string, Set<string>>();
    const occupiedBySala = new Map<string, Set<string>>();
    const occupiedByTurma = new Set<string>();

    const baseAssignments: ExistingAssignment[] = [];
    const existingCounts = new Map<string, number>();

    for (const row of quadroRows || []) {
      const isSameTurma = row.turma_id === body.turma_id;
      if (isSameTurma && !body.overwrite_unlocked) {
        occupiedByTurma.add(row.slot_id);
        baseAssignments.push({
          slot_id: row.slot_id,
          disciplina_id: row.disciplina_id,
          professor_id: row.professor_id,
          sala_id: row.sala_id,
          locked: true,
        });
      }

      if (!isSameTurma || !body.overwrite_unlocked) {
        if (row.professor_id) {
          const set = occupiedByProfessor.get(row.slot_id) || new Set();
          set.add(row.professor_id);
          occupiedByProfessor.set(row.slot_id, set);
        }
        if (row.sala_id) {
          const set = occupiedBySala.get(row.slot_id) || new Set();
          set.add(row.sala_id);
          occupiedBySala.set(row.slot_id, set);
        }
      }

      if (isSameTurma) {
        existingCounts.set(
          row.disciplina_id,
          (existingCounts.get(row.disciplina_id) || 0) + 1
        );
      }
    }

    const perDiscDayCount = new Map<string, Map<number, number>>();
    const dayTotals = new Map<number, number>();
    const dayDisciplines = new Map<number, Set<string>>();
    const dayAssignments = new Map<number, Map<number, string>>();

    for (const assignment of baseAssignments) {
      const slot = slotById.get(assignment.slot_id);
      if (!slot) continue;
      const day = slot.day;
      const discMap = perDiscDayCount.get(assignment.disciplina_id) || new Map();
      discMap.set(day, (discMap.get(day) || 0) + 1);
      perDiscDayCount.set(assignment.disciplina_id, discMap);
      dayTotals.set(day, (dayTotals.get(day) || 0) + 1);
      const daySet = dayDisciplines.get(day) || new Set();
      daySet.add(assignment.disciplina_id);
      dayDisciplines.set(day, daySet);
      const dayMap = dayAssignments.get(day) || new Map();
      const slotOrder = slot.ordem;
      dayMap.set(slotOrder, assignment.disciplina_id);
      dayAssignments.set(day, dayMap);
    }

    const missingByDisc = new Map<string, number>();
    const unmet: AutoScheduleResult["unmet"] = [];
    const trace: AutoScheduleResult["trace"] = [];

    for (const disciplina of disciplinaNeeds) {
      if (disciplina.carga_semanal <= 0) {
        unmet.push({
          disciplina_id: disciplina.disciplina_id,
          missing: 0,
          reason: "REGRAS",
        });
        continue;
      }
      const already = existingCounts.get(disciplina.disciplina_id) || 0;
      const missing = Math.max(0, disciplina.carga_semanal - already);
      missingByDisc.set(disciplina.disciplina_id, missing);
    }

    const sorted = sortDisciplines(disciplinaNeeds, missingByDisc);

    const placeAssignment = (assignment: ExistingAssignment) => {
      const slot = slotById.get(assignment.slot_id);
      if (!slot) return;
      occupiedByTurma.add(slot.id);
      if (assignment.professor_id) {
        const set = occupiedByProfessor.get(slot.id) || new Set();
        set.add(assignment.professor_id);
        occupiedByProfessor.set(slot.id, set);
      }
      if (assignment.sala_id) {
        const set = occupiedBySala.get(slot.id) || new Set();
        set.add(assignment.sala_id);
        occupiedBySala.set(slot.id, set);
      }
      const perDay = perDiscDayCount.get(assignment.disciplina_id) || new Map();
      perDay.set(slot.day, (perDay.get(slot.day) || 0) + 1);
      perDiscDayCount.set(assignment.disciplina_id, perDay);
      dayTotals.set(slot.day, (dayTotals.get(slot.day) || 0) + 1);
      const daySet = dayDisciplines.get(slot.day) || new Set();
      daySet.add(assignment.disciplina_id);
      dayDisciplines.set(slot.day, daySet);
      const dayMap = dayAssignments.get(slot.day) || new Map();
      dayMap.set(slot.ordem, assignment.disciplina_id);
      dayAssignments.set(slot.day, dayMap);
    };

    const doubleBlockTargets = new Map<string, number>();
    for (const disciplina of sorted) {
      if (disciplina.carga_semanal <= 0) continue;
      const maxBlocks = Math.floor((missingByDisc.get(disciplina.disciplina_id) || 0) / 2);
      if (disciplina.is_practical) {
        doubleBlockTargets.set(disciplina.disciplina_id, maxBlocks);
      } else if (disciplina.requires_double) {
        doubleBlockTargets.set(disciplina.disciplina_id, Math.min(1, maxBlocks));
      }
    }

    const placeDoubleBlocks = () => {
      for (const disciplina of sorted) {
        let remainingBlocks = doubleBlockTargets.get(disciplina.disciplina_id) || 0;
        if (remainingBlocks <= 0) continue;
        let missing = missingByDisc.get(disciplina.disciplina_id) || 0;
        if (missing < 2) continue;

        while (remainingBlocks > 0 && missing >= 2) {
          let placed = false;
          for (const slot of slots) {
            if (slot.is_intervalo) continue;
            if (occupiedByTurma.has(slot.id)) continue;
            if (!canUseDayForDiscipline({
              dayDisciplines,
              day: slot.day,
              disciplinaId: disciplina.disciplina_id,
            })) {
              continue;
            }
            const neighbor = getAdjacentSlot(slotsByDay, slot, 1);
            if (!neighbor || occupiedByTurma.has(neighbor.id)) continue;
            const perDay = perDiscDayCount.get(disciplina.disciplina_id) || new Map();
            const dayCount = perDay.get(slot.day) || 0;
            const maxPorDia = disciplina.constraints?.max_por_dia ?? 1;
            if (dayCount + 2 > maxPorDia) continue;
            if (disciplina.is_science) {
              if (
                wouldExceedScienceRunWithExtra({
                  dayAssignments,
                  slotsByDay,
                  day: slot.day,
                  disciplinaId: disciplina.disciplina_id,
                  extraOrdens: [slot.ordem, neighbor.ordem],
                })
              ) {
                continue;
              }
            }

            const first: ExistingAssignment = {
              slot_id: slot.id,
              disciplina_id: disciplina.disciplina_id,
              professor_id: disciplina.professor_id ?? null,
              sala_id: disciplina.sala_id ?? null,
            };
            const second: ExistingAssignment = {
              slot_id: neighbor.id,
              disciplina_id: disciplina.disciplina_id,
              professor_id: disciplina.professor_id ?? null,
              sala_id: disciplina.sala_id ?? null,
            };
            newAssignments.push(first, second);
            placeAssignment(first);
            placeAssignment(second);
            missing -= 2;
            missingByDisc.set(disciplina.disciplina_id, missing);
            remainingBlocks -= 1;
            placed = true;
            break;
          }

          if (!placed) break;
        }
      }
    };

    const newAssignments: ExistingAssignment[] = [];

    placeDoubleBlocks();

    const attemptPhase = (phase: "strict" | "relax") => {
      for (const disciplina of sorted) {
        const missing = missingByDisc.get(disciplina.disciplina_id) || 0;
        if (missing <= 0) continue;
        const perDay = perDiscDayCount.get(disciplina.disciplina_id) || new Map<number, number>();

        for (let i = 0; i < missing; i += 1) {
          const slot = pickSlot({
            disciplina,
            slots,
            slotById,
            slotsByDay,
            occupiedByTurma,
            occupiedByProfessor,
            occupiedBySala,
            perDayCount: perDay,
            dayTotals,
            dayDisciplines,
            dayAssignments,
            phase,
          });

          if (!slot) {
            trace.push({
              action: "FAIL",
              disciplina_id: disciplina.disciplina_id,
              reason: phase === "strict" ? "SEM_SLOTS_STRICT" : "SEM_SLOTS",
            });
            continue;
          }

          const assignment: ExistingAssignment = {
            slot_id: slot.id,
            disciplina_id: disciplina.disciplina_id,
            professor_id: disciplina.professor_id ?? null,
            sala_id: disciplina.sala_id ?? null,
          };

          newAssignments.push(assignment);
          placeAssignment(assignment);
          missingByDisc.set(
            disciplina.disciplina_id,
            (missingByDisc.get(disciplina.disciplina_id) || 0) - 1
          );
          trace.push({
            action: "PLACE",
            disciplina_id: disciplina.disciplina_id,
            slot_id: slot.id,
          });
        }
      }
    };

    attemptPhase("strict");
    attemptPhase("relax");

    for (const disciplina of disciplinaNeeds) {
      const missing = missingByDisc.get(disciplina.disciplina_id) || 0;
      if (missing > 0) {
        unmet.push({
          disciplina_id: disciplina.disciplina_id,
          missing,
          reason: disciplinaSemTurno.has(disciplina.disciplina_id)
            ? "PROF_TURNO"
            : disciplina.professor_id
              ? "SEM_SLOTS"
              : "SEM_PROF",
        });
      }
    }

    const assignments = [...baseAssignments, ...newAssignments];
    const totalSlots = slots.filter((slot) => !slot.is_intervalo).length;
    const filled = assignments.length;
    const unfilled = Math.max(0, totalSlots - filled);
    const disciplinasCompletas = disciplinaNeeds.filter(
      (d) => (missingByDisc.get(d.disciplina_id) || 0) === 0 && d.carga_semanal > 0
    ).length;
    const disciplinasIncompletas = disciplinaNeeds.filter(
      (d) => (missingByDisc.get(d.disciplina_id) || 0) > 0
    ).length;

    const result: AutoScheduleResult = {
      ok: true,
      assignments,
      stats: {
        total_slots: totalSlots,
        filled,
        unfilled,
        disciplinas_completas: disciplinasCompletas,
        disciplinas_incompletas: disciplinasIncompletas,
      },
      unmet,
      trace,
    };

    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
