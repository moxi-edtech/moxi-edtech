import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveTenantContextForUser } from "@/lib/tenant/resolveTenantContext";
import { isRoleAllowedForProduct, type ProductContext } from "@/lib/permissions";
import type { Database } from "~types/supabase";

type TenantType = "k12" | "formacao";

type GuardOptions = {
  productContext: ProductContext;
  requireTenantType?: TenantType;
  allowedRoles?: string[];
  requestedTenantId?: string | null;
  requestedTenantSlug?: string | null;
};

type GuardSuccess = {
  ok: true;
  supabase: SupabaseClient<Database>;
  user: NonNullable<Awaited<ReturnType<SupabaseClient<Database>["auth"]["getUser"]>>["data"]["user"]>;
  userId: string;
  tenantId: string;
  tenantSlug: string | null;
  tenantType: TenantType;
  role: string;
};

type GuardFailure = {
  ok: false;
  response: NextResponse;
};

type GuardResult = GuardSuccess | GuardFailure;

export async function requireApiTenantGuard(options: GuardOptions): Promise<GuardResult> {
  const supabase = await supabaseServerTyped<Database>();
  const { data, error } = await supabase.auth.getUser();
  const user = data?.user;

  if (error || !user) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 }),
    };
  }

  const tenantContext = await resolveTenantContextForUser({
    client: supabase as unknown as SupabaseClient<Database>,
    userId: user.id,
    requestedTenantId: options.requestedTenantId ?? null,
    requestedTenantSlug: options.requestedTenantSlug ?? null,
  });

  if (!tenantContext?.tenant_id) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "Usuário sem tenant associado", code: "NO_TENANT" },
        { status: 403 }
      ),
    };
  }

  const tenantType = (tenantContext.tenant_type === "formacao" ? "formacao" : "k12") as TenantType;
  const role = String(tenantContext.user_role ?? "")
    .trim()
    .toLowerCase();

  if (!role) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "Papel não resolvido para o usuário", code: "ROLE_NOT_RESOLVED" },
        { status: 403 }
      ),
    };
  }

  if (options.requireTenantType && tenantType !== options.requireTenantType) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          error: "Tenant incompatível para este endpoint",
          code: "TENANT_TYPE_MISMATCH",
        },
        { status: 403 }
      ),
    };
  }

  if (!isRoleAllowedForProduct(role, options.productContext)) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "Acesso bloqueado por contexto de produto", code: "PRODUCT_ROLE_MISMATCH" },
        { status: 403 }
      ),
    };
  }

  if (options.allowedRoles && options.allowedRoles.length > 0 && !options.allowedRoles.includes(role)) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: "Sem permissão", code: "INSUFFICIENT_ROLE" }, { status: 403 }),
    };
  }

  return {
    ok: true,
    supabase: supabase as unknown as SupabaseClient<Database>,
    user,
    userId: user.id,
    tenantId: tenantContext.tenant_id,
    tenantSlug: tenantContext.tenant_slug ?? null,
    tenantType,
    role,
  };
}

