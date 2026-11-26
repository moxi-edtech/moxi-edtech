/** CSS custom properties in globals.css are the single motion-token source. */
export type PortalMotionToken = "press" | "tab" | "sheet" | "feedback" | "disclosure";

export function parseMotionDuration(value: string): number {
  const match = value.trim().match(/^(\d+(?:\.\d+)?)(ms|s)$/);
  if (!match) return 0;
  const duration = Number(match[1]) * (match[2] === "s" ? 1000 : 1);
  return Number.isFinite(duration) ? duration : 0;
}

export function readMotionDuration(element: Element, token: PortalMotionToken): number {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return 0;
  return parseMotionDuration(getComputedStyle(element).getPropertyValue(`--portal-motion-${token}`));
}
