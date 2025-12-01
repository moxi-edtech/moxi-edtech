import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";
import { hasPermission } from "@/lib/permissions";

async function authorize(escolaId: string) {
  const s = await supabaseServer();
  const { data: auth } = await s.auth.getUser();
  const user = auth?.user;
  if (!user) return { ok: false as const, status: 401, error: "Não autenticado" };

  let allowed = false;
  try {
    const { data: prof } = await s
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1);
    if (((prof?.[0] as any)?.role ?? null) === "super_admin") allowed = true;
  } catch {}
  if (!allowed) {
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
  }
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
  if (!allowed) {
    try {
      const { data: prof2 } = await s
        .from("profiles")
        .select("role, escola_id")
        .eq("user_id", user.id)
        .eq("escola_id", escolaId)
        .limit(1);
      allowed = Boolean(prof2 && prof2.length > 0 && (prof2[0] as any).role === "admin");
    } catch {}
  }
  if (!allowed) return { ok: false as const, status: 403, error: "Sem permissão" };
  return { ok: true as const };
}

// POST /api/escolas/[id]/academico/offers/backfill
// Varre turmas recentes (por sessão ativa), usa pares (classe_id, curso_id) inferidos
// das disciplinas existentes e cria cursos_oferta ausentes para todos os semestres.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: escolaId } = await params;
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: "Configuração Supabase ausente." }, { status: 500 });
    }

    const authz = await authorize(escolaId);
    if (!authz.ok) return NextResponse.json({ ok: false, error: authz.error }, { status: authz.status });

    const admin = createAdminClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 1) Sessions ativas da escola
    const { data: sessions, error: sessErr } = await (admin as any)
      .from("school_sessions")
      .select("id")
      .eq("escola_id", escolaId)
      .eq("status", "ativa");
    if (sessErr) return NextResponse.json({ ok: false, error: sessErr.message }, { status: 400 });
    const sessionIds: string[] = (sessions || []).map((s: any) => s.id);
    if (sessionIds.length === 0) return NextResponse.json({ ok: true, updated: 0, details: [] });

    // 2) Semestres por sessão
    const { data: semestresRows } = await (admin as any)
      .from("semestres")
      .select("id, session_id")
      .in("session_id", sessionIds);
    const semestresBySession = new Map<string, string[]>();
    for (const r of (semestresRows || []) as Array<{ id: string; session_id: string }>) {
      if (!semestresBySession.has(r.session_id)) semestresBySession.set(r.session_id, []);
      semestresBySession.get(r.session_id)!.push(r.id);
    }

    // 3) Turmas por sessão
    const { data: turmasRows } = await (admin as any)
      .from("turmas")
      .select("id, classe_id, session_id")
      .eq("escola_id", escolaId)
      .in("session_id", sessionIds);
    const turmasBySession = new Map<string, Array<{ id: string; classe_id: string | null }>>();
    for (const t of (turmasRows || []) as Array<{ id: string; classe_id: string | null; session_id: string }>) {
      if (!turmasBySession.has(t.session_id)) turmasBySession.set(t.session_id, []);
      turmasBySession.get(t.session_id)!.push({ id: t.id, classe_id: t.classe_id });
    }

    // 4) Pares (classe_id, curso_id) inferidos de disciplinas existentes
    const { data: discRows } = await (admin as any)
      .from("disciplinas")
      .select("classe_id, curso_id")
      .eq("escola_id", escolaId)
      .not("classe_id", "is", null)
      .not("curso_id", "is", null);
    const pairSet = new Set<string>();
    const pairs: Array<{ classe_id: string; curso_id: string }> = [];
    for (const d of (discRows || []) as Array<{ classe_id: string | null; curso_id: string | null }>) {
      if (!d.classe_id || !d.curso_id) continue;
      const key = `${d.classe_id}::${d.curso_id}`;
      if (!pairSet.has(key)) { pairSet.add(key); pairs.push({ classe_id: d.classe_id, curso_id: d.curso_id }); }
    }
    if (pairs.length === 0) return NextResponse.json({ ok: true, updated: 0, details: [] });

    // 5) Ofertas existentes (para evitar duplicar)
    const { data: ofertasRows } = await (admin as any)
      .from("cursos_oferta")
      .select("curso_id, turma_id, semestre_id")
      .eq("escola_id", escolaId);
    const hasOferta = new Set<string>();
    for (const r of (ofertasRows || []) as Array<{ curso_id: string; turma_id: string; semestre_id: string }>) {
      hasOferta.add(`${r.curso_id}::${r.turma_id}::${r.semestre_id}`);
    }

    // 6) Monta inserts faltantes por sessão
    let toInsert: Array<any> = [];
    const details: Array<{ session_id: string; planned: number; created: number }> = [];
    for (const sessionId of sessionIds) {
      const semIds = semestresBySession.get(sessionId) || [];
      const turmas = turmasBySession.get(sessionId) || [];
      let planned = 0;

      for (const { classe_id, curso_id } of pairs) {
        const turmasDaClasse = turmas.filter((t) => (t.classe_id || null) === classe_id);
        for (const t of turmasDaClasse) {
          for (const semId of semIds) {
            const key = `${curso_id}::${t.id}::${semId}`;
            if (hasOferta.has(key)) continue;
            planned++;
            toInsert.push({ escola_id: escolaId, curso_id, turma_id: t.id, semestre_id: semId });
            // Guarda para que múltiplos loops não planejem duas vezes a mesma oferta
            hasOferta.add(key);
          }
        }
      }
      details.push({ session_id: sessionId, planned, created: 0 });
    }

    let created = 0;
    if (toInsert.length > 0) {
      const { data: ins, error: err } = await (admin as any)
        .from("cursos_oferta")
        .upsert(toInsert as any, { onConflict: "curso_id,turma_id,semestre_id" } as any)
        .select("id");
      if (err) return NextResponse.json({ ok: false, error: err.message }, { status: 400 });
      created = (ins || []).length;
      // Atualiza created distribuindo proporcionalmente (aproximação)
      if (created > 0) {
        const per = Math.max(1, Math.floor(created / details.length));
        for (let i = 0; i < details.length; i++) details[i].created = i === details.length - 1 ? created - per * (details.length - 1) : per;
      }
    }

    return NextResponse.json({ ok: true, updated: created, details });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
