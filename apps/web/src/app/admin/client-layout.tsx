"use client";
import AppShell from "@/components/layout/klasse/AppShell";
import React, { useEffect } from "react";
import RequireAdmin from "@/app/(guards)/RequireAdmin";
import { useEscolaId } from "@/hooks/useEscolaId";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { escolaId, escolaSlug, isLoading } = useEscolaId();

  useEffect(() => {
    if (isLoading || !escolaId) return;
    if (!pathname) return;
    if (!pathname.startsWith("/admin")) return;

    // Se for exatamente /admin, vai para /admin/dashboard no novo formato
    const isRoot = pathname === "/admin";
    const suffix = isRoot ? "/dashboard" : pathname.slice("/admin".length);
    
    const query = searchParams?.toString() ?? "";
    const escolaParam = escolaSlug || escolaId;
    const nextPath = `/escola/${escolaParam}/admin${suffix}${query ? `?${query}` : ""}`;
    
    router.replace(nextPath);
  }, [escolaId, escolaSlug, isLoading, pathname, router, searchParams]);

  return (
    <RequireAdmin>
      <AppShell>{children}</AppShell>
    </RequireAdmin>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPrintView = pathname?.includes("/print");

  if (isPrintView) {
    return <RequireAdmin>{children}</RequireAdmin>;
  }

  return <AdminShell>{children}</AdminShell>;
}
