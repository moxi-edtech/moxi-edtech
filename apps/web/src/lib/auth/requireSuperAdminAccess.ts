export function isSuperAdminRole(role: string | null | undefined): boolean {
  return role === "super_admin" || role === "global_admin";
}
