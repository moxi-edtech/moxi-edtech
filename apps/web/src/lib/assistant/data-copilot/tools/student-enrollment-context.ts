import { supabaseServerTyped } from "@/lib/supabaseServer";
import { createDataCopilotResponse } from "../answer-composer";
import type { DataCopilotTool } from "../types";

/** Read-only, tenant-scoped enrollment context. Never trusts a client-provided student ID. */
export const studentEnrollmentContextTool: DataCopilotTool = {
  id: "student-enrollment-context",
  module: "secretaria",
  requiredPermission: "assistant.secretaria",
  match: (query, context) => context?.entityType === "student" && Boolean(context.entityId) &&
    /matr[ií]cul|turma|classe|perfil|aluno|situa[cç][aã]o/i.test(query),
  async run({ schoolId, role, context }) {
    const studentId = context?.entityId;
    if (!studentId || !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(studentId)) return null;
    const supabase = await supabaseServerTyped();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data: membership, error: membershipError } = await supabase.from("escola_users")
      .select("papel").eq("escola_id", schoolId).eq("user_id", user.id).maybeSingle();
    if (membershipError || !membership || String(membership.papel).toLowerCase() !== role) return null;
    const { data: student, error: studentError } = await supabase.from("alunos")
      .select("id").eq("id", studentId).eq("escola_id", schoolId).maybeSingle();
    if (studentError) throw studentError;
    if (!student) return null;
    const { data: enrollments, error: enrollmentError } = await supabase.from("matriculas")
      .select("id,turma_id,status,ano_letivo_id").eq("aluno_id", studentId).eq("escola_id", schoolId)
      .limit(10);
    if (enrollmentError) throw enrollmentError;
    const rows = enrollments ?? [];
    return createDataCopilotResponse({
      insight: {
        severity: "info",
        diagnosis: rows.length ? `Existem ${rows.length} matrícula(s) nos registos consultados desta escola.` : "Não encontrei matrículas deste aluno nos registos consultados desta escola.",
        impact: "Consulta de leitura; nenhuma matrícula foi modificada.",
        recommendation: "Confirme o ano lectivo e a matrícula pretendida antes de preparar uma correcção. A operação exige a autorização do serviço canónico.",
        evidence: [
          { label: "Matrículas consultadas", value: String(rows.length) },
          ...rows.map((row, index) => ({ label: `Matrícula ${index + 1}`, value: `ID ${row.id}; turma ${row.turma_id ?? "não atribuída"}; ano ${row.ano_letivo_id ?? "não definido"}; estado ${row.status ?? "não definido"}` })),
        ],
        actions: [],
      },
    });
  },
};
