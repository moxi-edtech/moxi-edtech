"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

type ModalShellProps = {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: "default" | "wide";
  mobileFullscreen?: boolean;
  /** Opt in to a compact writing layout while the mobile software keyboard is visible. */
  keyboardAware?: boolean;
  onRestoreFocus?: () => void;
};

/** API-compatible modal; Radix handles focus, Escape and scroll locking. */
export function ModalShell({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  size = "default",
  mobileFullscreen = false,
  keyboardAware = false,
  onRestoreFocus,
}: ModalShellProps) {
  const scrollRef=useRef<HTMLDivElement>(null);
  const [viewport,setViewport]=useState<{height:number;top:number;keyboard:boolean}|null>(null);
  useEffect(()=>{
    if(!open||!mobileFullscreen)return;
    const vv=window.visualViewport;
    const small=window.matchMedia("(max-width: 639px)");
    if(!keyboardAware){
      const sync=()=>setViewport(small.matches&&vv&&vv.scale===1?{height:vv.height,top:vv.offsetTop,keyboard:false}:null);
      sync();
      vv?.addEventListener("resize",sync);vv?.addEventListener("scroll",sync);small.addEventListener("change",sync);
      return()=>{vv?.removeEventListener("resize",sync);vv?.removeEventListener("scroll",sync);small.removeEventListener("change",sync);};
    }
    let baseline=Math.max(window.innerHeight,document.documentElement.clientHeight,vv?.height??0);
    let width=document.documentElement.clientWidth;
    let frame=0,scrollFrame=0,settleFrame=0;
    let keyboardVisible=false;
    function editable(){
      const active=document.activeElement;
      if(!(active instanceof HTMLElement)||!scrollRef.current?.contains(active))return null;
      if(active.isContentEditable)return active;
      if(active instanceof HTMLTextAreaElement&&!active.disabled&&!active.readOnly)return active;
      if(active instanceof HTMLInputElement&&!active.disabled&&!active.readOnly&&!["button","checkbox","radio","range","file","submit","reset","hidden","color","date","time"].includes(active.type))return active;
      return null;
    }
    function reveal(){
      if(!keyboardVisible)return;
      const body=scrollRef.current,target=editable();
      if(!body||!target)return;
      let rect=target.getBoundingClientRect();
      if(target.isContentEditable){
        const selection=window.getSelection();
        if(selection?.rangeCount&&selection.anchorNode&&target.contains(selection.anchorNode)){
          const caret=selection.getRangeAt(0).getBoundingClientRect();
          if(caret.height>0)rect=caret;
        }
      }
      const bounds=body.getBoundingClientRect();
      const top=bounds.top+8,bottom=bounds.bottom-12;
      if(rect.top<top)body.scrollTop+=rect.top-top;
      else if(rect.bottom>bottom)body.scrollTop+=Math.min(rect.bottom-bottom,Math.max(0,rect.top-top));
    }
    function scheduleReveal(){
      cancelAnimationFrame(scrollFrame);cancelAnimationFrame(settleFrame);
      scrollFrame=requestAnimationFrame(()=>{settleFrame=requestAnimationFrame(reveal);});
    }
    function sync(){
      const nextWidth=document.documentElement.clientWidth;
      const height=vv?.height??window.innerHeight;
      if(Math.abs(width-nextWidth)>40){width=nextWidth;baseline=Math.max(window.innerHeight,document.documentElement.clientHeight,height);}
      else if(!editable())baseline=Math.max(window.innerHeight,document.documentElement.clientHeight,height,baseline);
      const available=small.matches&&(!vv||Math.abs(vv.scale-1)<0.02);
      const keyboard=Boolean(keyboardAware&&available&&editable()&&baseline-height>=120);
      keyboardVisible=keyboard;
      const next=available?{height,top:vv?.offsetTop??0,keyboard}:null;
      setViewport(previous=>previous?.height===next?.height&&previous?.top===next?.top&&previous?.keyboard===next?.keyboard?previous:next);
      if(keyboard)scheduleReveal();
    }
    function schedule(){cancelAnimationFrame(frame);frame=requestAnimationFrame(sync);}
    function onInput(){if(keyboardVisible)scheduleReveal();}
    sync();
    vv?.addEventListener("resize",schedule);vv?.addEventListener("scroll",schedule);
    window.addEventListener("resize",schedule);small.addEventListener("change",schedule);
    if(keyboardAware){document.addEventListener("focusin",schedule);document.addEventListener("focusout",schedule);document.addEventListener("input",onInput);}
    return()=>{
      cancelAnimationFrame(frame);cancelAnimationFrame(scrollFrame);cancelAnimationFrame(settleFrame);
      vv?.removeEventListener("resize",schedule);vv?.removeEventListener("scroll",schedule);
      window.removeEventListener("resize",schedule);small.removeEventListener("change",schedule);
      document.removeEventListener("focusin",schedule);document.removeEventListener("focusout",schedule);document.removeEventListener("input",onInput);
    };
  },[open,mobileFullscreen,keyboardAware]);
  const keyboardOpen=Boolean(keyboardAware&&open&&viewport?.keyboard);
  // The focus scope spans the viewport. The base DialogContent animations use transforms,
  // which create a containing block even with zero translation, so disable them here.
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <DialogContent
        layout="viewport"
        data-keyboard-open={keyboardOpen?"true":"false"}
        closeButton={false}
        overlayClassName="bg-black/40"
        onPointerDownOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => {
          // Escape from the nested Balcão must be handled by its draft-aware close guard.
          if ((event.target as HTMLElement | null)?.closest?.("[data-balcao-workspace-modal]")) {
            event.preventDefault();
          }
        }}
        onCloseAutoFocus={onRestoreFocus?event=>{event.preventDefault();onRestoreFocus();}:undefined}
        style={mobileFullscreen&&viewport?{height:viewport.height,top:viewport.top,bottom:"auto"}:undefined}
        className={(keyboardAware?"group/modal ":"")+(mobileFullscreen?"gap-0 border-0 bg-transparent p-0 shadow-none sm:p-6":"gap-0 border-0 bg-transparent p-4 shadow-none sm:p-6")}
      >
        <section
          className={[
            "flex w-full max-h-full min-h-0 flex-col gap-0 overflow-hidden rounded-2xl border border-border bg-card shadow-xl",
            mobileFullscreen ? "max-sm:h-full max-sm:rounded-none max-sm:border-0" : "",
            size === "wide" ? "max-w-7xl" : "max-w-3xl",
          ].join(" ")}
        >
          <div className={mobileFullscreen?"flex shrink-0 items-start justify-between gap-2 border-b border-border px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] sm:gap-4 sm:px-6 sm:py-4":"flex shrink-0 items-start justify-between gap-4 border-b border-border px-4 py-4 sm:px-6"}>
            <div className="min-w-0">
              <DialogTitle className="break-words text-lg font-semibold text-foreground">{title}</DialogTitle>
              <DialogDescription className={description&&!keyboardOpen ? "mt-1 text-xs text-muted-foreground" : "sr-only"}>
                {description ?? title}
              </DialogDescription>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 shrink-0 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-klasse-gold/20"
            >
              Fechar
            </button>
          </div>
          <div ref={scrollRef} data-modal-scroll="" className={mobileFullscreen?"min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 sm:px-6 sm:py-5":"min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6"}>{children}</div>
          {footer&&!keyboardOpen ? <div data-modal-footer="" className={mobileFullscreen?"max-h-[38%] shrink-0 overflow-y-auto border-t border-border bg-muted px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:max-h-none sm:px-6 sm:py-4":"shrink-0 border-t border-border bg-muted px-4 py-4 sm:px-6"}>{footer}</div> : null}
        </section>
      </DialogContent>
    </Dialog>
  );
}
