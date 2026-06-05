// apps/web/src/types/supabase-augment.ts
import type { Database } from "~types/supabase"

export type DBWithRPC = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Functions"> & {
    Functions: Database["public"]["Functions"] & {
      aluno_atualizar_contatos_proprios: {
        Args: {
          p_escola_id: string;
          p_aluno_id: string;
          p_email: string | null;
          p_telefone: string | null;
          p_endereco: string | null;
        };
        Returns: Array<{
          email: string | null;
          telefone: string | null;
          endereco: string | null;
        }>;
      };
      aluno_confirmar_rematricula: {
        Args: {
          p_matricula_id: string;
        };
        Returns: Array<{
          candidatura_id: string;
          next_ano: number;
          reused: boolean;
        }>;
      };
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
