'use client'

import { useEffect } from 'react'
import { fetchDashboardData } from '@/lib/super-admin-data'

export default function DebugPage() {
  useEffect(() => {
    console.log('🐛 Página de debug carregada')
    
    async function testRPC() {
      console.log('🧪 Testando RPC...')
      const result = await fetchDashboardData()
      console.log('📊 Resultado do teste:', result)
    }
    
    testRPC()
  }, [])

  return <div>Verifique o console do navegador! 🐛</div>
}