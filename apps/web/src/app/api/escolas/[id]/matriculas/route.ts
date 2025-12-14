import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { supabaseServerTyped } from "@/lib/supabaseServer";

type EnrollmentRow = {
  id: string;
  escola_id: string;
  ano_letivo_id: string;
  classe_id: string;
  course_id: string | null;
  turma_id: string | null;
  aluno_id: string;
  status: string | null;
  created_at: string | null;
};

type StudentRow = {
  id: string;
  nome: string;
  email?: string | null;
};

type GradeRow = {
  id: string;
  nome: string;
};

type CourseRow = {
  id: string;
  nome: string;
  type?: string | null;
  duration?: number | null;
};

type SchoolClassRow = {
  id: string;
  nome: string;
  shift?: string | null;
};

type EnrollmentWithRelations = EnrollmentRow & {
  aluno: StudentRow | null;
  turma: SchoolClassRow | null;
  classe: GradeRow | null;
  curso: CourseRow | null;
};

type ApiDatabase = {
  public: {
    Tables: {
      matriculas: {
        Row: EnrollmentRow;
        Insert: EnrollmentRow;
        Update: Partial<EnrollmentRow>;
        Relationships: unknown[];
      };
      alunos: { Row: StudentRow; Insert: StudentRow; Update: Partial<StudentRow>; Relationships: unknown[] };
      school_classes: {
        Row: SchoolClassRow;
        Insert: SchoolClassRow;
        Update: Partial<SchoolClassRow>;
        Relationships: unknown[];
      };
      grades: { Row: GradeRow; Insert: GradeRow; Update: Partial<GradeRow>; Relationships: unknown[] };
      courses: { Row: CourseRow; Insert: CourseRow; Update: Partial<CourseRow>; Relationships: unknown[] };
    };
    Views: {};
    Functions: {};
    Enums: {};
    CompositeTypes: {};
  };
};

const querySchema = z
  .object({
    anoLetivoId: z.string().min(1, "anoLetivoId é obrigatório"),
    classeId: z.string().min(1, "classeId é obrigatório"),
    courseId: z.string().min(1).optional(),
    turmaId: z.string().min(1).optional(),
    scope: z.enum(["all", "pending", "turma"]).default("all"),
  })
  .superRefine((value, ctx) => {
    if (value.scope === "turma" && !value.turmaId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "turmaId é obrigatório quando scope=turma" });
    }
  });

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: escolaId } = await params;

  try {
    const searchParams = req.nextUrl.searchParams;
    const parsed = querySchema.safeParse({
      anoLetivoId: searchParams.get("anoLetivoId"),
      classeId: searchParams.get("classeId"),
      courseId: searchParams.get("courseId") || undefined,
      turmaId: searchParams.get("turmaId") || undefined,
      scope: (searchParams.get("scope") as "all" | "pending" | "turma" | null) ?? undefined,
    });

    if (!parsed.success) {
      const msg = parsed.error.issues?.[0]?.message || "Parâmetros inválidos";
      return NextResponse.json({ ok: false, error: msg }, { status: 400 });
    }

    const { anoLetivoId, classeId, courseId, turmaId, scope } = parsed.data;

    const supabase = await supabaseServerTyped<ApiDatabase>();

    let query = supabase
      .from("matriculas")
      .select(
        `
        id,
        escola_id,
        ano_letivo_id,
        classe_id,
        course_id,
        turma_id,
        aluno_id,
        status,
        created_at,
        aluno:alunos(id, nome, email),
        turma:school_classes(id, nome, shift),
        classe:grades(id, nome),
        curso:courses(id, nome, type, duration)
      `
      )
      .eq("escola_id", escolaId)
      .eq("ano_letivo_id", anoLetivoId)
      .eq("classe_id", classeId)
      .order("created_at", { ascending: false });

    if (courseId) query = query.eq("course_id", courseId);

    if (scope === "pending") {
      query = query.is("turma_id", null);
    } else if (scope === "turma" && turmaId) {
      query = query.eq("turma_id", turmaId);
    }

    const { data, error } = await query.returns<EnrollmentWithRelations[]>();

    if (error) {
      console.error("[matriculas:list]", error.message);
      return NextResponse.json({ ok: false, error: "Falha ao carregar matrículas" }, { status: 500 });
    }

    const total = data?.length ?? 0;
    const pendentes = data?.filter((row) => row.turma_id === null).length ?? 0;

    return NextResponse.json({
      ok: true,
      filters: { escolaId, anoLetivoId, classeId, courseId: courseId ?? null, scope, turmaId: turmaId ?? null },
      meta: { total, pendentes },
      matriculas: data ?? [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado";
    console.error("[matriculas:list] fatal", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
