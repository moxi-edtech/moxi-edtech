import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabaseServer";
import { hasPermission } from "@/lib/permissions";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";

const ScopeEnum = z.enum(["session", "config", "all"]);
const IncludeEnum = z.enum([
  "semestres",
  "turmas",
  "matriculas",
  "classes",
  "disciplinas",
  "cursos",
]);

const schema = z.object({
  scope: ScopeEnum.default("session"),
  sessionId: z.string().uuid().optional(),
  include: z.array(IncludeEnum).optional(),
  dryRun: z.boolean().optional().default(true),
  force: z.boolean().optional().default(false),
  confirmPhrase: z.string().optional(),
});

type Counts = Partial<Record<z.infer<typeof IncludeEnum>, number>>;

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: escolaId } = await context.params;
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message || "Dados inválidos";
      return NextResponse.json({ ok: false, error: msg }, { status: 400 });
    }
    const { scope, sessionId: sessionIdRaw, include, dryRun, force, confirmPhrase } = parsed.data;

    const s = await supabaseServer();
    const { data: auth } = await s.auth.getUser();
    const user = auth?.user;
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    // Autorização: mesmo padrão das rotas de configuração
    let allowed = false;
    // super_admin
    try {
      const { data: prof } = await s
        .from("profiles")
        .select("role")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1);
      const role = (prof?.[0] as any)?.role as string | undefined;
      if (role === "super_admin") allowed = true;
    } catch {}
    // vinculado com permissão
    try {
      const { data: vinc } = await s
        .from("escola_usuarios")
        .select("papel")
        .eq("escola_id", escolaId)
        .eq("user_id", user.id)
        .maybeSingle();
      const papel = (vinc as any)?.papel as any | undefined;
      if (!allowed) allowed = !!papel && hasPermission(papel, "configurar_escola");
    } catch {}
    // fallback admin explícito
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
    // fallback profiles admin vinculado à escola
    if (!allowed) {
      try {
        const { data: prof } = await s
          .from("profiles")
          .select("role, escola_id")
          .eq("user_id", user.id)
          .eq("escola_id", escolaId)
          .limit(1);
        allowed = Boolean(prof && prof.length > 0 && (prof[0] as any).role === "admin");
      } catch {}
    }
    if (!allowed) return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 });

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: "Configuração Supabase ausente." }, { status: 500 });
    }
    const admin = createAdminClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Buscar nome da escola para confirmação e utilidades
    let escolaNome: string | null = null;
    try {
      const { data } = await (admin as any)
        .from("escolas")
        .select("nome")
        .eq("id", escolaId)
        .maybeSingle();
      escolaNome = (data as any)?.nome || null;
    } catch {}

    // Determinar sessionId relevante quando necessário
    let sessionId = sessionIdRaw;
    const needsSession = scope === "session" || scope === "all";
    if (needsSession && !sessionId) {
      try {
        const { data } = await (admin as any)
          .from("school_sessions")
          .select("id")
          .eq("escola_id", escolaId)
          .eq("status", "ativa")
          .limit(1);
        const active = Array.isArray(data) ? (data as any[])[0] : null;
        sessionId = active?.id as string | undefined;
      } catch {}
    }
    if (needsSession && !sessionId) {
      return NextResponse.json({ ok: false, error: "Sessão ativa não encontrada. Informe sessionId." }, { status: 400 });
    }

    // Normaliza includes por escopo
    const defaultSessionIncludes: z.infer<typeof IncludeEnum>[] = [
      "matriculas",
      "turmas",
      "semestres",
    ];
    const defaultConfigIncludes: z.infer<typeof IncludeEnum>[] = [
      "disciplinas",
      "classes",
      "cursos",
    ];
    const normalizedIncludes = (() => {
      const set = new Set<z.infer<typeof IncludeEnum>>();
      if (!include || include.length === 0) {
        if (scope === "session") defaultSessionIncludes.forEach((i) => set.add(i));
        else if (scope === "config") defaultConfigIncludes.forEach((i) => set.add(i));
        else {
          defaultSessionIncludes.forEach((i) => set.add(i));
          defaultConfigIncludes.forEach((i) => set.add(i));
        }
      } else {
        include.forEach((i) => set.add(i));
      }
      return Array.from(set.values());
    })();

    // Helpers
    const safeCount = async (
      table: string,
      filters: Array<[string, string | number]>
    ): Promise<number> => {
      try {
        let q: any = (admin as any).from(table).select("id", { count: "exact", head: true });
        for (const [col, val] of filters) q = q.eq(col, val as any);
        const res = await q;
        return res?.count ?? 0;
      } catch {
        return 0;
      }
    };

    const safeDelete = async (
      table: string,
      filters: Array<[string, string | number]>
    ): Promise<{ ok: boolean; error?: string; deleted?: number }> => {
      try {
        const toDelete = await safeCount(table, filters);
        let q: any = (admin as any).from(table).delete();
        for (const [col, val] of filters) q = q.eq(col, val as any);
        const { error } = await q;
        if (error) return { ok: false, error: error.message };
        return { ok: true, deleted: toDelete };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { ok: false, error: msg };
      }
    };

    // Compute counts
    const counts: Counts = {};
    const addCount = async (key: z.infer<typeof IncludeEnum>, table: string, filters: Array<[string, string | number]>) => {
      if (!normalizedIncludes.includes(key)) return;
      counts[key] = await safeCount(table, filters);
    };

    // Session-scoped
    if ((scope === "session" || scope === "all") && sessionId) {
      await addCount("matriculas", "matriculas", [["session_id", sessionId]]);
      await addCount("turmas", "turmas", [["session_id", sessionId]]);
      await addCount("semestres", "semestres", [["session_id", sessionId]]);
    }
    // Config-scoped (school wide)
    if (scope === "config" || scope === "all") {
      await addCount("disciplinas", "disciplinas", [["escola_id", escolaId]]);
      await addCount("classes", "classes", [["escola_id", escolaId]]);
      await addCount("cursos", "cursos", [["escola_id", escolaId]]);
    }

    if (dryRun) {
      return NextResponse.json({ ok: true, counts, escolaNome, sessionId });
    }

    // Execução: confirmar frase
    if (escolaNome && (confirmPhrase || "").trim() !== String(escolaNome).trim()) {
      return NextResponse.json({ ok: false, error: "Frase de confirmação incorreta." }, { status: 400 });
    }

    // Execução em ordem segura
    const deleted: Counts = {};
    const warnings: string[] = [];

    // Session portion: matriculas -> turmas -> semestres
    if ((scope === "session" || scope === "all") && sessionId) {
      if (normalizedIncludes.includes("matriculas")) {
        const res = await safeDelete("matriculas", [["session_id", sessionId]]);
        if (!res.ok) warnings.push(`matriculas: ${res.error}`); else deleted.matriculas = res.deleted || 0;
      }
      if (normalizedIncludes.includes("turmas")) {
        const res = await safeDelete("turmas", [["session_id", sessionId]]);
        if (!res.ok) warnings.push(`turmas: ${res.error}`); else deleted.turmas = res.deleted || 0;
      }
      if (normalizedIncludes.includes("semestres")) {
        const res = await safeDelete("semestres", [["session_id", sessionId]]);
        if (!res.ok) warnings.push(`semestres: ${res.error}`); else deleted.semestres = res.deleted || 0;
      }
    }

    // Config portion: disciplinas -> classes -> cursos (disciplinas primeiro devido a FKs)
    if (scope === "config" || scope === "all") {
      if (normalizedIncludes.includes("disciplinas")) {
        const res = await safeDelete("disciplinas", [["escola_id", escolaId]]);
        if (!res.ok) warnings.push(`disciplinas: ${res.error}`); else deleted.disciplinas = res.deleted || 0;
      }
      if (normalizedIncludes.includes("classes")) {
        const res = await safeDelete("classes", [["escola_id", escolaId]]);
        if (!res.ok) warnings.push(`classes: ${res.error}`); else deleted.classes = res.deleted || 0;
      }
      if (normalizedIncludes.includes("cursos")) {
        const res = await safeDelete("cursos", [["escola_id", escolaId]]);
        if (!res.ok) warnings.push(`cursos: ${res.error}`); else deleted.cursos = res.deleted || 0;
      }
    }

    return NextResponse.json({ ok: true, deleted, warnings, escolaNome, sessionId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro inesperado";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

