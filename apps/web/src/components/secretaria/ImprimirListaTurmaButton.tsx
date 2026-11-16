"use client";

import { useCallback, useRef, useState } from "react";
import { Check, Download, Loader2, Printer, RotateCw } from "lucide-react";

type Estado = "pronto" | "a_gerar" | "concluido" | "erro";

/**
 * Impressão nominal simples. O endpoint autentica, autoriza e valida a escola,
 * sessão e polo; o botão é apenas uma facilidade de interface.
 */
export function ImprimirListaTurmaButton({
  turmaId,
  className = "",
}: {
  turmaId: string;
  className?: string;
}) {
  const [estado, setEstado] = useState<Estado>("pronto");
  const [erro, setErro] = useState<string | null>(null);
  const ocupado = useRef(false);

  const emitir = useCallback(async () => {
    if (ocupado.current) return;
    ocupado.current = true;
    setEstado("a_gerar");
    setErro(null);

    try {
      const response = await fetch(
        "/api/secretaria/turmas/" + encodeURIComponent(turmaId) + "/alunos/pdf",
        { credentials: "same-origin", cache: "no-store" }
      );
      if (!response.ok) {
        const result: unknown = await response.json().catch(() => null);
        const msg = result && typeof result === "object" && "error" in result
          ? String(result.error) : "Não foi possível gerar a lista.";
        throw new Error(msg);
      }
      if (!response.headers.get("content-type")?.includes("application/pdf")) {
        throw new Error("O servidor não devolveu um PDF válido.");
      }
      const blob = await response.blob();
      if (!blob.size) throw new Error("O PDF devolvido está vazio.");

      const blobUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = blobUrl;
      anchor.download = "lista_nominal_turma_" + turmaId + ".pdf";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 30_000);
      setEstado("concluido");
    } catch (cause) {
      setErro(cause instanceof Error ? cause.message : "Falha ao descarregar a lista.");
      setEstado("erro");
    } finally {
      ocupado.current = false;
    }
  }, [turmaId]);

  return (
    <span className={"inline-flex flex-col items-start gap-1 " + className}>
      <button
        type="button"
        onClick={() => void emitir()}
        disabled={estado === "a_gerar"}
        aria-busy={estado === "a_gerar"}
        className="inline-flex min-h-9 items-center justify-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:border-ring hover:bg-muted disabled:cursor-wait disabled:opacity-70"
      >
        {estado === "a_gerar" ? <Loader2 size={16} className="animate-spin" />
          : estado === "concluido" ? <Check size={16} />
          : estado === "erro" ? <RotateCw size={16} />
          : <Printer size={16} />}
        {estado === "a_gerar" ? "A gerar lista…"
          : estado === "erro" ? "Tentar de novo"
          : estado === "concluido" ? <><Download size={14} /> Descarregar novamente</>
          : "Imprimir lista"}
      </button>
      {erro && <span role="alert" className="max-w-56 text-xs text-red-600">{erro}</span>}
      {estado === "concluido" && <span role="status" className="text-xs text-muted-foreground">PDF pronto.</span>}
    </span>
  );
}
