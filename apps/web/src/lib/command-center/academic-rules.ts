/** Contracto configurável pelo estabelecimento. A ausência de uma regra nunca
 * transforma um indicador desconhecido em "documentos em falta" ou "matrícula
 * incompleta". A Secretaria sinaliza separadamente DOCUMENTOS_PENDENTES.
 *
 * Variável privada KLASSE_CC_ACADEMIC_RULES_JSON (só no servidor):
 * {
 *   "<uuid-escola>": {
 *     "classes": {
 *       "<uuid-classe>": {
 *         "<tipo-de-aluno-canonico>": {
 *           "requiredDocumentCodes": ["codigo-validado-na-escola"],
 *           "incompleteEnrollmentStatuses": ["estado-canonico-validado"],
 *           "approved": true
 *         }
 *       }
 *     }
 *   }
 * }
 */
export type AcademicRule = Readonly<{
  approved: true;
  requiredDocumentCodes: readonly string[];
  incompleteEnrollmentStatuses: readonly string[];
}>;

export type AcademicRuleAvailability =
  | { enabled: true; rule: AcademicRule }
  | { enabled: false; reason: string };

const UNCONFIGURED_REASON =
  "Os documentos obrigatórios e os estados de matrícula incompleta ainda não foram aprovados para esta classe e tipo de aluno.";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CODE = /^[\p{L}\p{N}_-]{2,64}$/u;

function record(input: unknown): Record<string, unknown> | null {
  return input && typeof input === "object" && !Array.isArray(input)
    ? input as Record<string, unknown> : null;
}

function codes(input: unknown): string[] | null {
  if (!Array.isArray(input) || input.length === 0 || input.length > 30
      || !input.every(x => typeof x === "string" && CODE.test(x))
      || new Set(input).size !== input.length) return null;
  return input;
}

/** Resolve regras *exactas* por escola + classe + tipo de aluno, sem fallback.
 * Nunca recebe nomes, números de processo, documentos ou outros dados pessoais.
 */
export function resolveAcademicRule(
  schoolId: string,
  classId: string,
  studentType: string,
  json: string | undefined,
): AcademicRuleAvailability {
  if (!UUID.test(schoolId) || !UUID.test(classId) || !CODE.test(studentType) || !json)
    return { enabled: false, reason: UNCONFIGURED_REASON };
  try {
    const root = record(JSON.parse(json));
    const school = record(root?.[schoolId]);
    const classes = record(school?.classes);
    const classConfig = record(classes?.[classId]);
    const rule = record(classConfig?.[studentType]);
    if (rule?.approved !== true) return { enabled: false, reason: UNCONFIGURED_REASON };
    const requiredDocumentCodes = codes(rule.requiredDocumentCodes);
    const incompleteEnrollmentStatuses = codes(rule.incompleteEnrollmentStatuses);
    if (!requiredDocumentCodes || !incompleteEnrollmentStatuses)
      return { enabled: false, reason: "Configuração incompleta. Valide os códigos de documentos e estados académicos." };
    return {
      enabled: true,
      rule: { approved: true, requiredDocumentCodes, incompleteEnrollmentStatuses },
    };
  } catch {
    return { enabled: false, reason: "Configuração inválida. Contacte a administração da escola." };
  }
}

export const INCOMPLETE_FILTER_UNAVAILABLE_REASON = UNCONFIGURED_REASON;
