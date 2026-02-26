import type { ReactNode } from "react";

export default function SecaoLabel({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
      {children}
    </h2>
  );
}
