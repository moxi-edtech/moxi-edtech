"use client";

import { useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ModalShell } from "@/components/ui/ModalShell";
import { NotificacoesSurface } from "@/components/ui/NotificacoesSurface";
import { useNotificacoes, type Notificacao } from "@/hooks/useNotificacoes";
import { useEscolaId } from "@/hooks/useEscolaId";
import { buildPortalHref, getEscolaParamFromPath } from "@/lib/navigation";

export function NotificacoesDropdown() {
  const router = useRouter();
  const pathname = usePathname();
  const academicPortal = /^(?:\/escola\/[^/]+)?\/(?:aluno|professor)(?:\/|$)/.test(pathname ?? "");
  const { escolaId, escolaSlug } = useEscolaId();
  const escolaParam = getEscolaParamFromPath(pathname) ?? escolaSlug ?? escolaId;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [modalNotificacao, setModalNotificacao] = useState<Notificacao | null>(null);
  // Both presentations share the same hook, data, and read actions.
  const { notificacoes, naoLidas, loading, marcarLida, marcarTodasLidas } = useNotificacoes();
  const resolveActionUrl = (actionUrl: string) => {
    if (/^\/(aluno|professor)(\/|$)/.test(actionUrl)) {
      return buildPortalHref(escolaParam, actionUrl);
    }
    return actionUrl;
  };
  const handleAction = (notificacao: Notificacao) => {
    if (notificacao.tipo === "A" || notificacao.modal_id) {
      setModalNotificacao(notificacao);
      return;
    }
    void marcarLida(notificacao.id);
    if (notificacao.action_url) router.push(resolveActionUrl(notificacao.action_url));
  };
  const handleModalAction = () => {
    if (!modalNotificacao) return;
    void marcarLida(modalNotificacao.id);
    const actionUrl = modalNotificacao.action_url;
    setModalNotificacao(null);
    if (actionUrl) router.push(resolveActionUrl(actionUrl));
  };

  return <>
    <NotificacoesSurface triggerRef={triggerRef} notificacoes={notificacoes} naoLidas={naoLidas} loading={loading}
      onLida={marcarLida} onTodasLidas={marcarTodasLidas} onAction={handleAction}/>
    <ModalShell
      open={Boolean(modalNotificacao)}
      title={modalNotificacao?.titulo ?? "Notificação"}
      mobileFullscreen
      onRestoreFocus={() => requestAnimationFrame(() => triggerRef.current?.focus())}
      onClose={() => setModalNotificacao(null)}
      footer={
        modalNotificacao?.action_url ? <div className="flex justify-end">
          <button type="button" onClick={handleModalAction}
            className={"min-h-11 rounded-xl px-4 py-2 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-ring " + (academicPortal ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-klasse-gold text-klasse-gold-900 hover:brightness-95")}>
            {modalNotificacao.action_label || "Abrir"}
          </button>
        </div> : undefined
      }
    >
      <div className="min-w-0 whitespace-pre-wrap break-words text-sm text-foreground">
        {modalNotificacao?.corpo ? <p>{modalNotificacao.corpo}</p> : null}
      </div>
    </ModalShell>
  </>;
}
