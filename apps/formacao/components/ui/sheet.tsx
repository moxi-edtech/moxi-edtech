"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

type SheetContextValue = {
  open: boolean;
  setOpen: (value: boolean) => void;
};

const SheetContext = React.createContext<SheetContextValue | null>(null);

function useSheetContext() {
  const ctx = React.useContext(SheetContext);
  if (!ctx) throw new Error("Sheet components must be used inside <Sheet />");
  return ctx;
}

type SheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
};

export function Sheet({ open, onOpenChange, children }: SheetProps) {
  return <SheetContext.Provider value={{ open, setOpen: onOpenChange }}>{children}</SheetContext.Provider>;
}

type ClickableChild = React.ReactElement<{ onClick?: () => void }>;

export function SheetTrigger({ children }: { children: ClickableChild }) {
  const { setOpen } = useSheetContext();
  return React.cloneElement(children, {
    onClick: () => {
      children.props.onClick?.();
      setOpen(true);
    },
  });
}

export function SheetClose({ children }: { children: ClickableChild }) {
  const { setOpen } = useSheetContext();
  return React.cloneElement(children, {
    onClick: () => {
      children.props.onClick?.();
      setOpen(false);
    },
  });
}

export function SheetContent({
  side = "right",
  className,
  children,
}: {
  side?: "right" | "bottom";
  className?: string;
  children: React.ReactNode;
}) {
  const { open, setOpen } = useSheetContext();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);
  React.useEffect(() => {
    if (!open) return;
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [open, setOpen]);

  if (!mounted) return null;

  return createPortal(
    <div className={cn("fixed inset-0 z-50", open ? "pointer-events-auto" : "pointer-events-none")}>
      <div
        className={cn(
          "absolute inset-0 bg-slate-900/50 transition-opacity duration-200",
          open ? "opacity-100" : "opacity-0"
        )}
        onClick={() => setOpen(false)}
      />
      <aside
        className={cn(
          "absolute bg-white shadow-2xl transition-transform duration-300",
          side === "right" && "right-0 top-0 h-full w-full max-w-[400px]",
          side === "bottom" && "bottom-0 left-0 w-full rounded-t-2xl",
          open
            ? "translate-x-0 translate-y-0"
            : side === "right"
              ? "translate-x-full"
              : "translate-y-full",
          className
        )}
      >
        {children}
      </aside>
    </div>,
    document.body
  );
}

export function SheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("space-y-1.5", className)} {...props} />;
}

export function SheetTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("text-lg font-semibold text-slate-900", className)} {...props} />;
}

export function SheetDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-slate-500", className)} {...props} />;
}
