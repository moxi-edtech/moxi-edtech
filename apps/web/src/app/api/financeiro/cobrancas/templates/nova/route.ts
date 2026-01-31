import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export const dynamic = "force-dynamic";

const TemplateSchema = z.object({
  nome: z.string().min(1, "Nome do template é obrigatório"),
  canal: z.enum(["whatsapp", "sms", "email", "push"]),
  corpo: z.string().min(1, "Corpo da mensagem é obrigatório"),
});

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const escolaId = await resolveEscolaIdForUser(supabase, user.id);
    if (!escolaId)
      return NextResponse.json(
        { error: "Escola não identificada" },
        { status: 403 }
      );

    const body = await request.json();
    const parsed = TemplateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }

    const { nome, canal, corpo } = parsed.data;
    const { data: tpl, error } = await (supabase as any)
      .from("financeiro_templates_cobranca")
      .insert({
        escola_id: escolaId,
        nome,
        canal,
        corpo,
        criado_por: user.id,
      })
      .select("id, escola_id, nome, canal, corpo, criado_por, created_at")
      .single();

    if (error) {
      console.error("create template error:", error);
      return NextResponse.json(
        { error: error.message || "Erro ao criar template" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, template: tpl });
  } catch (e: any) {
    console.error("create template unexpected:", e);
    return NextResponse.json({ error: e?.message || "Erro interno" }, { status: 500 });
  }
}
