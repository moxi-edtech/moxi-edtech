"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Educando = { id: string; nome: string; escola_id: string | null };

export function StudentSwitcher({ educandos, selectedId }: { educandos: Educando[]; selectedId: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const searchValue = search?.toString() ?? "";

  const onChange = (id: string) => {
    const params = new URLSearchParams(searchValue);
    params.set("aluno", id);
    router.replace(`${pathname}?${params.toString()}`);
  };

  if (educandos.length <= 1) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm">
        {educandos[0]?.nome ?? "Sem educandos"}
      </div>
    );
  }

  return (
    <div>
      <label className="sr-only" htmlFor="student-switcher">Selecionar educando</label>
      <select
        id="student-switcher"
        className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm outline-none ring-klasse-green-500 focus:ring-2"
        value={selectedId ?? educandos[0]?.id}
        onChange={(e) => onChange(e.target.value)}
      >
        {educandos.map((aluno) => (
          <option key={aluno.id} value={aluno.id}>{aluno.nome}</option>
        ))}
      </select>
    </div>
  );
}
