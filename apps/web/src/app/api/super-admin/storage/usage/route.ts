import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { isSuperAdminRole } from "@/lib/auth/requireSuperAdminAccess";

const DOCUMENT_BUCKETS = [
  "documentos",
  "documentos_emitidos",
  "documentos_oficiais",
  "boletins",
  "recibos",
  "declaracoes",
  "pautas_zip",
];

export async function GET() {
  try {
    const s = await supabaseServer();
    const { data: sess } = await s.auth.getUser();
    const user = sess?.user;
    if (!user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const { data: rows } = await s
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1);
    const role = (rows?.[0] as any)?.role as string | undefined;
    if (!isSuperAdminRole(role)) {
      return NextResponse.json({ ok: false, error: "Somente Super Admin" }, { status: 403 });
    }

    const { data, error } = await (s as any).rpc("admin_get_storage_usage", {
      p_limit: 200,
      p_bucket_ids: DOCUMENT_BUCKETS,
    });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    const items = (data || []) as Array<{
      escola_id: string;
      escola_nome: string | null;
      total_bytes: number | null;
      total_documentos: number | null;
      last_30d_bytes: number | null;
      projected_30d_bytes: number | null;
    }>;

    const totalBytes = items.reduce((sum, item) => sum + Number(item.total_bytes ?? 0), 0);
    const alerts = {
      escolas_criticas: items.filter((item) => Number(item.total_bytes ?? 0) >= 200 * 1024 * 1024),
      total_critico: totalBytes >= 800 * 1024 * 1024,
    };

    return NextResponse.json({ ok: true, items, totalBytes, alerts });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
