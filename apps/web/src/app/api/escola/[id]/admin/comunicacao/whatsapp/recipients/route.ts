import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import {
  authorizeWhatsappUser,
  maskPhone,
  normalizeWhatsappPhone,
  withNoStore,
} from "@/lib/server/whatsappUtility";
import type { DBWithRPC } from "@/types/supabase-augment";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ProfessorRow = {
  id: string;
  apelido: string | null;
  profile_id: string | null;
};

type ProfilePhoneRow = {
  user_id: string;
  nome: string | null;
  telefone: string | null;
};

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await supabaseServerTyped<DBWithRPC>();
    const auth = await authorizeWhatsappUser(supabase, id);
    if (!auth.ok) return withNoStore(NextResponse.json({ ok: false, error: auth.error }, { status: auth.status }));

    const url = new URL(request.url);
    const q = (url.searchParams.get("q") || "").trim();
    const type = url.searchParams.get("type") || "aluno";
    const limit = Math.max(1, Math.min(Number(url.searchParams.get("limit") ?? 20), 30));

    if (type === "professor") {
      let query = (supabase as any)
        .from("professores")
        .select("id,apelido,profile_id")
        .eq("escola_id", auth.auth.escolaId)
        .order("apelido", { ascending: true })
        .limit(limit);
      if (q) query = query.ilike("apelido", `%${q}%`);
      const { data, error } = await query;
      if (error) throw error;
      const professorRows = (data || []) as ProfessorRow[];
      const profileIds = professorRows.map((row) => row.profile_id).filter((id): id is string => Boolean(id));
      const { data: profiles } = profileIds.length
        ? await (supabase as any).from("profiles").select("user_id,nome,telefone").in("user_id", profileIds)
        : { data: [] };
      const profileRows = (profiles || []) as ProfilePhoneRow[];
      const profileById = new Map<string, ProfilePhoneRow>(profileRows.map((profile) => [profile.user_id, profile]));
      return withNoStore(
        NextResponse.json({
          ok: true,
          data: professorRows
            .map((row) => {
              const profile = row.profile_id ? profileById.get(row.profile_id) : undefined;
              const phone = profile?.telefone ?? null;
              return {
                id: row.id,
                type: "professor",
                name: profile?.nome || row.apelido || "Professor",
                phoneMasked: maskPhone(phone),
                hasValidPhone: Boolean(normalizeWhatsappPhone(phone)),
              };
            })
            .filter((row: any) => row.hasValidPhone),
        })
      );
    }

    let query = (supabase as any)
      .from("alunos")
      .select("id,nome,numero_processo,responsavel_nome,encarregado_nome,responsavel_contato,telefone_responsavel,encarregado_telefone")
      .eq("escola_id", auth.auth.escolaId)
      .order("nome", { ascending: true })
      .limit(limit);
    if (q) query = query.ilike("nome", `%${q}%`);
    const { data, error } = await query;
    if (error) throw error;

    const rows = (data || [])
      .map((row: any) => {
        const phone = row.responsavel_contato || row.telefone_responsavel || row.encarregado_telefone || null;
        return {
          id: row.id,
          type: "encarregado",
          name: row.responsavel_nome || row.encarregado_nome || `Encarregado de ${row.nome}`,
          studentName: row.nome,
          studentNumber: row.numero_processo,
          phoneMasked: maskPhone(phone),
          hasValidPhone: Boolean(normalizeWhatsappPhone(phone)),
        };
      })
      .filter((row: any) => row.hasValidPhone);

    return withNoStore(NextResponse.json({ ok: true, data: rows }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return withNoStore(NextResponse.json({ ok: false, error: message }, { status: 500 }));
  }
}
