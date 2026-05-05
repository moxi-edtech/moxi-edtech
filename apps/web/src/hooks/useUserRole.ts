"use client";

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

const isAbortLikeError = (error: unknown) => {
  const record = error as { message?: unknown; details?: unknown; name?: unknown } | null;
  const text = [
    record?.name,
    record?.message,
    record?.details,
    error instanceof Error ? error.message : null,
  ]
    .filter(Boolean)
    .join(" ");

  return /AbortError|aborted/i.test(text);
};

export function useUserRole() {
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const finish = (role: UserRole | null) => {
      if (!mounted) return;
      setUserRole(role);
      setIsLoading(false);
    };

    const run = async () => {
      try {
        const supabase = createClient();

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!mounted) return;
        if (!user) {
          finish(null);
          return;
        }

        const { data, error } = await supabase
          .from("profiles")
          .select("role")
          .eq("user_id", user.id)
          .single();

        if (!mounted) return;
        if (error) {
          if (!isAbortLikeError(error)) {
            console.warn("useUserRole: failed to read profiles.role", error);
          }
          finish(null);
          return;
        }

        const normalized = normalizeRole(data?.role);
        if (process.env.NODE_ENV === "development") {
          console.log("useUserRole: role raw/normalized", { raw: data?.role, normalized });
        }

        finish(normalized);
      } catch (error) {
        if (!mounted) return;
        if (!isAbortLikeError(error)) {
          console.warn("useUserRole: failed to load role", error);
        }
        finish(null);
      }
    };

    void run();

    return () => {
      mounted = false;
    };
  }, []);

  return { userRole, isLoading };
}
