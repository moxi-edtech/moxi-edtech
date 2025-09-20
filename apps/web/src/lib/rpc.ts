import { createClient } from "@/lib/supabaseClient"
import { PostgrestError } from "@supabase/supabase-js"

type RpcResult<T> = {
  data: T | null
  error: PostgrestError | null
}

type RpcManyResult<T> = {
  data: T[]
  error: PostgrestError | null
}

// ✅ Para RPCs que retornam um único objeto
export async function rpcOne<T>(
  fn: string,
  params: Record<string, unknown> = {}
): Promise<RpcResult<T>> {
  try {
    const supabase = createClient()
    
    // Usando approach mais direto sem tipagem complexa
    const result = await (supabase as any).rpc(fn, params)
    const { data, error } = result

    if (error) {
      console.error(`Erro ao executar RPC ${fn}:`, error.message)
      return { data: null, error }
    }

    return { data: (data as T[])?.[0] ?? null, error: null }
  } catch (error) {
    console.error(`Erro inesperado em RPC ${fn}:`, error)
    return { data: null, error: error as PostgrestError }
  }
}

// ✅ Para RPCs que retornam lista
export async function rpcMany<T>(
  fn: string,
  params: Record<string, unknown> = {}
): Promise<RpcManyResult<T>> {
  try {
    const supabase = createClient()
    
    // Usando approach mais direto sem tipagem complexa
    const result = await (supabase as any).rpc(fn, params)
    const { data, error } = result

    if (error) {
      console.error(`Erro ao executar RPC ${fn}:`, error.message)
      return { data: [], error }
    }

    return { data: (data as T[]) ?? [], error: null }
  } catch (error) {
    console.error(`Erro inesperado em RPC ${fn}:`, error)
    return { data: [], error: error as PostgrestError }
  }
}