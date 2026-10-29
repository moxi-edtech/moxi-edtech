"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/components/feedback/FeedbackSystem";

interface FinalizarMatriculaButtonProps {
  matriculaId: string;
  alunoNome: string;
  escolaId: string;
}

/**
 * The school may confirm that GradeEngine should close the academic year.
 * The user cannot select pass/fail: official grades and RAA determine it.
 */
export function FinalizarMatriculaButton({ matriculaId, alunoNome }: FinalizarMatriculaButtonProps) {
  const router = useRouter();
  const { success, error } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [motivo, setMotivo] = useState("");

  const handleSubmit = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/secretaria/matriculas/${matriculaId}/finalizar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          motivo: motivo.trim() || undefined,
          is_override_manual: false,
        }),
      });

      const result = await response.json().catch(() => null);
      if (!response.ok || result?.ok !== true) {
        const reasons = Array.isArray(result?.motivos) ? result.motivos.map(String).join(" · ") : "";
        throw new Error(
          [result?.error || "Não foi possível finalizar a matrícula.", reasons]
            .filter(Boolean)
            .join(" "),
        );
      }

      const state = result.status === "concluido" ? "concluída"
        : result.status === "reprovado" ? "reprovada"
        : "finalizada";
      success(`Matrícula de ${alunoNome} ${state} conforme os resultados académicos oficiais.`);
      setOpen(false);
      setMotivo("");
      router.refresh();
    } catch (cause: unknown) {
      error(cause instanceof Error ? cause.message : "Não foi possível finalizar o ano letivo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!loading) setOpen(next); }}>
      <DialogTrigger asChild>
        <Button className="flex-1 md:flex-none">Finalizar ano letivo</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Finalizar o ano letivo de {alunoNome}</DialogTitle>
          <DialogDescription>
            O resultado será calculado pelas notas e pautas oficiais. Não é possível escolher
            aprovação ou reprovação manualmente. Se houver dados por lançar ou decisões por
            validar, a finalização será bloqueada sem alterar a matrícula.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-4">
          <label htmlFor="motivo-fim-ano" className="text-sm font-medium">
            Observação (opcional)
          </label>
          <textarea
            id="motivo-fim-ano"
            value={motivo}
            maxLength={500}
            onChange={(event) => setMotivo(event.target.value)}
            className="w-full rounded-md border border-border bg-background p-3 text-foreground"
            disabled={loading}
            rows={3}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar finalização
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
