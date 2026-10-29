"use client";

import Link from "next/link";
import { ShieldCheck, ArrowRightLeft, GraduationCap, BookOpenCheck } from "lucide-react";

interface StatusFormProps {
  alunoId: string;
  currentStatus: string;
  onSuccess: () => void;
}

/**
 * A edição textual de `matriculas.status` foi descontinuada.
 * Transferência, confirmação, conclusão e anulação têm contratos diferentes;
 * nenhum deles pode ser substituído por um PUT direto sem RAA/auditoria.
 */
export default function StatusForm({ alunoId, currentStatus, onSuccess }: StatusFormProps) {
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-muted p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Estado registado</p>
        <p className="mt-1 text-sm font-semibold text-foreground">{currentStatus || "Não identificado"}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          O estado administrativo da matrícula é diferente do resultado académico. A aprovação,
          retenção e conclusão dependem da decisão oficial e do histórico escolar.
        </p>
      </div>

      <div className="space-y-3 text-sm">
        <div className="flex items-start gap-3">
          <BookOpenCheck className="mt-0.5 h-4 w-4 shrink-0 text-foreground" aria-hidden />
          <div>
            <p className="font-semibold text-foreground">Confirmar uma matrícula</p>
            <p className="text-xs text-muted-foreground">
              Use o perfil do aluno para verificar a reserva, pagamentos e confirmação oficial.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <GraduationCap className="mt-0.5 h-4 w-4 shrink-0 text-foreground" aria-hidden />
          <div>
            <p className="font-semibold text-foreground">Finalizar o ano letivo</p>
            <p className="text-xs text-muted-foreground">
              A Secretaria deve validar notas, frequência, resultado e histórico no fechamento académico.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <ArrowRightLeft className="mt-0.5 h-4 w-4 shrink-0 text-foreground" aria-hidden />
          <div>
            <p className="font-semibold text-foreground">Transferir ou corrigir a turma</p>
            <p className="text-xs text-muted-foreground">
              Feche este painel e use a ação de transferência/retificação da matrícula na lista.
            </p>
          </div>
        </div>
        <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          Trancamento, desistência e anulação exigem um procedimento administrativo próprio.
          Não são alterações livres de texto.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <button type="button" onClick={onSuccess} className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-foreground">
          Fechar
        </button>
        <Link href="/secretaria/fechamento-academico" className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-foreground">
          Fechamento
        </Link>
        <Link href={`/secretaria/alunos/${encodeURIComponent(alunoId)}`} className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          Abrir ficha do aluno
        </Link>
      </div>
    </div>
  );
}
