"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";
import { Tables } from "~types/supabase";

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim()
  );
}

export default function RequireSecretaria({
  children,
  escolaId,
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
      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      const user = userRes?.user;
      if (userErr || !user) { router.replace("/login"); return; }

      const vinculoQuery = supabase
        .from("escola_users")
        .select("*")
        .eq("user_id", user.id);

      if (escolaId) {
        let resolvedEscolaId = escolaId;

        if (!isUuid(escolaId)) {
          const { data: escolaBySlug } = await supabase
            .from("escolas")
            .select("id")
            .eq("slug", escolaId)
            .maybeSingle();
          resolvedEscolaId = escolaBySlug?.id ? String(escolaBySlug.id) : "";
        }

        if (!resolvedEscolaId) {
          router.replace("/");
          return;
        }

        vinculoQuery.eq("escola_id", resolvedEscolaId);
      }

      const { data: vinculos, error } = await vinculoQuery.limit(10);
      const hasSecretaria = (vinculos || []).some((v: Tables<'escola_users'>) => {
        const papel = v.papel ?? v.role ?? null;
        return (
          papel === "secretaria" ||
          papel === "admin" ||
          papel === "secretaria_financeiro" ||
          papel === "admin_financeiro" ||
          papel === "financeiro" ||
          papel === "formacao_admin" ||
          papel === "formacao_secretaria" ||
          papel === "formacao_financeiro"
        );
      });
      if (error || !hasSecretaria) { router.replace("/"); return; }

      if (active) setReady(true);
    })();
    return () => { active = false };
  }, [router, supabase, escolaId]);

  if (!ready) return <div className="p-6">🔒 Verificando permissões da secretaria...</div>;
  return <>{children}</>;
}
