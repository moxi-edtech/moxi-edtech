"use server";

import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
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

  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  // Importante: não revelar qual campo falhou (anti-enumeração)
  if (error) return { ok: false, message: "Credenciais inválidas." };

  // Se você tem multi-tenant por escola no RLS, redirecione para o dashboard
  redirect("/app"); // ajuste a rota
}