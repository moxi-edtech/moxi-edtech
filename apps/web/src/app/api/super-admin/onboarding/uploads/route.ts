import { NextResponse } from "next/server";
import { supabaseRouteClient } from "@/lib/supabaseServer";
import { isSuperAdminRole } from "@/lib/auth/requireSuperAdminAccess";

export const dynamic = "force-dynamic";

async function requireSuperAdmin() {
  const supabase = await supabaseRouteClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const user = session?.user ?? null;
  if (!user) {
    return { ok: false as const, response: NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 }) };
  }

  const role = user.app_metadata?.role ?? user.user_metadata?.role ?? null;

  if (!isSuperAdminRole(typeof role === "string" ? role : null)) {
    return { ok: false as const, response: NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 }) };
  }

  return { ok: true as const, supabase };
}

export async function GET() {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  try {
    const { data: uploads, error } = await auth.supabase
      .from("onboarding_uploads" as any)
      .select(`
        *,
        onboarding_requests (
          escola_nome,
          tracking_token
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    const memberIds = Array.from(
      new Set(
        (uploads || [])
          .map((upload: any) => upload.criado_por_membro_id)
          .filter((value: unknown): value is string => typeof value === "string" && value.length > 0)
      )
    );

    let memberMap = new Map<string, { id: string; nome: string }>();
    if (memberIds.length > 0) {
      const { data: members, error: membersError } = await auth.supabase
        .from("afiliado_membros" as any)
        .select("id, nome")
        .in("id", memberIds);

      if (membersError) {
        return NextResponse.json({ ok: false, error: membersError.message }, { status: 400 });
      }

      memberMap = new Map(
        (members || []).map((member: any) => [member.id as string, { id: member.id as string, nome: member.nome as string }])
      );
    }

    const hydratedUploads = (uploads || []).map((upload: any) => {
      const afiliadoMembro = typeof upload.criado_por_membro_id === "string"
        ? memberMap.get(upload.criado_por_membro_id) ?? null
        : null;

      const authorTypeLabel = upload.created_by === "escola" ? "Escola" : "Parceiro";
      const authorDisplay = upload.created_by === "escola"
        ? "Enviado pela Escola"
        : `Enviado por Parceiro: ${afiliadoMembro?.nome || "Nome não identificado"}`;

      return {
        ...upload,
        afiliado_membro: afiliadoMembro,
        author_type_label: authorTypeLabel,
        author_display: authorDisplay,
      };
    });

    return NextResponse.json({
      ok: true,
      uploads: hydratedUploads,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || "Erro interno" }, { status: 500 });
  }
}
