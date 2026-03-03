export function isSuperAdminRole(role: string | null | undefined): boolean {
  if (!role) return false;
  const r = role.trim().toLowerCase();
  return r === "super_admin" || r === "global_admin" || r === "superadmin";
}
