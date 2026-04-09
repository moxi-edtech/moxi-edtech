import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabaseServer";
import { isSuperAdminRole } from "@/lib/auth/requireSuperAdminAccess";

type TeamMemberItem = {
  user_id: string;
  papel: string;
  nome: string | null;
  email: string | null;
  role: string | null;
  telefone: string | null;
  created_at: string | null;
};

export async function GET(_request: Request, context: { params: Promise<{ escolaId: string }> }) {
  try {
    const { escolaId } = await context.params;
    const normalizedEscolaId = String(escolaId || "").trim();
    if (!normalizedEscolaId) {
      return NextResponse.json({ ok: false, error: "escolaId ausente" }, { status: 400 });
    }

    const s = (await supabaseServer()) as unknown as SupabaseClient;
    const { data: sess } = await s.auth.getUser();
    const user = sess?.user;
    if (!user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const { data: roles } = await s
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1);
    const role = (roles?.[0] as { role?: string } | undefined)?.role;
    if (!isSuperAdminRole(role)) {
      return NextResponse.json({ ok: false, error: "Somente Super Admin" }, { status: 403 });
    }

    const { data: centroRow, error: centroError } = await s
      .from("centros_formacao")
      .select("escola_id")
      .eq("escola_id", normalizedEscolaId)
      .maybeSingle();
    if (centroError) {
      throw centroError;
    }
    if (!centroRow) {
      return NextResponse.json({ ok: false, error: "Centro não encontrado" }, { status: 404 });
    }

    const { data: joinedRowsRaw, error: joinedRowsError } = await s.rpc("list_centro_formacao_team", {
      p_escola_id: normalizedEscolaId,
    });
    if (joinedRowsError) {
      throw joinedRowsError;
    }

    const joinedRows = (joinedRowsRaw ?? []) as Array<Record<string, unknown>>;

    const items: TeamMemberItem[] = joinedRows
      .map((row) => ({
        user_id: String(row.user_id ?? ""),
        papel: String(row.papel ?? ""),
        nome: typeof row.nome === "string" ? row.nome : null,
        email: typeof row.email === "string" ? row.email : null,
        role: typeof row.role === "string" ? row.role : null,
        telefone: typeof row.telefone === "string" ? row.telefone : null,
        created_at: typeof row.created_at === "string" ? row.created_at : null,
      }))
      .sort((a, b) => {
        const aPapel = a.papel.toLowerCase();
        const bPapel = b.papel.toLowerCase();
        if (aPapel !== bPapel) return aPapel.localeCompare(bPapel);
        return (a.email ?? "").localeCompare(b.email ?? "");
      });

    return NextResponse.json({ ok: true, items });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Erro interno",
      },
      { status: 500 }
    );
  }
}
