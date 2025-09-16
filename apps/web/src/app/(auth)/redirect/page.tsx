import { redirect } from "next/navigation";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { Database } from "~types/supabase";

// ⚡ força execução dinâmica (pega cookies)
export const dynamic = "force-dynamic";

export default async function RedirectPage() {
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get() {
          return undefined;
        },
        set() {},
        remove() {},
      },
    }
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const user = session?.user;
  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, escola_id")
    .eq("user_id", user!.id)
    .maybeSingle();

  const role: string = profile?.role ?? "guest";
  const escola_id: string | null = profile?.escola_id ?? null;

  switch (role) {
    case "super_admin":
      redirect("/super-admin");
    case "admin":
      redirect(escola_id ? `/admin/escolas/${escola_id}` : "/admin");
    case "professor":
      redirect("/professor");
    case "aluno":
      redirect("/aluno");
    case "secretaria":
      redirect("/secretaria");
    case "financeiro":
      redirect("/financeiro");
    default:
      redirect("/");
  }
}