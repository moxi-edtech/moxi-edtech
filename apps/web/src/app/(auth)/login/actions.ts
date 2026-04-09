"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { supabaseRouteClient } from "~/lib/supabase/server";
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

export async function loginAction(_: unknown, formData: FormData) {
  throw new Error("DEPRECATED_AUTH_FLOW");
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
    // Keep a single post-login routing pipeline in /redirect to avoid role drift
    // between server action and client routing logic.
    redirect('/redirect');
  }

  // This should theoretically not be reached, but as a safeguard:
  return { ok: false, message: "Ocorreu um erro inesperado." };
}
