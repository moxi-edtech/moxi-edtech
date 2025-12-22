
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabaseClient";
import { UserRole } from "./useUserRole";



export type UserRole = "super_admin" | "admin" | "secretaria" | "aluno" | "professor" | "gestor";

export function useUserRole() {
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUserRole = async () => {
      const supabase = createClient();
      const { data, error } = await supabase.auth.getUser();

      if (error) {
        console.error("Error fetching user:", error);
        setUserRole(null);
      } else if (data.user) {
        setUserRole(data.user.app_metadata.user_role as UserRole);
      }
      setIsLoading(false);
    };

    fetchUserRole();
  }, []);

  return { userRole, isLoading };
}
