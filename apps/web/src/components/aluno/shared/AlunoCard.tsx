import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
};

export function AlunoCard({ children, className = "", onClick }: Props) {
  return (
    <div
      onClick={onClick}
      className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${
        onClick ? "cursor-pointer transition hover:border-klasse-green-200" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}
