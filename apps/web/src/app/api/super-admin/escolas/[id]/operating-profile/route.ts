import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createRouteClient } from "@/lib/supabase/route-client";
import { invalidateSchoolOperatingProfile } from "@/lib/school-profile/resolve-school-profile";
import { ASSESSMENT_POLICIES, FINANCE_MODELS, SCHOOL_SECTORS } from "@/lib/school-profile/types";

export const dynamic = "force-dynamic";

const profileSchema = z.object({
  schoolSector: z.enum(SCHOOL_SECTORS),
  regulatoryProfile: z.string().trim().min(1).max(120),
  financeModel: z.enum(FINANCE_MODELS),
  assessmentPolicy: z.enum(ASSESSMENT_POLICIES),
  documentProfile: z.string().trim().min(1).max(120),
  effectiveFrom: z.string().date(),
  reason: z.string().trim().min(3).max(500),
  confirm: z.literal(true),
});

async function requireSuperAdmin() {
  const supabase = await createRouteClient();
  const { data: isSuperAdmin, error } = await supabase.rpc("check_super_admin_role");
  if (error || !isSuperAdmin) {
    return {
      supabase,
      response: NextResponse.json({ ok: false, error: "Somente Super Admin" }, { status: 403 }),
    };
  }
  return { supabase, response: null };
}

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: schoolId } = await context.params;
  const { supabase, response } = await requireSuperAdmin();
  if (response) return response;

  const [{ data: profiles, error: profileError }, { data: audit, error: auditError }] = await Promise.all([
    (supabase as any)
      .from("school_operating_profiles")
      .select("*")
      .eq("school_id", schoolId)
      .order("effective_from", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(50),
    (supabase as any)
      .from("school_profile_audit_logs")
      .select("*")
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  if (profileError || auditError) {
    return NextResponse.json(
      { ok: false, error: profileError?.message ?? auditError?.message ?? "Falha ao carregar perfil" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, profiles: profiles ?? [], audit: audit ?? [] });
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: schoolId } = await context.params;
  const parsed = profileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Perfil inválido ou confirmação ausente.", issues: parsed.error.flatten() }, { status: 400 });
  }

  const { supabase, response } = await requireSuperAdmin();
  if (response) return response;

  const { data: profileId, error } = await (supabase as any).rpc("set_school_operating_profile", {
    p_school_id: schoolId,
    p_school_sector: parsed.data.schoolSector,
    p_regulatory_profile: parsed.data.regulatoryProfile,
    p_finance_model: parsed.data.financeModel,
    p_assessment_policy: parsed.data.assessmentPolicy,
    p_document_profile: parsed.data.documentProfile,
    p_effective_from: parsed.data.effectiveFrom,
    p_reason: parsed.data.reason,
    p_confirm: parsed.data.confirm,
  });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 409 });
  }

  invalidateSchoolOperatingProfile(schoolId);
  return NextResponse.json({ ok: true, profileId });
}
