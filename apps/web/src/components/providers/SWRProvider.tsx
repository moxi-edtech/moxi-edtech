"use client";

import { SWRConfig } from "swr";

export default function SWRProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        revalidateOnFocus: false,
        shouldRetryOnError: true,
        dedupingInterval: 10_000,
      }}
    >
      {children}
    </SWRConfig>
  );
}
