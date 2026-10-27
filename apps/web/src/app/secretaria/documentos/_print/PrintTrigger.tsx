"use client";

import { useEffect, useRef } from "react";

export default function PrintTrigger({ showManualButton = false }: { showManualButton?: boolean }) {
  const manuallyRequested = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let fallbackTimer: number | undefined;

    const waitForImage = (image: HTMLImageElement) => {
      if (image.complete) {
        return image.naturalWidth > 0 && typeof image.decode === "function"
          ? image.decode().catch(() => undefined)
          : Promise.resolve();
      }

      return new Promise<void>((resolve) => {
        const done = () => {
          image.removeEventListener("load", done);
          image.removeEventListener("error", done);
          resolve();
        };
        image.addEventListener("load", done, { once: true });
        image.addEventListener("error", done, { once: true });
      });
    };

    void (async () => {
      const imagesReady = Promise.all(Array.from(document.images, waitForImage));
      const fontsReady = document.fonts?.ready?.catch(() => undefined) ?? Promise.resolve();
      // Both images AND web fonts share a bounded wait: remote assets must not
      // prevent printing forever. The user can always print manually below.
      await Promise.race([
        Promise.all([imagesReady, fontsReady]),
        new Promise<void>((resolve) => {
          fallbackTimer = window.setTimeout(resolve, 4000);
        }),
      ]);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          // A manual click wins over delayed automatic printing: never show
          // a second dialog after the user has already requested printing.
          if (!cancelled && !manuallyRequested.current) window.print();
        });
      });
    })();

    return () => {
      cancelled = true;
      if (fallbackTimer !== undefined) window.clearTimeout(fallbackTimer);
    };
  }, []);

  if (!showManualButton) return null;

  return (
    <div className="fixed right-4 top-4 z-[100] flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-lg print:hidden" role="group" aria-label="Impressão do recibo">
      <span className="text-xs text-slate-700">A impressão não abriu?</span>
      <button
        type="button"
        onClick={() => {
          manuallyRequested.current = true;
          window.print();
        }}
        className="rounded-lg bg-[#1F6B3B] px-4 py-2 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F6B3B]"
      >
        Imprimir recibo
      </button>
    </div>
  );
}
