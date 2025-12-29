type CourseRef = {
  id?: string | null;
  codigo?: string | null;
  course_code?: string | null;
  curriculum_key?: string | null;
  courseType?: string | null;
  tipo?: string | null;
};

const normalize = (value?: string | number | null) =>
  value === undefined || value === null ? "" : String(value).trim().toLowerCase();

const collectItemKeys = (item: any) => {
  if (!item) return [] as string[];
  return [
    item.curso_id,
    item.curso_escola_id,
    item.curso,
    item.cursoId,
    item.course_id,
    item.courseId,
    item.codigo,
    item.course_code,
    item.curso_codigo,
  ].filter(Boolean).map(normalize);
};

const collectItemTypes = (item: any) => {
  if (!item) return [] as string[];
  return [item.courseType, item.course_type, item.curriculum_key, item.tipo]
    .filter(Boolean)
    .map(normalize);
};

export const matchesCourse = (item: any, course?: CourseRef | string | null) => {
  if (!course) return true;

  const courseId = typeof course === "string" ? course : course.id;
  const courseCode = typeof course === "string" ? null : course.codigo || course.course_code;
  const courseType =
    typeof course === "string" ? null : course.courseType || course.tipo || course.curriculum_key;

  const targets = [courseId, courseCode].filter(Boolean).map(normalize);
  const typeTargets = [courseType, typeof course === "string" ? null : course.curriculum_key]
    .filter(Boolean)
    .map(normalize);

  const itemKeys = collectItemKeys(item);
  const itemTypes = collectItemTypes(item);

  if (targets.length > 0 && itemKeys.some((key) => targets.includes(key))) return true;
  if (typeTargets.length > 0 && itemTypes.some((key) => typeTargets.includes(key))) return true;

  return targets.length === 0 && typeTargets.length === 0;
};

export const filterItemsByCourse = <T = any>(items: T[], course?: CourseRef | string | null): T[] => {
  if (!Array.isArray(items)) return [] as T[];
  return items.filter((item) => matchesCourse(item, course));
};

