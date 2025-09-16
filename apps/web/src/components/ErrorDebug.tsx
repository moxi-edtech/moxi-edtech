'use client'

import { useEffect } from 'react'

export default function ErrorDebug() {
  useEffect(() => {
    console.log('🔍 ErrorDebug - Componente montado')
    console.log('HTML do container:', document.querySelector('.p-6')?.outerHTML)
    
    // Verifique children
    const container = document.querySelector('.p-6')
    if (container) {
      console.log('Children do container:', container.children.length)
      Array.from(container.children).forEach((child, index) => {
        console.log(`Child ${index}:`, child.outerHTML)
      })
    }
  }, [])

  return null
}