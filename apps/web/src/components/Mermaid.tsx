"use client"

import Script from "next/script"
import { useEffect, useState } from "react"

type MermaidProps = {
  chart: string
  className?: string
}

export default function Mermaid({ chart, className }: MermaidProps) {
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    // Re-render when script is already present
    const anyWin = window as any
    if (anyWin?.mermaid && loaded) {
      try { anyWin.mermaid.init(undefined, document.querySelectorAll('.mermaid')) } catch {}
    }
  }, [chart, loaded])

  return (
    <>
      <Script
        src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"
        strategy="afterInteractive"
        onLoad={() => {
          const anyWin = window as any
          if (anyWin?.mermaid) {
            anyWin.mermaid.initialize({ startOnLoad: true, securityLevel: 'loose' })
            setLoaded(true)
          }
        }}
      />
      <div className={className}>
        <pre className="mermaid">{chart}</pre>
      </div>
    </>
  )
}

