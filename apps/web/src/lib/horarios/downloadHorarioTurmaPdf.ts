"use client";

type TurmaHorarioDownloadInput = {
  id: string;
};

function filenameFromDisposition(value: string | null) {
  const match = value?.match(/filename="([^"]+)"/i) ?? value?.match(/filename=([^;]+)/i);
  return match?.[1]?.trim() || `Horario_${Date.now()}.pdf`;
}

export async function downloadHorarioTurmaPdf({
  turma,
}: {
  escolaId?: string;
  escolaNome?: string | null;
  turma: TurmaHorarioDownloadInput;
}) {
  const res = await fetch(`/api/secretaria/turmas/${turma.id}/horario/pdf`, { cache: "no-store" });
  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw new Error(json?.error || "Falha ao baixar horário da turma.");
  }

  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filenameFromDisposition(res.headers.get("Content-Disposition"));
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}
