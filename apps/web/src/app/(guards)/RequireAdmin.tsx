"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim()
  );
}

export default function RequireAdmin({
  children,
  escolaId: propsEscolaId,
}: {
  children: React.ReactNode;
  escolaId?: string | null;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      // 1. Get Session
      const { data: { session }, error: userErr } = await supabase.auth.getSession();
      const user = session?.user;
      
      if (userErr || !user) { 
        if (active) router.replace("/redirect"); 
        return; 
      }

      // 2. Identify target school
      let targetEscolaId = propsEscolaId;
      if (targetEscolaId && !isUuid(targetEscolaId)) {
        const { data: escolaBySlug } = await supabase
          .from("escolas")
          .select("id")
          .eq("slug", targetEscolaId)
          .maybeSingle();
        targetEscolaId = escolaBySlug?.id ? String(escolaBySlug.id) : "";
      }

      // 3. Check for admin roles
      const vinculoQuery = supabase
        .from("escola_users")
        .select("escola_id, papel, role")
        .eq("user_id", user.id);

      if (targetEscolaId) {
        vinculoQuery.eq("escola_id", targetEscolaId);
      }

      const { data: vinculos, error } = await vinculoQuery.limit(1);
      
      const hasAdmin = (vinculos || []).some((v: any) => {
        const papel = v.papel ?? v.role ?? null;
        return [
          "admin", "admin_escola", "staff_admin", "super_admin"
        ].includes(papel);
      });

      if (error || !hasAdmin) { 
        if (active) router.replace("/"); 
        return; 
      }

      if (active) setReady(true);
    })();
    return () => { active = false };
  }, [router, supabase, propsEscolaId]);

  if (!ready) return null; 
  return <>{children}</>;
}
