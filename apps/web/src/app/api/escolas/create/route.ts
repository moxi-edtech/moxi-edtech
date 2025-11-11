import { NextResponse } from 'next/server'
import { supabaseServerTyped } from '@/lib/supabaseServer'
import type { Database } from '~types/supabase'

export async function POST(request: Request) {
  const supabase = await supabaseServerTyped<Database>()
  const body = await request.json()

  // Assuming the body contains the necessary fields for a new 'escola'
  const { data, error } = await supabase
    .from('escolas')
    .insert(body)
    .select()
    .single()

  if (error) {
    console.error('Error creating escola:', error)
    return NextResponse.json(
      { error: 'Failed to create escola', details: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json(data)
}