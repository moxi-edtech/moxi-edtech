export type ThemePreference = "light" | "dark" | "system";

export function parseThemePreference(value: unknown): ThemePreference {
  return value === "light" || value === "dark" || value === "system" ? value : "system";
}

export function resolveDarkTheme(value: ThemePreference, systemDark: boolean): boolean {
  return value === "dark" || (value === "system" && systemDark);
}

/** The student/teacher portals remain light-only until their theme UI is supported. */
export const LIGHT_ONLY_PORTAL_PATH_PATTERN = /^(?:\/(?:aluno|professor)|\/escola\/[^/]+\/(?:aluno|professor))(?:\/|$)/;

export function isLightOnlyPortalPath(pathname: string | null | undefined): boolean {
  return LIGHT_ONLY_PORTAL_PATH_PATTERN.test(pathname ?? "");
}
