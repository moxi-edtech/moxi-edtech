import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabaseClient";

export type UserRole =
  | "superadmin"
  | "admin"
  | "secretaria"
  | "financeiro"
  | "aluno"
  | "professor"
  | "gestor";

const normalizeRole = (raw: unknown): UserRole | null => {
  if (!raw || typeof raw !== "string") return null;

  // Normaliza variações comuns
  const r = raw.trim();

  const map: Record<string, UserRole> = {
    super_admin: "superadmin",
    superadmin: "superadmin",
    admin_escola: "admin",
    admin: "admin",
    secretaria: "secretaria",
    financeiro: "financeiro",
    aluno: "aluno",
    professor: "professor",
    gestor: "gestor",
  };

  return map[r] ?? null;
};

export function useUserRole() {
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setUserRole(null);
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      if (error) {
        console.warn("useUserRole: failed to read profiles.role", error);
        setUserRole(null);
        setIsLoading(false);
        return;
      }

      const normalized = normalizeRole(data?.role);
      console.log("useUserRole: role raw/normalized", { raw: data?.role, normalized });

      setUserRole(normalized);
      setIsLoading(false);
    };

    run();
  }, []);

  return { userRole, isLoading };
}
