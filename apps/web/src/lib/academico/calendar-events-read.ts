/**
 * Calendar read contract (not a write authority):
 * - one school and academic-year identity;
 * - global events belong to everyone in that year;
 * - offering-scoped events belong ONLY to the authorized course offering;
 * - ambiguous or missing course mappings never broaden visibility.
 *
 * This module is shared by student, professor and secretaria consumers.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class CalendarEventScopeError extends Error {
  constructor(
    public readonly code: "CALENDAR_COURSE_NOT_MAPPED" | "CALENDAR_COURSE_AMBIGUOUS" | "CALENDAR_INVALID_SCOPE",
    message: string,
  ) {
    super(message);
    this.name = "CalendarEventScopeError";
  }
}

export function validateCalendarEventScope(input: {
  escolaId: string;
  anoLetivoId: string;
  offeringIds: string[];
}): void {
  const ids = [input.escolaId, input.anoLetivoId, ...input.offeringIds];
  if (ids.some((id) => !UUID.test(id)) ||
      new Set(input.offeringIds).size !== input.offeringIds.length) {
    throw new CalendarEventScopeError("CALENDAR_INVALID_SCOPE", "Contexto do calendário inválido.");
  }
}

export function isCalendarEventVisibleToOfferings(
  event: { offering_id: string | null },
  authorizedOfferingIds: readonly string[],
): boolean {
  return event.offering_id === null || authorizedOfferingIds.includes(event.offering_id);
}

/**
 * Resolve a school's active course mapping. The course_id comes from a
 * previously authorized turma/matricula, never directly from a query param.
 * A missing or duplicated mapping is an error, not permission to see all.
 */
export async function resolveCalendarOfferingForCourse(
  supabase: any,
  input: { escolaId: string; cursoId: string },
): Promise<string> {
  if (!UUID.test(input.escolaId) || !UUID.test(input.cursoId)) {
    throw new CalendarEventScopeError("CALENDAR_INVALID_SCOPE", "Curso inválido para o calendário.");
  }
  const { data, error } = await supabase
    .from("school_education_offerings")
    .select("id")
    .eq("escola_id", input.escolaId)
    .eq("course_id", input.cursoId)
    .eq("status", "active")
    .limit(2);
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new CalendarEventScopeError(
      "CALENDAR_COURSE_NOT_MAPPED",
      "O curso precisa de ser associado ao calendário académico.",
    );
  }
  if (data.length !== 1) {
    throw new CalendarEventScopeError(
      "CALENDAR_COURSE_AMBIGUOUS",
      "Existem várias ofertas ativas para o mesmo curso. É necessária conciliação.",
    );
  }
  return String(data[0].id);
}

/**
 * Pass only offering IDs established by trusted server-side memberships.
 * RLS still applies; never use an admin/service-role Supabase client here.
 *
 * Admin calendar management may intentionally display all offers and should
 * use an explicit separate mode, not pass an empty array to broaden access.
 */
export async function readScopedAcademicCalendarEvents<T = Record<string, unknown>>(
  supabase: any,
  input: {
    escolaId: string;
    anoLetivoId: string;
    offeringIds: string[];
    rangeStart?: string;
    rangeEnd?: string;
    limit?: number;
    columns?: string;
  },
): Promise<T[]> {
  validateCalendarEventScope(input);
  const maxRows = Math.min(200, Math.max(1, input.limit ?? 50));
  let query = supabase
    .from("calendario_eventos")
    .select(input.columns ?? "*")
    .eq("escola_id", input.escolaId)
    .eq("ano_letivo_id", input.anoLetivoId);
  if (input.offeringIds.length === 0) {
    query = query.is("offering_id", null);
  } else {
    query = query.or(
      `offering_id.is.null,offering_id.in.(${input.offeringIds.join(",")})`,
    );
  }
  if (input.rangeStart) query = query.gte("data_fim", input.rangeStart);
  if (input.rangeEnd) query = query.lte("data_inicio", input.rangeEnd);
  const { data, error } = await query
    .order("data_inicio", { ascending: true })
    .order("id", { ascending: true })
    .limit(maxRows);
  if (error) throw error;
  return (data ?? []) as T[];
}

/**
 * Resolve all linked course offerings in a single scoped request.
 * A teacher may cover several courses; every selected course must resolve
 * to exactly one active school offering. No fallback to a school-wide view.
 */
export async function resolveCalendarOfferingIdsForCourses(
  supabase: any,
  input: { escolaId: string; cursoIds: string[] },
): Promise<string[]> {
  if (!UUID.test(input.escolaId) || input.cursoIds.some((id) => !UUID.test(id))) {
    throw new CalendarEventScopeError("CALENDAR_INVALID_SCOPE", "Cursos inválidos para o calendário.");
  }
  const courseIds = [...new Set(input.cursoIds)];
  if (courseIds.length === 0) return [];
  const { data, error } = await supabase
    .from("school_education_offerings")
    .select("id,course_id")
    .eq("escola_id", input.escolaId)
    .eq("status", "active")
    .in("course_id", courseIds)
    .limit(500);
  if (error) throw error;
  const mapped = new Map<string, string>();
  for (const offering of data ?? []) {
    if (!courseIds.includes(String(offering.course_id)) ||
      mapped.has(String(offering.course_id))) {
      throw new CalendarEventScopeError(
        "CALENDAR_COURSE_AMBIGUOUS",
        "As ofertas educativas dos cursos precisam de conciliação.",
      );
    }
    mapped.set(String(offering.course_id), String(offering.id));
  }
  if (mapped.size !== courseIds.length) {
    throw new CalendarEventScopeError(
      "CALENDAR_COURSE_NOT_MAPPED",
      "Um dos cursos não está associado ao calendário académico.",
    );
  }
  return [...new Set(courseIds.map((id) => mapped.get(id)!))];
}
