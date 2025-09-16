// src/lib/rpc.ts
import { createClient } from "@/lib/supabaseClient"

// Lista de funções RPC que você tem no banco (adicione mais conforme for criando)
type RpcFunctions = "dashboard"

export async function rpcTyped<T>(fn: RpcFunctions | string, args?: object) {
  const supabase = createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await supabase.rpc(fn as any, args)
  return { data: data as T | null, error }
}
