import Link from "next/link";
import type { ReactNode } from "react";

type Shared = {
  children: ReactNode;
  className?: string;
  variant?: "quiet" | "primary" | "outline";
  ariaLabel?: string;
};
type PortalActionProps = Shared & (
  | { href: string; onClick?: never; disabled?: never }
  | { href?: never; onClick: () => void; disabled?: boolean; type?: "button" | "submit" }
);

/** Links navigate, buttons act. Always keyboard-visible and >=44px high. */
export function PortalAction(props: PortalActionProps) {
  const { children, className = "", variant = "quiet", ariaLabel } = props;
  const variants = {
    quiet: "text-primary hover:bg-muted",
    primary: "bg-primary text-primary-foreground hover:bg-primary/90",
    outline: "border border-border bg-card text-foreground hover:bg-muted",
  };
  const styles = `inline-flex min-h-11 max-w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold leading-5 transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${variants[variant]} ${className}`;
  if (props.href !== undefined) {
    return <Link href={props.href} className={styles} aria-label={ariaLabel}>{children}</Link>;
  }
  return (
    <button type={props.type ?? "button"} onClick={props.onClick} disabled={props.disabled}
      className={styles} aria-label={ariaLabel}>
      {children}
    </button>
  );
}
