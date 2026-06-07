"use client";

import { useEffect, useState } from "react";
import { Download, X, Share, PlusSquare } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-24 inset-x-4 z-40 md:bottom-8 md:right-8 md:left-auto md:w-80"
        >
          <div className="bg-slate-900 text-white p-5 rounded-3xl shadow-2xl border border-white/10 relative overflow-hidden">
            <button 
              onClick={handleDismiss}
              className="absolute top-3 right-3 p-1.5 text-white/40 hover:text-white transition bg-white/5 rounded-full"
            >
              <X size={14} />
            </button>

            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 shrink-0 bg-gradient-to-br from-klasse-green to-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-klasse-green/20">
                  <Download size={24} />
                </div>
                <div>
                  <p className="text-sm font-black tracking-tight">Klasse no seu celular</p>
                  <p className="text-[11px] text-white/60 font-medium">Instale para acesso rápido e offline.</p>
                </div>
              </div>

              {platform === "ios" ? (
                <div className="bg-white/5 rounded-2xl p-3 space-y-3">
                  <p className="text-[10px] font-bold text-white/80 leading-relaxed uppercase tracking-wider">Como instalar no iPhone:</p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 text-[11px]">
                      <div className="h-6 w-6 rounded-lg bg-white/10 flex items-center justify-center">
                        <Share size={12} className="text-blue-400" />
                      </div>
                      <span>Clique no botão <b>Compartilhar</b> abaixo.</span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px]">
                      <div className="h-6 w-6 rounded-lg bg-white/10 flex items-center justify-center">
                        <PlusSquare size={12} className="text-emerald-400" />
                      </div>
                      <span>Selecione <b>Adicionar à Tela de Início</b>.</span>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  onClick={handleInstall}
                  className="w-full bg-white text-slate-900 py-3 rounded-2xl text-xs font-black hover:bg-slate-100 transition active:scale-95 shadow-lg shadow-white/5"
                >
                  Instalar Agora
                </button>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
