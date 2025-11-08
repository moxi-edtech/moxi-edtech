"use client";

interface HeaderProps {
  title: string;
}

export default function Header({ title }: HeaderProps) {
  return (
    <header className="flex justify-between items-center mb-6">
      <h1 className="text-2xl font-semibold text-[#0B2C45]">{title}</h1>
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold">
          AD
        </div>
        <span className="text-sm font-medium text-gray-700">Administrador</span>
      </div>
    </header>
  );
}
