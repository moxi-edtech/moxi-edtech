"use server";

import { z } from "zod";
import { supabaseServer } from "~/lib/supabase/server";
import { redirect } from "next/navigation";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export async function loginAction(_: any, formData: FormData) {
  const parsed = LoginSchema.safeParse({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  });

  if (!parsed.success) {
    return { ok: false, message: "Verifique email e senha." };
  }

  const supabase = supabaseServer();

    const { data, error } = await supabase.auth.signInWithPassword({

      email: parsed.data.email,

      password: parsed.data.password,

    });

  

    if (error) return { ok: false, message: "Credenciais inválidas." };

  

    if (data.user) {
      const { data: escolaUsuario, error: userError } = await supabase
        .from("escola_usuarios")
        .select("papel, escola_id")
        .eq("user_id", data.user.id)
        .single();

      if (userError || !escolaUsuario) {
        console.error("Erro ao buscar papel ou escola_id do usuário:", userError);
        return { ok: false, message: "Não foi possível determinar o seu papel ou escola. Contacte o suporte." };
      }

      if (escolaUsuario.papel === "secretaria") {
        redirect("/secretaria");
      } else if (escolaUsuario.escola_id) {
        redirect(`/escola/${escolaUsuario.escola_id}`);
      }
    }

    // Fallback if no user data or specific redirection rules apply
    redirect("/");
}