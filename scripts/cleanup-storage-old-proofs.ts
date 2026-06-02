/**
 * scripts/cleanup-storage-old-proofs.ts
 * 
 * Este script apaga definitivamente do Supabase Storage todos os arquivos de 
 * comprovativos financeiros (talões) com mais de 90 dias.
 * 
 * Lógica:
 * 1. Lista objetos no bucket 'candidaturas'.
 * 2. Filtra arquivos que começam com 'upload_comprovativo'.
 * 3. Verifica a data de criação (created_at).
 * 4. Apaga se > 90 dias.
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY! // Necessário p/ bypass RLS

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function cleanup() {
  console.log('🚀 Iniciando limpeza de comprovativos antigos (> 90 dias)...')
  
  const bucketName = 'candidaturas'
  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

  // 1. Obter lista de pastas (escolas)
  const { data: schools, error: schoolErr } = await supabase.storage.from(bucketName).list()
  
  if (schoolErr) {
    console.error('Erro ao listar escolas:', schoolErr)
    return
  }

  for (const school of schools) {
    // 2. Obter candidaturas
    const { data: candidates, error: candErr } = await supabase.storage.from(bucketName).list(school.name)
    
    if (candErr) continue

    for (const cand of candidates) {
      // 3. Obter arquivos da candidatura
      const path = `${school.name}/${cand.name}`
      const { data: files, error: fileErr } = await supabase.storage.from(bucketName).list(path)
      
      if (fileErr) continue

      const toDelete = files
        .filter(f => f.name.startsWith('upload_comprovativo'))
        .filter(f => {
          const createdAt = new Date(f.created_at)
          return createdAt < ninetyDaysAgo
        })
        .map(f => `${path}/${f.name}`)

      if (toDelete.length > 0) {
        console.log(`🗑️ Apagando ${toDelete.length} comprovativos em ${path}...`)
        const { error: delErr } = await supabase.storage.from(bucketName).remove(toDelete)
        if (delErr) console.error(`❌ Erro ao apagar em ${path}:`, delErr)
      }
    }
  }

  console.log('✅ Limpeza concluída.')
}

cleanup().catch(console.error)
