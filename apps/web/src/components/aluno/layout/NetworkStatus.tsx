"use client";

import { useOfflineStatus } from "@/hooks/useOfflineStatus";
import { useOfflineQueueStatus } from "@/hooks/useOfflineQueueStatus";
import { AlertCircle, RefreshCw, WifiOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ReactNode } from "react";

export function NetworkStatus() {
  const { online } = useOfflineStatus();
  const { total, pending, syncing, failed, conflict } = useOfflineQueueStatus();

  const hasPendingItems = total > 0;
  const showBanner = !online || hasPendingItems;

  let bgClass = "bg-amber-600";
  let content: ReactNode = null;

  if (!online) {
    bgClass = "bg-amber-600";
    content = (
      <div className="mx-auto max-w-5xl px-4 py-1.5 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-white">
        <WifiOff size={14} className="animate-pulse" />
        <span>
          Modo Offline: Exibindo dados em cache
          {hasPendingItems ? ` (${total} pendente${total > 1 ? "s" : ""})` : ""}
        </span>
      </div>
    );
  } else if (conflict > 0) {
    bgClass = "bg-red-600";
    content = (
      <div className="mx-auto max-w-5xl px-4 py-1.5 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-white">
        <AlertCircle size={14} className="animate-bounce" />
        <span>
          Conflito de Sincronização: {conflict} alteração{conflict > 1 ? "ões" : "ão"} requer{conflict > 1 ? "em" : "e"} atenção
        </span>
      </div>
    );
  } else if (failed > 0 && syncing === 0 && pending === 0) {
    bgClass = "bg-amber-700";
    content = (
      <div className="mx-auto max-w-5xl px-4 py-1.5 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-white">
        <AlertCircle size={14} />
        <span>
          Falha na Sincronização: {failed} alteração{failed > 1 ? "ões" : "ão"} não {failed > 1 ? "puderam" : "pôde"} ser enviada{failed > 1 ? "s" : ""}
        </span>
      </div>
    );
  } else if (hasPendingItems) {
    bgClass = "bg-slate-700";
    content = (
      <div className="mx-auto max-w-5xl px-4 py-1.5 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-white">
        <RefreshCw size={14} className="animate-spin" />
        <span>
          Sincronizando: {total} alteração{total > 1 ? "ões" : "ão"} local{total > 1 ? "is" : ""} pendente{total > 1 ? "s" : ""}
        </span>
      </div>
    );
  }

  return (
    <AnimatePresence>
      {showBanner && content && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className={`${bgClass} overflow-hidden transition-colors duration-300`}
        >
          {content}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
