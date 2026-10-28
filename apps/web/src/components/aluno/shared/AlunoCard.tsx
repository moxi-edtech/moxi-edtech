import type { KeyboardEvent, ReactNode } from "react";

type CardVariant = "default" | "glass" | "hero" | "subtle";

type Props = {
  children: ReactNode;
  className?: string;
  variant?: CardVariant;
  onClick?: () => void;
  ariaLabel?: string;
};

const variantStyles: Record<CardVariant, string> = {
  default: "border-border bg-card text-foreground shadow-none",
  glass: "border-border bg-card/90 text-foreground shadow-none backdrop-blur-sm",
  hero: "border-primary bg-primary text-primary-foreground shadow-none",
  subtle: "border-border bg-muted/50 text-foreground shadow-none",
};

/** Backward-compatible student card aligned to portal surfaces.
 * Clickable cards work by keyboard; prefer PortalAction for standalone actions.
 */
export function AlunoCard({ children, className = "", variant = "default", onClick, ariaLabel }: Props) {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (onClick && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      onClick();
    }
  };
  return (
    <div onClick={onClick} onKeyDown={onClick ? handleKeyDown : undefined}
      role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined}
      aria-label={ariaLabel}
      className={`min-w-0 rounded-xl border p-3.5 sm:p-4 ${variantStyles[variant]} ${onClick
        ? "min-h-11 cursor-pointer transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none"
        : ""} ${className}`}>
      {children}
    </div>
  );
}
