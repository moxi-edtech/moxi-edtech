import { hasPermission } from "@/lib/permissions";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";

type Client = SupabaseClient<Database>;

type AuthCacheEntry = { allowed: boolean; reason?: string; expiresAt: number };
const authCache = new Map<string, AuthCacheEntry>();
const AUTH_CACHE_TTL_MS = 5 * 60 * 1000;

const authCacheKey = (escolaId: string, userId: string, requiredPermissions: string[]) =>
  `${escolaId}:${userId}:${requiredPermissions.slice().sort().join("|")}`;

export async function authorizeEscolaAction(
  s: Client,
  escolaId: string,
  userId: string,
  requiredPermissions: string[]
): Promise<{ allowed: boolean; reason?: string }> {
  const cacheKey = authCacheKey(escolaId, userId, requiredPermissions);
  const cached = authCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return { allowed: cached.allowed, reason: cached.reason };
  }

  let allowed = false;

  try {
    const { data: prof } = await s
      .from("profiles")
      .select("role")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1);
    const role = (prof?.[0] as any)?.role as string | undefined;
    if (role === "super_admin" || role === "global_admin") allowed = true;
  } catch {}

  try {
    const { data: vinc } = await s
      .from("escola_users")
      .select("papel, role")
      .eq("escola_id", escolaId)
      .eq("user_id", userId)
      .maybeSingle();
    const papel = ((vinc as any)?.papel ?? (vinc as any)?.role) as string | undefined;
    if (papel && (requiredPermissions.length === 0 || requiredPermissions.some((perm) => hasPermission(papel as any, perm as any)))) {
      allowed = true;
    }
  } catch {}

  if (!allowed) {
    try {
      const { data: adminLink } = await s
        .from("escola_administradores")
        .select("user_id")
        .eq("escola_id", escolaId)
        .eq("user_id", userId)
        .limit(1);
      if (adminLink && (adminLink as any[]).length > 0) allowed = true;
    } catch {}
  }

  if (!allowed) {
    try {
      const { data: prof } = await s
        .from("profiles")
        .select("role, escola_id")
        .eq("user_id", userId)
        .eq("escola_id", escolaId)
        .limit(1);
      if (prof && (prof as any[]).length > 0 && (prof as any)[0]?.role === "admin") allowed = true;
    } catch {}
  }

  try {
    const { data: profCheck } = await s
      .from("profiles" as any)
      .select("escola_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!profCheck || (profCheck as any).escola_id !== escolaId) {
      return { allowed: false, reason: "Perfil não vinculado à escola" };
    }
  } catch {}

  const result = allowed ? { allowed: true } : { allowed: false, reason: "Sem permissão" };
  authCache.set(cacheKey, { ...result, expiresAt: Date.now() + AUTH_CACHE_TTL_MS });
  return result;
}

export function authorizeDisciplinaManage(
  s: Client,
  escolaId: string,
  userId: string
) {
  return authorizeEscolaAction(s, escolaId, userId, ["configurar_escola", "gerenciar_disciplinas"]);
}

export function authorizeTurmasManage(
  s: Client,
  escolaId: string,
  userId: string
) {
  return authorizeEscolaAction(s, escolaId, userId, ["gerenciar_turmas", "configurar_escola"]);
}

export function authorizeMatriculasManage(
  s: Client,
  escolaId: string,
  userId: string
) {
  return authorizeEscolaAction(s, escolaId, userId, ["criar_matricula", "configurar_escola"]);
}
