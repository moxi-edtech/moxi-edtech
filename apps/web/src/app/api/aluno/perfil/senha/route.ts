import { NextResponse } from "next/server";
import { z } from "zod";
import { getAlunoContext } from "@/lib/alunoContext";

const PasswordSchema = z
  .string()
  .min(8, "A nova senha deve ter pelo menos 8 caracteres.")
  .regex(/[A-Z]/, "A nova senha deve incluir uma letra maiúscula.")
  .regex(/[a-z]/, "A nova senha deve incluir uma letra minúscula.")
  .regex(/\d/, "A nova senha deve incluir um número.")
  .regex(/[^A-Za-z0-9]/, "A nova senha deve incluir um caractere especial.");

const RequestSchema = z.object({
  senhaAtual: z.string().min(1, "Informe a senha atual."),
  novaSenha: PasswordSchema,
});

export async function POST(req: Request) {
  try {
    const { supabase, ctx } = await getAlunoContext();
    if (!ctx) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const parsed = RequestSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
        { status: 400 }
      );
    }

    const { data: userResult } = await supabase.auth.getUser();
    const email = userResult.user?.email;
    if (!email) {
      return NextResponse.json({ ok: false, error: "Conta sem email de autenticação." }, { status: 400 });
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: parsed.data.senhaAtual,
    });
    if (signInError) {
      return NextResponse.json({ ok: false, error: "Senha atual incorreta." }, { status: 403 });
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: parsed.data.novaSenha,
      data: { must_change_password: false },
    });
    if (updateError) throw updateError;

    await supabase.from("audit_logs").insert({
      escola_id: ctx.escolaId,
      user_id: ctx.userId,
      action: "SENHA_ALTERADA",
      entity: "usuario",
      entity_id: ctx.userId,
      portal: "aluno",
      details: { source: "portal_aluno_perfil" },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
