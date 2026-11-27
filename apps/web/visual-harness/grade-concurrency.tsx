import { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { GradeEntryGrid, type StudentGradeRow } from "@/components/professor/GradeEntryGrid";

const roster: StudentGradeRow[] = ["A", "B"].map((id, index) => ({
  id, numero: index + 1, nome: "Aluno " + id,
  mac1: null, npp1: null, npt1: null, mt1: null, _status: "synced",
}));

function Fixture() {
  const control = useRef<(() => Promise<void>) | null>(null);
  const [scale, setScale] = useState(20);
  return <>
    <button onClick={() => setScale(10)}>Usar dez valores</button>
    <button onClick={() => void control.current?.().catch(() => undefined)}>Guardar agora</button>
    <GradeEntryGrid key={scale} compact initialData={roster} saveControl={control} notaMaxima={scale}
      onSave={async rows => {
        const response = await fetch("/fixture/grade-save", {method: "POST", body: JSON.stringify(rows)});
        if (!response.ok) throw new Error("Falha sintética");
      }} />
  </>;
}

createRoot(document.getElementById("root")!).render(<Fixture />);
