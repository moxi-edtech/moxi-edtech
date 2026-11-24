"use client";

import { useEffect, useRef } from "react";
import { Printer } from "lucide-react";

export default function PrintTrigger({ showManualButton = false, autoPrint = true }: { showManualButton?: boolean; autoPrint?: boolean }) {
  const manuallyRequested = useRef(false);

  useEffect(() => {
    // A native print dialog can block the entire browser window. Official
    // document previews must never open it without an explicit user action.
    if (!autoPrint) return;
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
  }, [autoPrint]);

  if (autoPrint && !showManualButton) return null;

  return (
    <div className="fixed right-4 top-4 z-[100] flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3 shadow-lg print:hidden" role="group" aria-label={autoPrint ? "Impressão do recibo" : "Impressão do documento"}>
      <span className="text-xs text-muted-foreground">{autoPrint ? "A impressão não abriu?" : "Documento pronto para impressão"}</span>
      <button
        type="button"
        onClick={() => {
          manuallyRequested.current = true;
          window.print();
        }}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-klasse-gold px-4 py-2 text-sm font-semibold text-white hover:brightness-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-klasse-gold/20"
      >
        <Printer className="h-4 w-4" aria-hidden="true" />
        {autoPrint ? "Imprimir recibo" : "Imprimir documento"}
      </button>
    </div>
  );
}
