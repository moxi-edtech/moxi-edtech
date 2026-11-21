import * as React from "react";

/** Legacy table wrapper: semantic surface, horizontal overflow contained on narrow viewports. */
export function Table({ children, className = "", ...props }: React.TableHTMLAttributes<HTMLTableElement> & { children: React.ReactNode }) {
  return (
    <div className="min-w-0 overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
      <table {...props} className={`w-full text-left text-sm text-foreground ${className}`.trim()}>
        {children}
      </table>
    </div>
  );
}
