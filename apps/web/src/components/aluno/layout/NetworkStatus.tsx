"use client";

import { useOfflineStatus } from "@/hooks/useOfflineStatus";
import { WifiOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function NetworkStatus() {
  const { online } = useOfflineStatus();

  return (
    <AnimatePresence>
      {!online && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="bg-amber-600 text-white overflow-hidden"
        >
          <div className="mx-auto max-w-5xl px-4 py-1.5 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest">
            <WifiOff size={14} className="animate-pulse" />
            <span>Modo Offline: Exibindo dados em cache</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
