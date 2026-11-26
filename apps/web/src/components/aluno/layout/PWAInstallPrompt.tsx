"use client";

import { useEffect, useState } from "react";
import { Download, X, Share, PlusSquare } from "lucide-react";


export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [show, setShow] = useState(false);
  const [platform, setPlatform] = useState<"android" | "ios" | "other">("other");

  useEffect(() => {
    // Detect platform
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIos = /iphone|ipad|ipod/.test(userAgent);
    const isAndroid = /android/.test(userAgent);
    
    if (isIos) setPlatform("ios");
    else if (isAndroid) setPlatform("android");

    // Standard PWA prompt (Chrome/Android)
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      checkAndShow();
    };

    // Manual check for iOS
    const checkAndShow = () => {
      const dismissed = sessionStorage.getItem("pwa_prompt_dismissed");
      const isStandalone = (window.navigator as any).standalone || window.matchMedia("(display-mode: standalone)").matches;
      
      if (!dismissed && !isStandalone) {
        setShow(true);
      }
    };

    window.addEventListener("beforeinstallprompt", handler);
    
    // For iOS, we check immediately
    if (isIos) {
      checkAndShow();
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setDeferredPrompt(null);
      setShow(false);
    }
  };

  const handleDismiss = () => {
    setShow(false);
    sessionStorage.setItem("pwa_prompt_dismissed", "true");
  };

  return (
    <>
      {show && (
        <div
          className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] inset-x-4 z-40 md:bottom-8 md:right-8 md:left-auto md:w-80"
        >
          <div className="relative overflow-hidden rounded-xl border border-border bg-card p-4 text-foreground shadow-lg">
            <button 
              onClick={handleDismiss}
              type="button" aria-label="Fechar sugestão de instalação"
              className="absolute right-1 top-1 flex min-h-11 min-w-11 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X size={14} />
            </button>

            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3 pr-8">
                <div className="h-10 w-10 shrink-0 rounded-xl bg-accent text-accent-foreground flex items-center justify-center">
                  <Download size={24} />
                </div>
                <div>
                  <p className="text-sm font-semibold tracking-tight">KLASSE no teu telemóvel</p>
                  <p className="text-xs text-muted-foreground">Instala para acesso rápido.</p>
                </div>
              </div>

              {platform === "ios" ? (
                <div className="bg-muted/40 rounded-xl p-3 space-y-3">
                  <p className="text-xs font-medium text-foreground">Como instalar no iPhone:</p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 text-xs">
                      <div className="h-6 w-6 rounded-lg bg-card flex items-center justify-center">
                        <Share size={12} className="text-primary" />
                      </div>
                      <span>Toca no botão <b>Partilhar</b> abaixo.</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <div className="h-6 w-6 rounded-lg bg-card flex items-center justify-center">
                        <PlusSquare size={12} className="text-primary" />
                      </div>
                      <span>Selecciona <b>Adicionar ao ecrã principal</b>.</span>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  onClick={handleInstall}
                  className="min-h-11 w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Instalar
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
