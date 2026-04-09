"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { supabaseRouteClient } from "~/lib/supabase/server";
import { normalizePapel } from "@/lib/permissions";
import { resolveEscolaParam } from "@/lib/tenant/resolveEscolaParam";
import { callAuthAdminJob } from "@/lib/auth-admin-job";
import { redirect } from "next/navigation";

const LoginSchema = z.object({
  email: z.string().trim().min(1, "Informe o email ou número de processo."),
  password: z.string().min(1, "A senha não pode estar em branco."),
});

async function resolveIdentifierToEmail(identifier: string) {
  if (identifier.includes("@")) return identifier.toLowerCase();
  const host = (await headers()).get("host");
  const protocol = process.env.NODE_ENV === "development" ? "http" : "https";
  const origin = host ? `${protocol}://${host}` : process.env.NEXT_PUBLIC_BASE_URL || "";
  if (!origin) return null;

  try {
    const req = new Request(`${origin}/login`);
    const result = await callAuthAdminJob(req, "resolveIdentifierToEmail", { identifier });
    const email = (result as any)?.email as string | undefined;
    return email ? email.toLowerCase() : null;
  } catch {
    return null;
  }
}

async function getFormacaoBaseUrl() {
  const host = (await headers()).get("host") ?? "";
  const normalizedHost = host.toLowerCase();

  if (
    normalizedHost.startsWith("localhost") ||
    normalizedHost.startsWith("127.0.0.1") ||
    normalizedHost.endsWith(".localhost")
  ) {
    return "http://localhost:3001";
  }

  return "https://formacao.klasse.ao";
}

export async function loginAction(_: unknown, formData: FormData) {
  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    const errorMessage = parsed.error.errors.map((e) => e.message).join(" ");
    return { ok: false, message: errorMessage };
  }

  const supabase = await supabaseRouteClient();

  const resolvedEmail = await resolveIdentifierToEmail(parsed.data.email.trim());
  if (!resolvedEmail) {
    return { ok: false, message: "Credenciais inválidas. Verifique os dados e tente novamente." };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: resolvedEmail,
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
      const resolvedParam = escola_id
        ? await resolveEscolaParam(supabase as any, String(escola_id))
        : null;
      const escolaParam = resolvedParam?.slug ? String(resolvedParam.slug) : escola_id ? String(escola_id) : null;

      if ((papelNormalizado === "admin" || papelNormalizado === "staff_admin" || papelNormalizado === "admin_escola") && escola_id) {
        redirect(`/escola/${escolaParam ?? escola_id}/admin/dashboard`);
      } else if (
        papelNormalizado === "formacao_admin" ||
        papelNormalizado === "formacao_secretaria" ||
        papelNormalizado === "formacao_financeiro" ||
        papelNormalizado === "formador" ||
        papelNormalizado === "formando"
      ) {
        const formacaoBaseUrl = await getFormacaoBaseUrl();
        if (papelNormalizado === "formacao_admin") {
          redirect(`${formacaoBaseUrl}/admin/dashboard`);
        } else if (papelNormalizado === "formacao_secretaria") {
          redirect(`${formacaoBaseUrl}/secretaria/catalogo-cursos`);
        } else if (papelNormalizado === "formacao_financeiro") {
          redirect(`${formacaoBaseUrl}/financeiro/dashboard`);
        } else if (papelNormalizado === "formador") {
          redirect(`${formacaoBaseUrl}/agenda`);
        } else {
          redirect(`${formacaoBaseUrl}/meus-cursos`);
        }
      } else if (papelNormalizado === "secretaria") {
        if (escola_id) {
          redirect(`/escola/${escolaParam ?? escola_id}/secretaria`);
        } else {
          redirect("/secretaria");
        }
      } else if (papelNormalizado === "financeiro") {
        redirect("/financeiro");
      } else if (papelNormalizado === "secretaria_financeiro") {
        if (escola_id) {
          redirect(`/escola/${escolaParam ?? escola_id}/secretaria`);
        } else {
          redirect("/secretaria");
        }
      } else if (papelNormalizado === "admin_financeiro") {
        if (escola_id) {
          redirect(`/escola/${escolaParam ?? escola_id}/admin/dashboard`);
        } else {
          redirect("/admin");
        }
      } else if (papelNormalizado === "professor") {
        redirect("/professor");
      } else if (papelNormalizado === "aluno") {
        redirect("/aluno/dashboard");
      } else if (escola_id) {
        redirect(`/escola/${escolaParam ?? escola_id}`);
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
