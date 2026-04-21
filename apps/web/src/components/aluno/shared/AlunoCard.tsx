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
      className={`rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-[0_2px_10px_rgba(15,23,42,0.04)] ${
        onClick ? "cursor-pointer transition hover:border-[#2b6044]/30 hover:shadow-[0_8px_24px_rgba(43,96,68,0.08)]" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}
