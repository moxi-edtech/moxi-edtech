// src/app/api/escolas/[id]/onboarding/curriculum/apply/route.ts

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabaseServer";
import { hasPermission } from "@/lib/permissions";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";

// ✅ Agora importando do lib/onboarding (não mais de components)
import {
  CURRICULUM_PRESETS,
  type CurriculumKey,
  type CurriculumDisciplineBlueprint,
} from "@/lib/onboarding";

// -------------------------
// Auth helper
// -------------------------
async function authorize(escolaId: string) {
  const s = await supabaseServer();
  const { data: auth } = await s.auth.getUser();
  const user = auth?.user;

  if (!user) {
    return { ok: false as const, status: 401, error: "Não autenticado" };
  }

  let allowed = false;

  // super_admin global
  try {
    const { data: prof } = await s
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1);

    const role = (prof?.[0] as any)?.role as string | undefined;
    if (role === "super_admin") {
      allowed = true;
    }
  } catch {}

  // escola_usuarios com permissão adequada
  try {
    const { data: vinc } = await s
      .from("escola_usuarios")
      .select("papel")
      .eq("escola_id", escolaId)
      .eq("user_id", user.id)
      .maybeSingle();

    const papel = (vinc as any)?.papel as any | undefined;
    if (!allowed) {
      allowed =
        !!papel &&
        (hasPermission(papel, "configurar_escola") ||
          hasPermission(papel, "gerenciar_disciplinas"));
    }
  } catch {}

  // fallback: escola_administradores
  if (!allowed) {
    try {
      const { data: adminLink } = await s
        .from("escola_administradores")
        .select("user_id")
        .eq("escola_id", escolaId)
        .eq("user_id", user.id)
        .limit(1);
      allowed = Boolean(adminLink && (adminLink as any[]).length > 0);
    } catch {}
  }

  // fallback: profiles admin vinculado à escola
  if (!allowed) {
    try {
      const { data: prof } = await s
        .from("profiles")
        .select("role, escola_id")
        .eq("user_id", user.id)
        .eq("escola_id", escolaId)
        .limit(1);

      allowed = Boolean(
        prof && prof.length > 0 && (prof[0] as any).role === "admin"
      );
    } catch {}
  }

  if (!allowed) {
    return { ok: false as const, status: 403, error: "Sem permissão" };
  }

  // Hard check: perfil deve pertencer à escola
  try {
    const { data: profCheck } = await s
      .from("profiles" as any)
      .select("escola_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profCheck || (profCheck as any).escola_id !== escolaId) {
      return {
        ok: false as const,
        status: 403,
        error: "Perfil não vinculado à escola",
      };
    }
  } catch {}

  return { ok: true as const };
}

// -------------------------
// Zod Schema
// -------------------------
const bodySchema = z.object({
  presetKey: z.string().trim(),
  matrix: z
    .array(
      z.object({
        classe: z.string(),
        qtyManha: z.number().int().nonnegative().optional(),
        qtyTarde: z.number().int().nonnegative().optional(),
        qtyNoite: z.number().int().nonnegative().optional(),
      })
    )
    .optional(),
  sessionId: z.string().optional(),
});

// ✅ Assinatura no padrão App Router (sem Promise em params)
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const escolaId = params.id;

  try {
    const authz = await authorize(escolaId);
    if (!authz.ok) {
      return NextResponse.json(
        { ok: false, error: authz.error },
        { status: authz.status }
      );
    }

    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY
    ) {
      return NextResponse.json(
        { ok: false, error: "Configuração Supabase ausente." },
        { status: 500 }
      );
    }

    const json = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message || "Dados inválidos";
      return NextResponse.json({ ok: false, error: msg }, { status: 400 });
    }

    const { presetKey: presetKeyRaw } = parsed.data;

    const allKeys = Object.keys(
      CURRICULUM_PRESETS
    ) as unknown as CurriculumKey[];
    const isValidKey = allKeys.includes(presetKeyRaw as CurriculumKey);
    if (!isValidKey) {
      return NextResponse.json(
        {
          ok: false,
          error: `Modelo curricular inválido: ${presetKeyRaw}`,
        },
        { status: 400 }
      );
    }
    const presetKey = presetKeyRaw as CurriculumKey;

    const admin = createAdminClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // -------------------------------------------------------------------
    // 0) Carrega diretamente o blueprint do lib (já é array de disciplinas)
    // -------------------------------------------------------------------
    const blueprint: CurriculumDisciplineBlueprint[] =
      CURRICULUM_PRESETS[presetKey] || [];

    if (!blueprint || blueprint.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "Modelo curricular não possui disciplinas definidas.",
        },
        { status: 400 }
      );
    }

    // -------------------------------------------------------------------
    // 1) Carregar classes, cursos e disciplinas existentes da escola
    // -------------------------------------------------------------------
    const [classesRes, cursosRes, disciplinasRes] = await Promise.all([
      (admin as any)
        .from("classes")
        .select("id, nome, nivel")
        .eq("escola_id", escolaId),
      (admin as any)
        .from("cursos")
        .select("id, nome")
        .eq("escola_id", escolaId),
      (admin as any)
        .from("disciplinas")
        .select("id, nome, curso_id, classe_id")
        .eq("escola_id", escolaId),
    ]);

    if (classesRes.error) {
      return NextResponse.json(
        { ok: false, error: classesRes.error.message },
        { status: 400 }
      );
    }
    if (cursosRes.error) {
      return NextResponse.json(
        { ok: false, error: cursosRes.error.message },
        { status: 400 }
      );
    }
    if (disciplinasRes.error) {
      return NextResponse.json(
        { ok: false, error: disciplinasRes.error.message },
        { status: 400 }
      );
    }

    const existingClasses = (classesRes.data || []) as {
      id: string;
      nome: string;
      nivel: string | null;
    }[];

    const existingCursos = (cursosRes.data || []) as {
      id: string;
      nome: string;
    }[];

    const existingDisciplinas = (disciplinasRes.data || []) as {
      id: string;
      nome: string;
      curso_id: string | null;
      classe_id: string | null;
    }[];

    // Mapas auxiliares
    const classKey = (nivel: string | null | undefined, nome: string) =>
      `${nivel || ""}::${nome.trim().toLowerCase()}`;
    const courseKey = (nome: string) => nome.trim().toLowerCase();
    const disciplineKey = (
      nome: string,
      classeId?: string | null,
      cursoId?: string | null
    ) =>
      `${nome.trim().toLowerCase()}::${classeId || ""}::${cursoId || ""}`;

    const classMap = new Map<
      string,
      { id: string; nome: string; nivel: string | null }
    >();
    existingClasses.forEach((c) =>
      classMap.set(classKey(c.nivel, c.nome), c)
    );

    const courseMap = new Map<string, { id: string; nome: string }>();
    existingCursos.forEach((c) => courseMap.set(courseKey(c.nome), c));

    const disciplinaMap = new Map<
      string,
      { id: string; nome: string; curso_id: string | null; classe_id: string | null }
    >();
    existingDisciplinas.forEach((d) =>
      disciplinaMap.set(disciplineKey(d.nome, d.classe_id, d.curso_id), d)
    );

    // -------------------------------------------------------------------
    // 2) Determinar quais classes e cursos precisam ser criados
    // -------------------------------------------------------------------
    const pendingClassKeys = new Map<
      string,
      { nome: string; nivel: string | null }
    >();
    const pendingCourseKeys = new Map<string, { nome: string }>();

    for (const disc of blueprint) {
      const nivel = disc.nivel || null;
      const nomeClasse = disc.classe.trim();
      const nomeCurso = disc.curso?.trim();

      const ck = classKey(nivel, nomeClasse);
      if (!classMap.has(ck) && !pendingClassKeys.has(ck)) {
        pendingClassKeys.set(ck, { nome: nomeClasse, nivel });
      }

      if (nomeCurso) {
        const k = courseKey(nomeCurso);
        if (!courseMap.has(k) && !pendingCourseKeys.has(k)) {
          pendingCourseKeys.set(k, { nome: nomeCurso });
        }
      }
    }

    // -------------------------------------------------------------------
    // 3) Inserir classes pendentes
    // -------------------------------------------------------------------
    let createdClassesCount = 0;
    let reusedClassesCount = existingClasses.length;

    if (pendingClassKeys.size > 0) {
      const toInsert = Array.from(pendingClassKeys.values()).map((c, idx) => ({
        escola_id: escolaId,
        nome: c.nome,
        nivel: c.nivel,
        ordem: existingClasses.length + idx + 1,
      }));

      const { data: insertedClasses, error: insertClassesError } = await (admin as any)
        .from("classes")
        .insert(toInsert as any)
        .select("id, nome, nivel");

      if (insertClassesError) {
        return NextResponse.json(
          { ok: false, error: insertClassesError.message },
          { status: 400 }
        );
      }

      createdClassesCount = insertedClasses?.length || 0;
      insertedClasses?.forEach((c: any) =>
        classMap.set(classKey(c.nivel, c.nome), c)
      );
    }

    const totalClassesAfter = classMap.size;

    // -------------------------------------------------------------------
    // 4) Inserir cursos pendentes
    // -------------------------------------------------------------------
    let createdCursosCount = 0;
    let reusedCursosCount = existingCursos.length;

    if (pendingCourseKeys.size > 0) {
      const toInsert = Array.from(pendingCourseKeys.values()).map((c) => ({
        escola_id: escolaId,
        nome: c.nome,
      }));

      const { data: insertedCursos, error: insertCursosError } = await (admin as any)
        .from("cursos")
        .insert(toInsert as any)
        .select("id, nome");

      if (insertCursosError) {
        return NextResponse.json(
          { ok: false, error: insertCursosError.message },
          { status: 400 }
        );
      }

      createdCursosCount = insertedCursos?.length || 0;
      insertedCursos?.forEach((c: any) =>
        courseMap.set(courseKey(c.nome), c)
      );
    }

    const totalCursosAfter = courseMap.size;

    // -------------------------------------------------------------------
    // 5) Determinar disciplinas pendentes e inserir
    // -------------------------------------------------------------------
    const pendingDisciplinas: {
      nome: string;
      tipo: "core" | "eletivo";
      escola_id: string;
      curso_id: string | null;
      classe_id: string | null;
    }[] = [];

    for (const disc of blueprint) {
      const nivel = disc.nivel || null;
      const nomeClasse = disc.classe.trim();
      const nomeCurso = disc.curso?.trim();
      const nomeDisciplina = disc.nome.trim();
      const tipo = disc.tipo || "core";

      const cKey = classKey(nivel, nomeClasse);
      const classRow = classMap.get(cKey);

      let courseRow: { id: string; nome: string } | undefined;
      if (nomeCurso) {
        const k = courseKey(nomeCurso);
        courseRow = courseMap.get(k);
      }

      const dKey = disciplineKey(
        nomeDisciplina,
        classRow?.id ?? null,
        courseRow?.id ?? null
      );
      if (!disciplinaMap.has(dKey)) {
        pendingDisciplinas.push({
          nome: nomeDisciplina,
          tipo,
          escola_id: escolaId,
          curso_id: courseRow?.id ?? null,
          classe_id: classRow?.id ?? null,
        });
        disciplinaMap.set(dKey, {
          id: "pending",
          nome: nomeDisciplina,
          curso_id: courseRow?.id ?? null,
          classe_id: classRow?.id ?? null,
        });
      }
    }

    let createdDisciplinasCount = 0;
    let reusedDisciplinasCount = existingDisciplinas.length;

    if (pendingDisciplinas.length > 0) {
      const { data: insertedDisc, error: insertDiscError } = await (admin as any)
        .from("disciplinas")
        .insert(
          pendingDisciplinas.map((d) => ({
            escola_id: d.escola_id,
            nome: d.nome,
            tipo: d.tipo,
            curso_id: d.curso_id,
            classe_id: d.classe_id,
          })) as any
        )
        .select("id, nome, curso_id, classe_id");

      if (insertDiscError) {
        return NextResponse.json(
          { ok: false, error: insertDiscError.message },
          { status: 400 }
        );
      }

      createdDisciplinasCount = insertedDisc?.length || 0;
      insertedDisc?.forEach((d: any) =>
        disciplinaMap.set(
          disciplineKey(d.nome, d.classe_id, d.curso_id),
          d
        )
      );
    }

    const totalDisciplinasAfter = disciplinaMap.size;

    // -------------------------------------------------------------------
    // 6) Summary para o front
    // -------------------------------------------------------------------
    const summary = {
      classes: {
        created: createdClassesCount,
        reused: reusedClassesCount,
        totalAfter: totalClassesAfter,
      },
      cursos: {
        created: createdCursosCount,
        reused: reusedCursosCount,
        totalAfter: totalCursosAfter,
      },
      disciplinas: {
        created: createdDisciplinasCount,
        reused: reusedDisciplinasCount,
        totalAfter: totalDisciplinasAfter,
      },
    };

    return NextResponse.json({
      ok: true,
      presetKey,
      summary,
    });
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "Erro inesperado ao aplicar currículo.";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
