import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRoleInSchool } from "@/lib/authz";

const payloadSchema = z.object({
  candidatura_id: z.string().uuid(),
  motivo: z.string().trim().min(3).max(500).optional(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const body = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
  }

  const { candidatura_id, motivo } = parsed.data;

  try {
    const { data: head, error: headErr } = await supabase
      .from("candidaturas")
      .select("id, escola_id")
      .eq("id", candidatura_id)
      .single();

    if (headErr || !head) {
      return NextResponse.json({ error: "Candidatura not found" }, { status: 404 });
    }

    const { error: authError } = await requireRoleInSchool({
      supabase,
      escolaId: head.escola_id,
      roles: ["secretaria", "admin", "admin_escola", "staff_admin"],
    });
    if (authError) return authError;

    const { error } = await supabase.rpc("admissao_archive", {
      p_escola_id: head.escola_id,
      p_candidatura_id: candidatura_id,
      p_motivo: motivo ?? null,
    });

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("admissao archive error:", error);
    return NextResponse.json(
      {
        error: "Internal Server Error",
        details: error?.message ?? null,
        code: error?.code ?? null,
      },
      { status: 500 }
    );
  }
}
