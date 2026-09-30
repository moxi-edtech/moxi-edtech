"use client";

import { useEffect } from "react";

export default function PrintTrigger() {
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
      // Nunca bloqueamos a impressão indefinidamente se um recurso remoto falhar,
      // mas o logótipo passa a ter tempo para carregar e ser decodificado.
      await Promise.race([
        imagesReady,
        new Promise<void>((resolve) => {
          fallbackTimer = window.setTimeout(resolve, 4000);
        }),
      ]);
      await document.fonts?.ready?.catch(() => undefined);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!cancelled) window.print();
        });
      });
    })();

    return () => {
      cancelled = true;
      if (fallbackTimer !== undefined) window.clearTimeout(fallbackTimer);
    };
  }, []);

  return null;
}
