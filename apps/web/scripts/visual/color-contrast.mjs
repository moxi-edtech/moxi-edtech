/** WCAG contrast: computed styles can preserve OKLCH colors in Chromium. */
function toLinearRgb(color) {
  const input = color.trim().toLowerCase();
  if (input.startsWith("oklch(") && input.endsWith(")")) {
    const [channels, opacity] = input.slice(6, -1).split("/");
    if (opacity && Number.parseFloat(opacity.trim()) !== 1) throw new Error("Only opaque OKLCH colors supported: " + color);
    const parts = channels.trim().split(/\s+/);
    if (parts.length !== 3) throw new Error("Invalid OKLCH color: " + color);
    const L = parts[0].endsWith("%") ? Number.parseFloat(parts[0]) / 100 : Number(parts[0]);
    const C = Number(parts[1]);
    const h = Number.parseFloat(parts[2]) * Math.PI / 180;
    if (![L, C, h].every(Number.isFinite)) throw new Error("Invalid OKLCH color: " + color);
    const a = C * Math.cos(h);
    const b = C * Math.sin(h);
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
    return [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
    ].map(v => Math.min(1, Math.max(0, v)));
  }
  if (/^rgba?\(/.test(input) && input.endsWith(")")) {
    const parts = input.slice(input.indexOf("(") + 1, -1).trim().split(/[,\s/]+/).filter(Boolean);
    if (parts.length < 3) throw new Error("Invalid RGB color: " + color);
    const rgb = parts.slice(0, 3).map(v => Number(v) / 255);
    const alpha = parts.length >= 4 ? Number(parts[3]) : 1;
    if (rgb.some(v => !Number.isFinite(v) || v < 0 || v > 1) || alpha !== 1)
      throw new Error("Only opaque sRGB colors supported: " + color);
    return rgb.map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  }
  throw new Error("Unsupported CSS color: " + color);
}

export function contrastRatio(foreground, background) {
  const luminance = color => {
    const rgb = toLinearRgb(color);
    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  };
  const fg = luminance(foreground);
  const bg = luminance(background);
  return (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
}
