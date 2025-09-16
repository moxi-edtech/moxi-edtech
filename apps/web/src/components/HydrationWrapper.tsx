// src/components/HydrationWrapper.tsx
'use client'

import { useEffect, useState } from 'react'

export default function HydrationWrapper({ children }: { children: React.ReactNode }) {
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  if (!isClient) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        ⏳ Carregando...
      </div>
    )
  }

  return <>{children}</>
}