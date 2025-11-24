import * as React from "react";

import { cn } from "~/components/ui/utils";

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
}

export const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(({ className, value = 0, ...props }, ref) => {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div ref={ref} className={cn("h-3 w-full overflow-hidden rounded-full bg-muted", className)} {...props}>
      <div
        className="h-full bg-primary transition-all"
        style={{ width: `${clamped}%` }}
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        role="progressbar"
      />
    </div>
  );
});
Progress.displayName = "Progress";
