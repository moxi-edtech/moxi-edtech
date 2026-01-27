"use client";

import { useEffect } from "react";

type PrintTriggerProps = {
  bodyClassName?: string;
};

export default function PrintTrigger({ bodyClassName }: PrintTriggerProps) {
  useEffect(() => {
    if (bodyClassName) {
      document.body.classList.add(bodyClassName);
    }
    const timer = setTimeout(() => {
      window.print();
    }, 300);

    return () => {
      clearTimeout(timer);
      if (bodyClassName) {
        document.body.classList.remove(bodyClassName);
      }
    };
  }, [bodyClassName]);

  return null;
}
