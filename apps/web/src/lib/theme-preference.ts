export type ThemePreference = "light" | "dark" | "system";

export function parseThemePreference(value: unknown): ThemePreference {
  return value === "light" || value === "dark" || value === "system" ? value : "system";
}

export function resolveDarkTheme(value: ThemePreference, systemDark: boolean): boolean {
  return value === "dark" || (value === "system" && systemDark);
}
