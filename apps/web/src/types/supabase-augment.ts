// apps/web/src/types/supabase-augment.ts
import type { Database } from "~types/supabase"

export type DBWithRPC = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Functions"> & {
    Functions: Database["public"]["Functions"] & {
      create_escola_with_admin: {
        Args: {
          p_nome: string
          p_nif: string | null
          p_endereco: string | null
          p_admin_email: string | null
          p_admin_telefone: string | null
          p_admin_nome: string | null
        }
        Returns: {
          ok: boolean
          escolaId: string
          escolaNome: string
          mensagemAdmin: string
        }
      }
    }
  }
}

