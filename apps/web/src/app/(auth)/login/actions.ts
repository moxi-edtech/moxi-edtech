"use server";

import { z } from "zod";
import { supabaseServer } from "~/lib/supabase/server";
import { normalizePapel } from "@/lib/permissions";
import { redirect } from "next/navigation";

const LoginSchema = z.object({
  email: z.string().email("Formato de e-mail inválido."),
  password: z.string().min(1, "A senha não pode estar em branco."),
});

export async function loginAction(_: any, formData: FormData) {
  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    const errorMessage = parsed.error.errors.map((e) => e.message).join(" ");
    return { ok: false, message: errorMessage };
  }

  const supabase = await supabaseServer();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    console.error("Login error:", error.message);
    return { ok: false, message: "Credenciais inválidas. Verifique os dados e tente novamente." };
  }

  if (data.user) {
    const { data: escolaUsuarios, error: userError } = await supabase
      .from("escola_users")
      .select("papel, escola_id")
      .eq("user_id", data.user.id)
      .maybeSingle(); // Use .maybeSingle() if you expect 0 or 1 rows

    if (userError) {
      console.error("Erro ao buscar papel/escola do usuário:", userError);
      return { ok: false, message: "Erro ao carregar dados do usuário. Contacte o suporte." };
    }

    if (escolaUsuarios) {
      const { papel, escola_id } = escolaUsuarios;
      const papelNormalizado = normalizePapel(papel);

      if ((papelNormalizado === "admin" || papelNormalizado === "staff_admin" || papelNormalizado === "admin_escola") && escola_id) {
        redirect(`/escola/${escola_id}/admin/dashboard`);
      } else if (papelNormalizado === "secretaria") {
        if (escola_id) {
          redirect(`/escola/${escola_id}/secretaria`);
        } else {
          redirect("/secretaria");
        }
      } else if (papelNormalizado === "financeiro") {
        redirect("/financeiro");
      } else if (escola_id) {
        redirect(`/escola/${escola_id}`);
      }
    }
    
    // Fallback case: User is logged in but not associated with a school/role yet,
    // or doesn't fit the specific roles above. The old code redirected to '/redirect'.
    // We will mimic that behavior.
    redirect('/redirect');
  }

  // This should theoretically not be reached, but as a safeguard:
  return { ok: false, message: "Ocorreu um erro inesperado." };
}
