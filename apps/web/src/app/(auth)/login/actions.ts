"use server";

import { z } from "zod";
import { supabaseServer } from "~/lib/supabase/server";
import { normalizePapel } from "@/lib/permissions";
import { redirect } from "next/navigation";

const LoginSchema = z.object({
  email: z.string().email("Formato de e-mail inválido."),
  password: z.string().min(1, "A senha não pode estar em branco."),
});

export async function loginAction(_: unknown, formData: FormData) {
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
    const { data: prof } = await supabase
      .from("profiles")
      .select("current_escola_id, escola_id")
      .eq("user_id", data.user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const metaEscolaId = (data.user.app_metadata as { escola_id?: string | null } | null)?.escola_id ?? null;
    const preferredEscolaId = (prof as any)?.current_escola_id || (prof as any)?.escola_id || metaEscolaId || null;

    const { data: escolaUsuarios, error: userError } = await supabase
      .from("escola_users")
      .select("papel, escola_id")
      .eq("user_id", data.user.id)
      .order("created_at", { ascending: false })
      .limit(5);

    if (userError) {
      console.error("Erro ao buscar papel/escola do usuário:", userError);
    }

    const preferredLink = Array.isArray(escolaUsuarios)
      ? escolaUsuarios.find((link) => link.escola_id === preferredEscolaId)
      : null;
    const firstLink = preferredLink || (Array.isArray(escolaUsuarios) ? escolaUsuarios[0] : null);

    if (firstLink) {
      const { papel, escola_id } = firstLink;
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
      } else if (papelNormalizado === "secretaria_financeiro") {
        if (escola_id) {
          redirect(`/escola/${escola_id}/secretaria?modo=balcao`);
        } else {
          redirect("/secretaria");
        }
      } else if (papelNormalizado === "admin_financeiro") {
        if (escola_id) {
          redirect(`/escola/${escola_id}/admin/dashboard?tab=financeiro`);
        } else {
          redirect("/admin");
        }
      } else if (papelNormalizado === "professor") {
        redirect("/professor");
      } else if (papelNormalizado === "aluno") {
        redirect("/aluno/dashboard");
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
